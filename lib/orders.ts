import { prisma } from '@/lib/prisma';
import { sendMailSafe } from '@/lib/mail';
import { orderRecipients, pushToUsers } from '@/lib/push';
import { rejectForeignRefs } from '@/lib/tenant';
import { cleanQuantity, formatQty, isPairUnit, orderUnit } from '@/lib/order-units';
import { esc, itemsTableHtml } from '@/lib/order-email';
import { cleanShore, variantText } from '@/lib/shore';

// Satıcı firmada müşteri siparişi (SoleOrder) oluşturur ve üretim emri e-postasını gönderir.
// Portal müşterisi (/api/portal/me/orders) ve bağlı firma (/api/network/links/:id/orders) aynı mantığı kullanır.
export type CreateOrderOptions = {
  companyId: string;
  customerId: string;
  portalCustomerId?: string | null;
  linkId?: string | null;
  buyerUserId?: string | null;
  /** Portal müşterisi yoksa bilgi e-postasının gideceği kişi */
  contact?: { email: string; name?: string | null } | null;
};

type SoleOrderRow = Awaited<ReturnType<typeof prisma.soleOrder.create>>;
export type CreateOrderResult = { order: SoleOrderRow; error?: undefined; status?: undefined } | { error: string; status: number; order?: undefined };

export async function createSoleOrder(opts: CreateOrderOptions, body: any): Promise<CreateOrderResult> {
  const { productId, productCode, color, material, sizeDistribution, requestedDeliveryDate, notes, colorPartials, orderItems } = body;
  const foreign = await rejectForeignRefs(opts.companyId, {
    product: [productId, ...(Array.isArray(orderItems) ? orderItems.map((i: any) => i?.productId) : [])],
  });
  if (foreign) return { error: ((await foreign.json().catch(() => ({}))) as any).error ?? 'Geçersiz kayıt', status: foreign.status };

  // --- Package order (multi-item) ---
  const isPackage = Array.isArray(orderItems) && orderItems.length > 0;

  let finalSizeDist: Record<string, number>;
  let finalTotalQty: number;
  let finalProductId: string | null;
  let finalProductCode: string | null;
  let finalUnit: string | null = null;
  let finalItems: any[] | undefined;

  if (isPackage) {
    const normalized = await normalizeOrderItems(opts.companyId, orderItems);
    if ('error' in normalized) return { error: normalized.error, status: 400 };
    finalItems = normalized.items;
    finalUnit = normalized.unit;
    // Beden dağılımı yalnızca çift birimli siparişte anlamlı
    finalSizeDist = {};
    finalTotalQty = 0;
    for (const item of finalItems) {
      finalTotalQty += item.totalQuantity;
      for (const [sz, qty] of Object.entries(item.sizeDistribution as Record<string, number>)) {
        finalSizeDist[sz] = (finalSizeDist[sz] || 0) + qty;
      }
    }
    finalTotalQty = Math.round(finalTotalQty * 1000) / 1000;
    finalProductId = finalItems[0]?.productId || null;
    finalProductCode = finalItems[0]?.productCode || null;
  } else {
    if (!sizeDistribution || typeof sizeDistribution !== 'object') {
      return { error: 'sizeDistribution required', status: 400 };
    }
    finalSizeDist = sizeDistribution as Record<string, number>;
    finalTotalQty = Object.values(finalSizeDist).reduce((s, v) => s + (Number(v) || 0), 0);
    if (finalTotalQty === 0) return { error: 'En az 1 adet girmelisiniz', status: 400 };
    finalProductId = productId || null;
    finalProductCode = productCode || null;
  }

  const now = new Date();
  const orderNo = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const order = await prisma.soleOrder.create({
    data: {
      companyId: opts.companyId,
      customerId: opts.customerId,
      portalCustomerId: opts.portalCustomerId ?? null,
      linkId: opts.linkId ?? null,
      buyerUserId: opts.buyerUserId ?? null,
      orderNo,
      productId: finalProductId,
      productCode: finalProductCode,
      color: isPackage ? null : (color || null),
      material: isPackage ? null : (material || null),
      sizeDistribution: finalSizeDist,
      totalQuantity: finalTotalQty,
      unit: finalUnit,
      requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
      notes: notes || null,
      colorPartials: isPackage ? null : (colorPartials || null),
      orderItems: isPackage ? finalItems : undefined,
      status: 'ORDER_RECEIVED',
      statusHistory: {
        create: { status: 'ORDER_RECEIVED', note: 'Sipariş oluşturuldu' },
      },
    },
  });

  // Bildirim: firma yöneticilerine üretim emri, siparişi verene bilgi (portal müşterisi ya da bağlı firma kullanıcısı)
  const [portalCustomer, customer, product, adminUsers] = await Promise.all([
    opts.portalCustomerId
      ? prisma.portalCustomer.findUnique({ where: { id: opts.portalCustomerId }, select: { email: true, name: true } })
      : Promise.resolve(opts.contact ?? null),
    prisma.customer.findUnique({ where: { id: opts.customerId }, select: { name: true } }),
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true, code: true } }) : Promise.resolve(null),
    prisma.user.findMany({
      where: { companyId: opts.companyId, role: { in: ['ADMIN', 'COMPANY_OWNER'] } },
      select: { email: true },
    }),
  ]);

  const adminEmails = adminUsers.map(u => u.email).filter(Boolean);

  // Build size distribution table rows
  const sizeEntries = Object.entries(finalSizeDist).filter(([, qty]) => qty > 0);
  const sizeHeaderCells = sizeEntries.map(([sz]) => `<th style="padding:6px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#475569;">${esc(sz)}</th>`).join('');
  const sizeValueCells = sizeEntries.map(([, qty]) => `<td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:500;">${qty}</td>`).join('');

  const productionHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1e293b;max-width:680px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Üretim Emri</p>
      <h1 style="font-size:24px;font-weight:700;margin:0;">${esc(orderNo)}</h1>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b;">
      <p style="margin:0;">Tarih: ${now.toLocaleDateString('tr-TR')}</p>
      ${requestedDeliveryDate ? `<p style="margin:4px 0 0;"><strong style="color:#1e293b;">İstenen Termin: ${new Date(requestedDeliveryDate).toLocaleDateString('tr-TR')}</strong></p>` : ''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:8px 16px 8px 0;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Müşteri</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${esc(customer?.name ?? '—')}</p>
        ${portalCustomer ? `<p style="font-size:12px;color:#64748b;margin:2px 0 0;">${esc(portalCustomer.email)}</p>` : ''}
      </td>
      <td style="padding:8px 0 8px 16px;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Toplam</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${esc(formatQty(finalTotalQty, finalUnit))}</p>
        ${finalItems ? `<p style="font-size:12px;color:#64748b;margin:2px 0 0;">${finalItems.length} kalem</p>` : ''}
      </td>
    </tr>
  </table>

  ${finalItems ? itemsTableHtml(finalItems) : `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:8px 16px 8px 0;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Ürün</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${esc(productCode || product?.code || '—')}</p>
        ${product?.name ? `<p style="font-size:12px;color:#64748b;margin:2px 0 0;">${esc(product.name)}</p>` : ''}
      </td>
      <td style="padding:8px 0 8px 16px;vertical-align:top;width:50%;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Renk / Malzeme</p>
        <p style="font-size:15px;font-weight:600;margin:0;">${esc(color || '—')} · ${esc(material || '—')}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom:20px;">
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Beden Dağılımı</p>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr>
        ${sizeHeaderCells}
        <th style="padding:6px 12px;border:1px solid #e2e8f0;background:#dbeafe;color:#1d4ed8;font-weight:700;">Toplam</th>
      </tr></thead>
      <tbody><tr>
        ${sizeValueCells}
        <td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:#1d4ed8;background:#dbeafe;">${esc(formatQty(finalTotalQty, finalUnit))}</td>
      </tr></tbody>
    </table>
  </div>`}

  ${notes ? `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
    <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Notlar</p>
    <p style="margin:0;color:#475569;">${esc(notes)}</p>
  </div>` : ''}

  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;gap:40px;">
    ${['Hazırlayan', 'Kontrol Eden', 'Onaylayan'].map(l => `
    <div style="flex:1;text-align:center;">
      <div style="border-bottom:1px solid #94a3b8;height:40px;margin-bottom:4px;"></div>
      <p style="font-size:11px;color:#94a3b8;margin:0;">${l}</p>
    </div>`).join('')}
  </div>
</body>
</html>`;

  // Send production sheet to company admins, CC portal customer
  if (adminEmails.length > 0) {
    await sendMailSafe({
      to: adminEmails,
      cc: portalCustomer?.email,
      subject: `Yeni Sipariş: ${orderNo} — ${customer?.name ?? ''}`,
      html: productionHtml,
      text: `Yeni sipariş alındı: ${orderNo}\nMüşteri: ${customer?.name}\n${finalItems
        ? finalItems.map(i => `- ${[i.productCode, i.productName].filter(Boolean).join(' ')}${variantText(i) ? ` (${variantText(i)})` : ''}: ${formatQty(i.totalQuantity, i.unit)}`).join('\n')
        : `Model: ${productCode || product?.code || '—'}\nRenk: ${color || '—'}`}\nToplam: ${formatQty(finalTotalQty, finalUnit)}`,
    });
  } else if (portalCustomer) {
    // Fallback: confirmation only to portal customer
    await sendMailSafe({
      to: portalCustomer.email,
      subject: `Siparişiniz alındı: ${orderNo}`,
      html: `<p>Merhaba ${portalCustomer.name ?? portalCustomer.email},</p><p><strong>${orderNo}</strong> numaralı siparişiniz alındı. Toplam: <strong>${formatQty(finalTotalQty, finalUnit)}</strong></p>`,
      text: `Siparişiniz alındı: ${orderNo}, Toplam: ${formatQty(finalTotalQty, finalUnit)}`,
    });
  }

  // Anlık bildirim: siparişleri görebilen firma kullanıcılarına (portal ya da bağlı SoleCost firmasından gelen sipariş).
  // Sunucusuz ortamda yanıt dönünce iş kesilebileceği için beklenir; hata siparişi etkilemez.
  await pushToUsers(await orderRecipients(opts.companyId).catch(() => []), {
    title: opts.linkId ? 'Yeni sipariş (SoleCost ağı)' : 'Yeni portal siparişi',
    body: `${customer?.name ?? 'Müşteri'} · ${orderNo} · ${formatQty(finalTotalQty, finalUnit)}`,
    url: `/siparis/gelen/${order.id}`,
  });

  return { order };
}

type ItemProduct = { id: string; code: string | null; name: string; unit: string };

/**
 * Paket sipariş kalemlerini ürün birimine göre doğrular ve sunucuda yeniden kurar:
 * - çift: beden adetleri pozitif tam sayı, toplam bedenlerden hesaplanır, renk zorunlu
 * - diğer birimler (kg, metre, adet...): tek miktar, birimin ondalık kuralına göre
 * Ürün adı, kodu ve birimi veritabanından alınır. Bir siparişte tek birim olur.
 */
export async function normalizeOrderItems(companyId: string, raw: any[]):
  Promise<{ items: any[]; unit: string | null } | { error: string }> {
  const ids = raw.map(i => i?.productId).filter((x): x is string => typeof x === 'string');
  const products = new Map<string, ItemProduct>(
    (await prisma.product.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, code: true, name: true, unit: true } }))
      .map(p => [p.id, p]),
  );

  const items: any[] = [];
  for (const i of raw) {
    const p = typeof i?.productId === 'string' ? products.get(i.productId) : undefined;
    const unit = p ? orderUnit(p.unit) : 'çift';
    const color = typeof i?.color === 'string' ? i.color.trim().slice(0, 100) : '';
    const base = {
      productId: p?.id ?? null,
      productCode: p ? (p.code ?? '') : String(i?.productCode ?? '').slice(0, 100),
      productName: p ? p.name : String(i?.productName ?? '').slice(0, 200),
      unit,
      color,
    };
    if (isPairUnit(unit)) {
      const sizeDistribution: Record<string, number> = {};
      for (const [size, qty] of Object.entries(i?.sizeDistribution && typeof i.sizeDistribution === 'object' ? i.sizeDistribution : {})) {
        const n = Math.floor(Number(qty));
        if (Number.isFinite(n) && n > 0) sizeDistribution[String(size).slice(0, 10)] = n;
      }
      const totalQuantity = Object.values(sizeDistribution).reduce((a, b) => a + b, 0);
      if (!totalQuantity) return { error: `${base.productName || 'Kalem'}: en az 1 çift girin` };
      items.push({ ...base, sizeDistribution, totalQuantity });
    } else {
      const quantity = cleanQuantity(i?.quantity ?? i?.totalQuantity, unit);
      if (quantity === null) return { error: `${base.productName}: geçerli bir miktar (${unit}) girin` };
      // Hammaddede renk yok; shore seviyesi (Yumuşak/Standart/Sert) ve değeri (varsayılan 65, ±2)
      const shore = cleanShore(i?.shoreLevel, i?.shoreValue);
      if ('error' in shore) return { error: `${base.productName}: ${shore.error}` };
      items.push({ ...base, color: '', ...shore, sizeDistribution: {}, quantity, totalQuantity: quantity });
    }
  }
  const units = Array.from(new Set(items.map(i => i.unit)));
  if (units.length > 1) return { error: `Farklı birimdeki ürünler (${units.join(', ')}) ayrı siparişlerde verilmeli` };
  return { items, unit: units[0] === 'çift' ? null : units[0] };
}

