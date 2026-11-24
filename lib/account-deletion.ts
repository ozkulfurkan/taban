import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

// Hesap silme (App Store 5.1.1(v)): uygulama içinden başlatılır.
//  1) E-postaya 6 haneli onay kodu gider (15 dk geçerli).
//  2) Kod doğrulanınca hesap pasife alınır; 15 gün içinde giriş yapılmazsa tamamen silinir.
//     Firma sahibi → firma ve tüm verisi (diğer kullanıcılar dahil); diğer kullanıcılar → yalnızca kendi hesabı.
//  3) Pasif dönemde talep eden giriş yaparsa silme iptal olur. Günlük cron süresi dolanları siler.

export const GRACE_DAYS = 15;
export const CODE_TTL_MS = 15 * 60 * 1000;

export type DeletionScope = 'company' | 'user';

export const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export function deletionScope(role: string | undefined): DeletionScope | null {
  if (role === 'ADMIN') return null; // platform yöneticisi uygulamadan silinemez
  return role === 'COMPANY_OWNER' ? 'company' : 'user';
}

export function scheduledDate(now = new Date()) {
  return new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}

const fmtDate = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

export async function sendDeletionCode(to: string, name: string | null, code: string, scope: DeletionScope, companyName: string | null) {
  const what = scope === 'company'
    ? `<b>${esc(companyName)}</b> firma hesabınızın ve firmaya ait tüm verilerin (kullanıcılar dahil)`
    : 'kullanıcı hesabınızın';
  await sendMail({
    to,
    subject: 'SoleCost - Hesap silme onay kodu',
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <p>Merhaba ${esc(name ?? to)},</p>
        <p>${what} silinmesi için talepte bulundunuz. Onaylamak için uygulamaya şu kodu girin:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${code}</p>
        <p>Kod 15 dakika geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın ve şifrenizi değiştirin.</p>
      </div>`,
    text: `Hesap silme onay kodunuz: ${code}\nKod 15 dakika geçerlidir. Talebi siz yapmadıysanız dikkate almayın.`,
  });
}

export async function sendDeactivatedMail(to: string, name: string | null, scope: DeletionScope, companyName: string | null, at: Date) {
  const what = scope === 'company' ? `<b>${esc(companyName)}</b> firma hesabınız` : 'Hesabınız';
  const gone = scope === 'company'
    ? 'firma hesabınız, firmaya ait tüm kayıtlar ve firma kullanıcıları'
    : 'hesabınız';
  await sendMail({
    to,
    subject: 'SoleCost - Hesabınız pasif duruma alındı',
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <p>Merhaba ${esc(name ?? to)},</p>
        <p>${what} silme talebiniz üzerine <b>pasif duruma alındı</b>.</p>
        <p><b>${GRACE_DAYS} gün içinde (${fmtDate(at)} tarihine kadar) tekrar giriş yapmazsanız ${gone} tamamen ve geri alınamaz şekilde silinecektir.</b></p>
        <p>Vazgeçtiyseniz bu tarihten önce SoleCost'a giriş yapmanız yeterlidir; silme işlemi iptal edilir.</p>
      </div>`,
    text: `${scope === 'company' ? `${companyName} firma hesabınız` : 'Hesabınız'} pasif duruma alındı. ${GRACE_DAYS} gün içinde (${fmtDate(at)} tarihine kadar) tekrar giriş yapmazsanız ${gone} tamamen silinecektir. Vazgeçtiyseniz bu tarihten önce giriş yapmanız yeterlidir.`,
  });
}

export async function sendCancelledMail(to: string, name: string | null) {
  await sendMail({
    to,
    subject: 'SoleCost - Hesap silme işlemi iptal edildi',
    html: `<p>Merhaba ${esc(name ?? to)},</p><p>Tekrar giriş yaptığınız için hesap silme işleminiz iptal edildi. Hesabınız yeniden aktif.</p>`,
    text: 'Tekrar giriş yaptığınız için hesap silme işleminiz iptal edildi. Hesabınız yeniden aktif.',
  }).catch(() => {});
}

/** Firmayı tüm verisiyle siler. Yabancı anahtar sırası: önce bağımlı kayıtlar, en son kullanıcılar ve firma. */
export async function purgeCompany(companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
  const userIds = users.map(u => u.id);
  // Fason portal hesapları müşteriye değil fasoncuya bağlıdır
  const fason = await prisma.subcontractor.findMany({ where: { companyId, portalCustomerId: { not: null } }, select: { portalCustomerId: true } });
  const fasonPortalIds = fason.map(s => s.portalCustomerId!);
  const c = { companyId };
  await prisma.$transaction(async tx => {
    // Kullanıcıların başka firmalardaki izleri (destek yanıtı, işlem kaydı) anonimleşir
    await tx.ticketMessage.updateMany({ where: { userId: { in: userIds } }, data: { userId: null } });
    await tx.auditLog.updateMany({ where: { userId: { in: userIds }, NOT: c }, data: { userId: null } });

    await tx.koli.deleteMany({ where: c });
    await tx.payment.deleteMany({ where: c });
    await tx.cek.deleteMany({ where: c });
    await tx.materialTransfer.deleteMany({ where: c });
    await tx.subcontractorScrap.deleteMany({ where: c });
    await tx.stockAdjustment.deleteMany({ where: c });
    await tx.subcontractorOrder.deleteMany({ where: c });
    await tx.orderShipment.deleteMany({ where: { order: c } });
    await tx.soleOrder.deleteMany({ where: c });
    await tx.invoice.deleteMany({ where: c });
    await tx.purchase.deleteMany({ where: c });
    await tx.subcontractorStock.deleteMany({ where: { subcontractor: c } });
    await tx.subcontractor.deleteMany({ where: c });
    await tx.portalCustomer.deleteMany({ where: { OR: [{ customer: c }, { id: { in: fasonPortalIds } }] } });
    await tx.soleCalculation.deleteMany({ where: c });
    await tx.customerProductPrice.deleteMany({ where: c });
    await tx.productStockAdjustment.deleteMany({ where: c });
    await tx.product.deleteMany({ where: c });
    await tx.material.deleteMany({ where: c });
    await tx.customer.deleteMany({ where: c });
    await tx.supplier.deleteMany({ where: c });
    await tx.customerCategory.deleteMany({ where: c });
    await tx.supplierCategory.deleteMany({ where: c });
    await tx.productCategory.deleteMany({ where: c });
    await tx.account.deleteMany({ where: c });
    await tx.personnelDocument.deleteMany({ where: c });
    await tx.employee.deleteMany({ where: c });
    await tx.supportTicket.deleteMany({ where: c });
    await tx.auditLog.deleteMany({ where: c });
    await tx.barcodeSettings.deleteMany({ where: c });
    await tx.barcodeSequence.deleteMany({ where: c });
    await tx.documentCounter.deleteMany({ where: c });
    await tx.materialCalculation.deleteMany({ where: c });
    await tx.user.deleteMany({ where: c });
    await tx.company.delete({ where: { id: companyId } });
  }, { timeout: 120_000, maxWait: 20_000 });
}

/** Firma sahibi olmayan kullanıcıyı siler; firmaya ait kayıtları firmada kalır (oluşturan bilgisi boşalır). */
export async function purgeUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, companyId: true } });
  if (!user) return;
  // Hesaplamalarda kullanıcı zorunlu: firmanın başka bir kullanıcısına (önce sahibine) devredilir
  const heir = user.companyId
    ? await prisma.user.findFirst({
        where: { companyId: user.companyId, id: { not: userId }, deletionScheduledAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
    : null;
  await prisma.$transaction(async tx => {
    if (heir) await tx.soleCalculation.updateMany({ where: { userId }, data: { userId: heir.id } });
    else await tx.soleCalculation.deleteMany({ where: { userId } });
    await tx.invoice.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
    await tx.ticketMessage.updateMany({ where: { userId }, data: { userId: null } });
    await tx.supportTicket.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  }, { timeout: 60_000 });
}

/** Süresi dolan silmeleri uygular (günlük cron) */
export async function runDueDeletions(now = new Date()) {
  const companies = await prisma.company.findMany({ where: { deletionScheduledAt: { lte: now } }, select: { id: true } });
  const users = await prisma.user.findMany({
    where: { deletionScheduledAt: { lte: now }, OR: [{ companyId: null }, { company: { deletionScheduledAt: null } }] },
    select: { id: true },
  });
  const done = { companies: 0, users: 0, errors: [] as string[] };
  for (const co of companies) {
    try { await purgeCompany(co.id); done.companies++; } catch (e) { done.errors.push(`company ${co.id}: ${(e as Error).message}`); }
  }
  for (const u of users) {
    try { await purgeUser(u.id); done.users++; } catch (e) { done.errors.push(`user ${u.id}: ${(e as Error).message}`); }
  }
  return done;
}
