import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const employee = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { date, type, description, amount, account, accountId } = body;

  if (!type || !amount) {
    return NextResponse.json({ error: 'type ve amount zorunlu' }, { status: 400 });
  }

  const amt = parseFloat(amount) || 0;
  const entryDate = date ? new Date(date) : new Date();

  // Muhasebe mantığı:
  // Hakediş / Prim = personel hak kazandı → credit (bakiye artar — borcumuz artar)
  // Maaş / Avans  = nakit ödeme → debit (bakiye düşer — borcumuz azalır)
  // Kesinti        = personel borçlandı → debit
  const isCashPayment = type === 'Maaş' || type === 'Avans';
  const isEarning     = type === 'Hakediş' || type === 'Prim';

  const creditAmt = isEarning ? amt : 0;
  const debitAmt  = (isCashPayment || type === 'Kesinti') ? amt : 0;

  let paymentId: string | null = null;

  // Kasa: Maaş / Avans → Payment kaydı oluştur + bakiye düş
  if (isCashPayment && accountId && amt > 0) {
    const payment = await prisma.payment.create({
      data: {
        companyId: user.companyId,
        type: 'PAID',
        accountId,
        amount: amt,
        currency: employee.currency || 'TRY',
        date: entryDate,
        method: 'Nakit',
        notes: `${type} — ${employee.name}${description ? ' — ' + description : ''}`,
      },
    });
    paymentId = payment.id;

    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: -amt } },
    });
  }

  const entry = await (prisma.personnelLedger as any).create({
    data: {
      companyId: user.companyId,
      employeeId: params.id,
      date: entryDate,
      type,
      description: description || type,
      debit: debitAmt,
      credit: creditAmt,
      account: account || null,
      paymentId,
      createdBy: user.name || user.email || 'Sistem',
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PersonnelLedger',
    entityId: entry.id,
    detail: `${type} — ${employee.name} — ${amt} TL`,
    ip: getIp(req),
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get('entryId');
  if (!entryId) return NextResponse.json({ error: 'entryId gerekli' }, { status: 400 });

  const entry = await (prisma.personnelLedger as any).findFirst({
    where: { id: entryId, employeeId: params.id, companyId: user.companyId },
  });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Eğer bağlı Payment varsa → sil + kasa bakiyesini geri yükle
  if (entry.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: entry.paymentId } });
    if (payment) {
      await prisma.payment.delete({ where: { id: entry.paymentId } });
      if (payment.accountId) {
        await prisma.account.update({
          where: { id: payment.accountId },
          data: { balance: { increment: payment.amount } },
        });
      }
    }
  }

  await (prisma.personnelLedger as any).delete({ where: { id: entryId } });

  return NextResponse.json({ ok: true });
}
