export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const { name, language, currency } = body ?? {};

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name ? { name } : {}),
        ...(language ? { language } : {}),
        ...(currency ? { currency } : {}),
      },
    });

    return NextResponse.json({ name: updated.name, language: updated.language, currency: updated.currency });
  } catch (error: any) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
