export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ exists: false, emailVerified: false });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  if (!user) return NextResponse.json({ exists: false, emailVerified: false });
  return NextResponse.json({ exists: true, emailVerified: user.emailVerified });
}
