import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

async function getInvoice(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, name: true, taxId: true, email: true, phone: true } },
      items: true,
      payments: { orderBy: { date: 'desc' } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const invoice = await getInvoice(params.id, user.companyId);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.invoice.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { items, ...rest } = body;

  let updateData: any = {
    customerId: rest.customerId ?? existing.customerId,
    invoiceNo: rest.invoiceNo ?? existing.invoiceNo,
    date: rest.date ? new Date(rest.date) : existing.date,
    dueDate: rest.dueDate ? new Date(rest.dueDate) : existing.dueDate,
    currency: rest.currency ?? existing.currency,
    notes: rest.notes !== undefined ? rest.notes : existing.notes,
    status: rest.status ?? existing.status,
  };

  if (items) {
    const subtotal = items.reduce((s: number, i: any) => {
      const qty = parseFloat(i.quantity) || 0;
      const price = parseFloat(i.unitPrice) || 0;
      const disc = parseFloat(i.discount) || 0;
      return s + qty * price * (1 - disc / 100);
    }, 0);
    const vatRate = parseFloat(rest.vatRate) ?? existing.vatRate;
    const vatAmount = subtotal * vatRate / 100;
    const total = subtotal + vatAmount;
    updateData = { ...updateData, subtotal, vatRate, vatAmount, total };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      await tx.invoiceItem.createMany({
        data: items.map((i: any) => {
          const qty = parseFloat(i.quantity) || 0;
          const price = parseFloat(i.unitPrice) || 0;
          const disc = parseFloat(i.discount) || 0;
          return {
            invoiceId: params.id,
            description: i.description,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            total: qty * price * (1 - disc / 100),
            notes: i.notes || null,
          };
        }),
      });
    }
    return tx.invoice.update({
      where: { id: params.id },
      data: updateData,
      include: { items: true, customer: true, payments: true },
    });
  });

  return NextResponse.json(invoice);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.invoice.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { invoiceId: params.id } }),
    prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } }),
    prisma.invoice.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
