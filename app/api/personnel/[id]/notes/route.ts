import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  try {
    const notes = await (prisma.personnelNote as any).findMany({
      where: { employeeId: params.id, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch (err: any) {
    console.error('[GET /api/personnel/:id/notes]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { content } = body;
  if (!content?.trim()) return NextResponse.json({ error: 'İçerik boş olamaz' }, { status: 400 });

  try {
    const note = await (prisma.personnelNote as any).create({
      data: {
        companyId: user.companyId,
        employeeId: params.id,
        content: content.trim(),
        createdBy: user.name || user.email || 'Sistem',
      },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/personnel/:id/notes]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}
