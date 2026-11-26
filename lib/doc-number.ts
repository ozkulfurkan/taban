import { prisma } from '@/lib/prisma';

// Belge numarası üretimi (FTR-2026-0001 gibi).
// Eski yöntem son numarayı metin olarak sıralayıp buluyordu: "9999" > "10000" sayıldığı
// için 10000. belgeden sonra her kayıt hata veriyordu, aynı anda gelen iki istek de
// aynı numarayı alıp birbirini bozuyordu. Sayaç satırı UPDATE ile kilitlendiği için
// eşzamanlı istekler sırayla farklı numara alır.

const SOURCES = {
  invoice: { table: 'Invoice', column: 'invoiceNo' },
  purchase: { table: 'Purchase', column: 'invoiceNo' },
  order: { table: 'SoleOrder', column: 'orderNo' },
  subcontractorOrder: { table: 'SubcontractorOrder', column: 'orderNo' },
  ticket: { table: 'SupportTicket', column: 'ticketNo' },
  dispatch: { table: 'Dispatch', column: 'no' },
} as const;

export type DocumentKind = keyof typeof SOURCES;

type Db = Pick<typeof prisma, '$queryRaw' | '$queryRawUnsafe'>;

/** Belge tarihine göre yıl (İstanbul saatiyle; 31 Aralık gece yarısı yanlış yıla düşmesin). */
export function documentYear(date: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(date));
}

async function existingMax(db: Db, kind: DocumentKind, companyId: string, prefix: string): Promise<number> {
  const { table, column } = SOURCES[kind];
  const pattern = `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[0-9]+$`;
  const rows = await db.$queryRawUnsafe<Array<{ m: number | null }>>(
    `SELECT MAX(CAST(substring("${column}" from ${prefix.length + 1}) AS INTEGER)) AS m
       FROM "${table}" WHERE "companyId" = $1 AND "${column}" ~ $2`,
    companyId, pattern,
  );
  return Number(rows[0]?.m ?? 0);
}

async function isTaken(db: Db, kind: DocumentKind, companyId: string, number: string): Promise<boolean> {
  const { table, column } = SOURCES[kind];
  const rows = await db.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM "${table}" WHERE "companyId" = $1 AND "${column}" = $2 LIMIT 1`,
    companyId, number,
  );
  return rows.length > 0;
}

/**
 * Sıradaki belge numarasını ayırır. Transaction içinde çağrılırsa (tx verilirse) sayaç
 * satırı transaction bitene kadar kilitli kalır. Elle girilmiş bir numarayla çakışırsa
 * bir sonrakine geçer.
 */
export async function nextDocumentNumber(
  kind: DocumentKind, companyId: string, prefix: string, opts: { db?: Db; pad?: number } = {},
): Promise<string> {
  const db = opts.db ?? prisma;
  const pad = opts.pad ?? 4;
  const key = `${kind}:${prefix}`;

  for (let attempt = 0; attempt < 50; attempt++) {
    let rows = await db.$queryRaw<Array<{ value: number }>>`
      UPDATE "DocumentCounter" SET "value" = "value" + 1
      WHERE "companyId" = ${companyId} AND "key" = ${key}
      RETURNING "value"`;
    if (rows.length === 0) {
      // Bu önek için ilk belge: mevcut en büyük numaradan devam et
      const start = (await existingMax(db, kind, companyId, prefix)) + 1;
      rows = await db.$queryRaw<Array<{ value: number }>>`
        INSERT INTO "DocumentCounter" ("companyId", "key", "value") VALUES (${companyId}, ${key}, ${start})
        ON CONFLICT ("companyId", "key") DO UPDATE SET "value" = "DocumentCounter"."value" + 1
        RETURNING "value"`;
    }
    const number = `${prefix}${String(rows[0].value).padStart(pad, '0')}`;
    if (!(await isTaken(db, kind, companyId, number))) return number;
  }
  throw new Error('Belge numarası üretilemedi');
}
