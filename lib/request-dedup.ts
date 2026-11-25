// Mükerrer kayıt koruması: aynı firmadan aynı içerikli kayıt isteği (satış, alış, iade, tahsilat, ödeme, çek)
// DUPLICATE_WINDOW_SEC içinde ikinci kez gelirse işlenmez → 409. Çift tıklama, iki sekme ve mobil ağ tekrarlarını
// sunucuda keser; çok örnekli (serverless) ortamda da çalışır çünkü kayıt veritabanında tutulur.
// İstek başarısız olursa (4xx/5xx) özet silinir; kullanıcı düzeltip hemen yeniden gönderebilir.
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const DUPLICATE_WINDOW_SEC = 10;
export const DUPLICATE_MESSAGE = 'Bu kayıt az önce gönderildi; ikinci kez kaydedilmedi. Aynı kaydı gerçekten tekrar eklemek istiyorsanız birkaç saniye sonra yeniden deneyin.';

/** Anahtar sırasından bağımsız JSON (aynı içerik = aynı özet) */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export function requestHash(scope: string, body: unknown) {
  return createHash('sha256').update(`${scope}\n${stableStringify(body)}`).digest('hex');
}

/** Özeti kaydeder; pencere içinde aynısı varsa null (mükerrer). Eşzamanlı iki istekten yalnızca biri kazanır. */
export async function claimRequest(companyId: string, scope: string, body: unknown, windowSec = DUPLICATE_WINDOW_SEC) {
  const hash = requestHash(scope, body);
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    INSERT INTO "RequestFingerprint" ("companyId", "hash", "createdAt") VALUES (${companyId}, ${hash}, NOW())
    ON CONFLICT ("companyId", "hash") DO UPDATE SET "createdAt" = NOW()
      WHERE "RequestFingerprint"."createdAt" < NOW() - make_interval(secs => ${windowSec})
    RETURNING 1 AS ok`;
  if (Math.random() < 0.02) {
    prisma.$executeRaw`DELETE FROM "RequestFingerprint" WHERE "createdAt" < NOW() - INTERVAL '1 day'`.catch(() => {});
  }
  if (!rows.length) return null;
  return { release: () => prisma.requestFingerprint.deleteMany({ where: { companyId, hash } }).then(() => undefined).catch(() => undefined) };
}

/**
 * POST işleyicisini mükerrer korumayla sarar. Oturum ya da gövde okunamazsa işleyici olduğu gibi çalışır
 * (yetki/doğrulama hatasını kendisi döner).
 */
export function duplicateGuarded(scope: string, handler: (req: NextRequest, ctx?: any) => Promise<Response>) {
  return async (req: NextRequest, ctx?: any): Promise<Response> => {
    const [session, body] = await Promise.all([
      getServerSession(authOptions).catch(() => null),
      req.clone().json().catch(() => undefined),
    ]);
    const companyId = (session?.user as any)?.companyId as string | undefined;
    if (!companyId || body === undefined) return handler(req, ctx);
    const claim = await claimRequest(companyId, `${scope}:${(session?.user as any)?.id ?? ''}`, body);
    if (!claim) return NextResponse.json({ error: DUPLICATE_MESSAGE, duplicate: true }, { status: 409 });
    try {
      const res = await handler(req, ctx);
      if (res.status >= 400) await claim.release();
      return res;
    } catch (e) {
      await claim.release();
      throw e;
    }
  };
}
