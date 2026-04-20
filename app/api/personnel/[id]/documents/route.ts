import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([], { status: 200 });

  const docs = await (prisma.personnelDocument as any).findMany({
    where: { employeeId: params.id, companyId: user.companyId },
    select: { id: true, name: true, docType: true, size: true, mimeType: true, createdBy: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const employee = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const docType = (formData.get('docType') as string) || 'Diğer';

  if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Dosya 5 MB sınırını aşıyor' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const doc = await (prisma.personnelDocument as any).create({
    data: {
      companyId: user.companyId,
      employeeId: params.id,
      name: file.name,
      docType,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      data: buffer,
      createdBy: user.name || user.email || 'Sistem',
    },
    select: { id: true, name: true, docType: true, size: true, mimeType: true, createdBy: true, createdAt: true },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PersonnelDocument',
    entityId: doc.id,
    detail: `Evrak yüklendi — ${employee.name} — ${file.name}`,
    ip: getIp(req),
  });

  return NextResponse.json(doc, { status: 201 });
}
