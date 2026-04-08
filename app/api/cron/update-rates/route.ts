export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // Vercel Cron Jobs sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: { Accept: 'application/xml' },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`TCMB responded ${res.status}`);

    const xml = await res.text();

    const parse = (code: string): number | null => {
      const re = new RegExp(
        `CurrencyCode="${code}"[^>]*>[\\s\\S]*?<ForexSelling>([\\d.]+)<\\/ForexSelling>`
      );
      const m = xml.match(re);
      return m ? parseFloat(m[1]) : null;
    };

    const usd = parse('USD');
    const eur = parse('EUR');

    if (!usd || !eur) throw new Error('Could not parse rates from TCMB response');

    // Update all companies
    await prisma.company.updateMany({
      data: { usdToTry: usd, eurToTry: eur },
    });

    const dateMatch = xml.match(/Date="([^"]+)"/);

    return NextResponse.json({
      ok: true,
      usd,
      eur,
      tcmbDate: dateMatch?.[1] ?? null,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('Cron update-rates error:', e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
