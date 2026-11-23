// Tanıtım videoları için demo veritabanını (taban_demo) gerçekçi hâle getirir.
// Kullanım: DATABASE_URL=<demo veritabanı> npx tsx tools/promo-video/demo-data.ts
// Uyarı: Yalnızca demo veritabanında çalıştırın; canlı veritabanında ÇALIŞTIRMAYIN.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';

const prisma = new PrismaClient();
const day = 86_400_000;

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/taban_demo/.test(url)) throw new Error('Bu betik yalnızca taban_demo veritabanında çalışır');
  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'test@solecost.com' } });
  const cid = owner.companyId!;
  const now = Date.now();

  // Çekler: vadesi geçmiş, bu hafta, bu ay, ileri tarihli
  const offsets = [-3, 2, 5, 9, 16, 24, 38, 52, 70, 95];
  const ceks = await prisma.cek.findMany({ where: { companyId: cid }, orderBy: { createdAt: 'asc' } });
  for (let i = 0; i < ceks.length; i++) {
    const c = ceks[i];
    await prisma.cek.update({ where: { id: c.id }, data: { vadesi: new Date(now + offsets[i % offsets.length] * day), durum: i < 7 ? 'PORTFOY' : c.durum } });
  }

  // Ürün fotoğrafları (stilize taban görselleri)
  const dir = process.env.PROMO_IMG_DIR ?? '/tmp/claude-0/promo-img';
  for (const p of await prisma.product.findMany({ where: { companyId: cid } })) {
    const f = `${dir}/${p.id}.jpg`;
    if (!existsSync(f)) continue;
    const data = readFileSync(f);
    await prisma.productImage.upsert({
      where: { productId: p.id },
      create: { productId: p.id, companyId: cid, mimeType: 'image/jpeg', data, size: data.length },
      update: { mimeType: 'image/jpeg', data, size: data.length },
    });
    await prisma.product.update({ where: { id: p.id }, data: { imageUpdatedAt: new Date(), portalVisible: true } as any });
  }

  // Müşteri portalı hesabı (Ayakkabı Dünyası)
  const email = 'portal@ayakkabidunyasi.demo';
  await prisma.portalCustomer.upsert({
    where: { companyId_email: { companyId: cid, email } },
    create: { companyId: cid, customerId: 'cust-1', email, name: 'Ayakkabı Dünyası A.Ş.', password: await bcrypt.hash('Demo12345', 10), emailVerified: true },
    update: { password: await bcrypt.hash('Demo12345', 10), emailVerified: true, isActive: true },
  });
  const pc = await prisma.portalCustomer.findFirstOrThrow({ where: { companyId: cid, email } });
  // Ayakkabı Dünyası'nın siparişleri portal hesabına bağlanır; portal bildirimleri eklenir
  await prisma.soleOrder.updateMany({ where: { companyId: cid, customerId: 'cust-1' }, data: { portalCustomerId: pc.id } });
  const first = await prisma.soleOrder.findFirst({ where: { companyId: cid, customerId: 'cust-1' }, orderBy: { createdAt: 'desc' } });
  await prisma.notification.deleteMany({ where: { portalCustomerId: pc.id } });
  if (first) {
    await prisma.notification.createMany({ data: [
      { portalCustomerId: pc.id, title: `Yılmaz Taban · ${first.orderNo}`, body: 'Siparişiniz onaylandı · Termin: 04.12.2026', url: `/siparisler/${first.id}`, createdAt: new Date(now - 20 * 60_000) },
      { portalCustomerId: pc.id, title: 'Yılmaz Taban · SIP-2026-0120', body: 'Siparişiniz sevk edildi (Aras Kargo)', createdAt: new Date(now - 4 * day), readAt: new Date() },
    ] });
  }
  console.log('demo verisi hazır');
}
main().finally(() => prisma.$disconnect());
