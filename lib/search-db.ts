import { prisma } from '@/lib/prisma';
import { foldTr, foldSql } from '@/lib/search';

// Sunucu tarafı Türkçe karakterden bağımsız arama: eşleşen kayıtların kimliklerini döndürür.
// Prisma'nın "insensitive" araması (ILIKE) Türkçe I/ı ve İ/i dönüşümünü bilmediği için
// sadeleştirilmiş SQL ifadesiyle karşılaştırılır.

const TABLES = {
  Customer: ['name', 'email'],
  Supplier: ['name', 'email'],
  Material: ['name'],
  Product: ['name', 'code'],
} as const;

type Table = keyof typeof TABLES;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c);

export async function idsMatching(table: Table, companyId: string | null | undefined, query: string, limit = 5000): Promise<string[]> {
  const q = foldTr(query);
  if (!q) return [];
  const cols = TABLES[table].map(c => `${foldSql(`COALESCE("${c}", '')`)} LIKE $2`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "${table}" WHERE ($1::text IS NULL OR "companyId" = $1) AND (${cols}) LIMIT ${Math.floor(limit)}`,
    companyId ?? null, `%${escapeLike(q)}%`,
  );
  return rows.map(r => r.id);
}

/** Aynı firmada, Türkçe karakter ve büyük/küçük harften bağımsız olarak aynı adlı aktif kayıt. */
export async function findSameName(table: 'Customer' | 'Supplier', companyId: string, name: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT "id", "name" FROM "${table}" WHERE "companyId" = $1 AND "status" <> 1 AND ${foldSql('"name"')} = $2 LIMIT 1`,
    companyId, foldTr(name),
  );
  return rows[0] ?? null;
}
