import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

function canManage(role: string) {
  return role === 'ADMIN' || role === 'COMPANY_OWNER';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
    select: {
      id: true, name: true, email: true, role: true,
      allowedPages: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role, allowedPages } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email ve şifre zorunlu' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Bu e-posta zaten kullanımda' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: role || 'EDITOR',
      allowedPages: allowedPages || [],
      companyId: user.companyId,
    },
    select: { id: true, name: true, email: true, role: true, allowedPages: true, createdAt: true },
  });

  return NextResponse.json(newUser, { status: 201 });
}
