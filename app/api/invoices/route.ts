import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: user.companyId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { items = [], ...rest } = body;

  const subtotal = items.reduce((s: number, i: any) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const vatRate = parseFloat(rest.vatRate) || 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const now = new Date();
  const invoiceNo = rest.invoiceNo || `FTR-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;

  const invoice = await prisma.invoice.create({
    data: {
      companyId: user.companyId,
      customerId: rest.customerId,
      invoiceNo,
      date: new Date(rest.date || now),
      dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
      currency: rest.currency || 'USD',
      subtotal,
      vatRate,
      vatAmount,
      total,
      paidAmount: 0,
      status: 'PENDING',
      notes: rest.notes || null,
      items: {
        create: items.map((i: any) => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 0,
          unitPrice: parseFloat(i.unitPrice) || 0,
          total: (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0),
        })),
      },
    },
    include: { items: true, customer: true },
  });
  return NextResponse.json(invoice);
}
