import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const order = await prisma.subcontractorOrder.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      subcontractor: true,
      product: {
        include: {
          parts: {
            include: {
              material: { select: { name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!order.subcontractor.email) {
    return NextResponse.json({ error: 'Fasoncunun e-posta adresi yok' }, { status: 400 });
  }

  const sizeRows = Object.entries(order.sizeDistribution as Record<string, number>)
    .filter(([, qty]) => qty > 0)
    .map(([size, qty]) => `<tr><td style="padding:4px 12px;border:1px solid #e2e8f0;">${size}</td><td style="padding:4px 12px;border:1px solid #e2e8f0;text-align:right;">${qty} çift</td></tr>`)
    .join('');

  const bomRows = order.product?.parts.map(part => {
    const kgRequired = (part.gramsPerPiece * (1 + part.wasteRate / 100) * order.totalPairs) / 1000;
    return `<tr>
      <td style="padding:4px 12px;border:1px solid #e2e8f0;">${part.name}</td>
      <td style="padding:4px 12px;border:1px solid #e2e8f0;">${part.material?.name ?? '—'}</td>
      <td style="padding:4px 12px;border:1px solid #e2e8f0;text-align:right;">${kgRequired.toFixed(3)} kg</td>
    </tr>`;
  }).join('') ?? '';

  const dueDateStr = order.dueDate
    ? new Date(order.dueDate).toLocaleDateString('tr-TR')
    : 'Belirtilmedi';

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#d97706;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;">Fason Sipariş Bildirimi</h2>
        <p style="color:#fef3c7;margin:4px 0 0;">Sipariş No: <strong>${order.orderNo}</strong></p>
      </div>
      <div style="padding:24px;background:#fff;">
        <p>Sayın <strong>${order.subcontractor.name}</strong>,</p>
        <p>Aşağıdaki fason siparişi sisteminize tanımlanmıştır.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;">Sipariş No</td><td style="padding:6px 12px;">${order.orderNo}</td></tr>
          <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;">Ürün</td><td style="padding:6px 12px;">${order.product?.name ?? '—'} ${order.product?.code ? `(${order.product.code})` : ''}</td></tr>
          <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;">Toplam Adet</td><td style="padding:6px 12px;">${order.totalPairs} çift</td></tr>
          <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;">Termin</td><td style="padding:6px 12px;">${dueDateStr}</td></tr>
        </table>
        <h3 style="color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Numara Dağılımı</h3>
        <table style="border-collapse:collapse;margin-bottom:16px;">
          <thead><tr><th style="padding:6px 12px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:left;">Numara</th><th style="padding:6px 12px;background:#f1f5f9;border:1px solid #e2e8f0;">Adet</th></tr></thead>
          <tbody>${sizeRows}</tbody>
        </table>
        ${bomRows ? `
        <h3 style="color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Gerekli Hammaddeler (BOM)</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <thead><tr>
            <th style="padding:6px 12px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:left;">Parça</th>
            <th style="padding:6px 12px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:left;">Hammadde</th>
            <th style="padding:6px 12px;background:#f1f5f9;border:1px solid #e2e8f0;">Gereken</th>
          </tr></thead>
          <tbody>${bomRows}</tbody>
        </table>
        ` : ''}
        ${order.notes ? `<p style="background:#fef9c3;padding:12px;border-radius:6px;"><strong>Not:</strong> ${order.notes}</p>` : ''}
        <p style="margin-top:24px;">
          <a href="${baseUrl}/portal/fason/orders/${order.id}" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Siparişi Portal'da Görüntüle</a>
        </p>
      </div>
    </div>
  `;

  await sendMail({
    to: order.subcontractor.email,
    subject: `Fason Sipariş — ${order.orderNo} | ${order.product?.name ?? ''} | Termin: ${dueDateStr}`,
    html,
  });

  await prisma.subcontractorOrder.update({
    where: { id: params.id },
    data: { emailSentAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
