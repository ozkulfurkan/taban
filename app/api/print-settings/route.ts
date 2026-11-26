export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hasFullAccess } from '@/lib/access';
import { DEFAULT_FIELDS, FIELD_LABELS, normalizePrintConfig, type FieldKey } from '@/lib/dispatch-print-html';

async function staff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return user?.companyId && user.type !== 'portal' ? user : null;
}

// Yazdırma ayarları: okuma tüm firma kullanıcılarına (yazdırırken gerekir), değiştirme yönetici ya da Ayarlar izni olana
export async function GET() {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.printSettings.findUnique({ where: { companyId: user.companyId } });
  return NextResponse.json({ ...normalizePrintConfig(s as any), postByDefault: s?.postByDefault ?? true, fieldPositions: { ...DEFAULT_FIELDS, ...((s?.fieldPositions as any) ?? {}) } });
}

export async function PUT(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasFullAccess(user) && !(user.allowedPages ?? []).includes('settings')) return NextResponse.json({ error: 'Bu ayarı değiştirme yetkiniz yok' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const c = normalizePrintConfig(body);
  const fp: Record<string, { x: number; y: number }> = {};
  for (const k of Object.keys(FIELD_LABELS) as FieldKey[]) {
    const v = body?.fieldPositions?.[k];
    const x = Number(v?.x), y = Number(v?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) fp[k] = { x: Math.max(0, Math.min(600, x)), y: Math.max(0, Math.min(600, y)) };
  }
  const data = {
    paper: c.paper, widthMm: c.widthMm, heightMm: c.heightMm,
    marginTopMm: c.marginTopMm, marginRightMm: c.marginRightMm, marginBottomMm: c.marginBottomMm, marginLeftMm: c.marginLeftMm,
    fontSizePt: c.fontSizePt, lineHeightMm: c.lineHeightMm, maxLines: c.maxLines, mode: c.mode, fieldPositions: fp,
    showPrices: c.showPrices, copies: c.copies, postByDefault: body?.postByDefault !== false,
  };
  const s = await prisma.printSettings.upsert({ where: { companyId: user.companyId }, update: data, create: { companyId: user.companyId, ...data } });
  return NextResponse.json(s);
}
