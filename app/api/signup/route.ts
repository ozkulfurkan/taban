export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, companyName } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const trialEnd = new Date();
    trialEnd.setFullYear(trialEnd.getFullYear() + 1);

    const company = await prisma.company.create({
      data: {
        name: companyName || `${name || email}'s Company`,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: trialEnd,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email?.split?.('@')?.[0] || 'User',
        role: 'COMPANY_OWNER',
        companyId: company.id,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error?.message ?? 'Internal error' }, { status: 500 });
  }
}
