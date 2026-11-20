export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isLimited, recordAttempt } from '@/lib/login-throttle';
import { logAction, getIp } from '@/lib/audit-logger';
import {
  CODE_TTL_MS, deletionScope, hashCode, newCode, scheduledDate, sendDeactivatedMail, sendDeletionCode,
} from '@/lib/account-deletion';

// Hesap silme (uygulama içinden):
//  GET                      kapsam: { scope: 'company' | 'user' | null, companyName }
//  POST { step: 'request' } e-postaya 6 haneli onay kodu gönderir
//  POST { step: 'confirm', code } kod doğruysa hesabı pasife alır; 15 gün sonra silinir
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function me() {
  const session = await getServerSession(authOptions);
  const s = session?.user as any;
  if (!s?.id || s.type === 'portal') return null;
  return prisma.user.findUnique({
    where: { id: s.id },
    select: { id: true, email: true, name: true, role: true, companyId: true, deleteCodeHash: true, deleteCodeExpiry: true, company: { select: { name: true } } },
  });
}

export async function GET() {
  const user = await me();
  if (!user) return err('Unauthorized', 401);
  return NextResponse.json({ scope: deletionScope(user.role), companyName: user.company?.name ?? null, email: user.email });
}

export async function POST(req: NextRequest) {
  const user = await me();
  if (!user) return err('Unauthorized', 401);
  const scope = deletionScope(user.role);
  if (!scope) return err('Platform yöneticisi hesabı uygulamadan silinemez.', 403);
  const body = await req.json().catch(() => ({}));

  if (body.step === 'request') {
    const key = `delete-code:${user.id}`;
    if (await isLimited(key, 3)) return err('Çok fazla kod istendi. 15 dakika sonra tekrar deneyin.', 429);
    await recordAttempt(key);
    const code = newCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { deleteCodeHash: hashCode(code), deleteCodeExpiry: new Date(Date.now() + CODE_TTL_MS) },
    });
    try {
      await sendDeletionCode(user.email, user.name, code, scope, user.company?.name ?? null);
    } catch {
      return err('Onay kodu e-postası gönderilemedi. Lütfen tekrar deneyin.', 502);
    }
    return NextResponse.json({ ok: true, email: user.email });
  }

  if (body.step === 'confirm') {
    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
    const key = `delete-confirm:${user.id}`;
    if (await isLimited(key, 5)) return err('Çok fazla hatalı deneme. 15 dakika sonra yeni kod isteyin.', 429);
    const valid = code.length === 6 && user.deleteCodeHash && user.deleteCodeExpiry && user.deleteCodeExpiry > new Date()
      && user.deleteCodeHash === hashCode(code);
    if (!valid) {
      await recordAttempt(key);
      return err('Kod hatalı veya süresi dolmuş.');
    }
    const at = scheduledDate();
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: user.id }, data: { deleteCodeHash: null, deleteCodeExpiry: null, deletionScheduledAt: at } });
      if (scope === 'company' && user.companyId) {
        await tx.company.update({ where: { id: user.companyId }, data: { deletionScheduledAt: at, deletionRequestedById: user.id } });
      }
      // Pasif dönemde cihazlara bildirim gitmesin
      await tx.pushToken.deleteMany({ where: scope === 'company' && user.companyId ? { user: { companyId: user.companyId } } : { userId: user.id } });
    });
    if (user.companyId) {
      await logAction({
        companyId: user.companyId, userId: user.id, userName: user.name ?? user.email,
        action: 'DELETE', entity: scope === 'company' ? 'Company' : 'User', entityId: scope === 'company' ? user.companyId : user.id,
        detail: `Hesap silme talebi onaylandı; ${at.toISOString().slice(0, 10)} tarihinde silinecek`, ip: getIp(req),
      }).catch(() => {});
    }
    await sendDeactivatedMail(user.email, user.name, scope, user.company?.name ?? null, at).catch(() => {});
    return NextResponse.json({ ok: true, scope, scheduledAt: at.toISOString() });
  }

  return err('Geçersiz istek');
}
