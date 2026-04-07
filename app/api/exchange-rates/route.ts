export const dynamic = 'force-dynamic';
// Cache for 1 hour — TCMB publishes once per business day
export const revalidate = 3600;

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      next: { revalidate: 3600 },
      headers: { 'Accept': 'application/xml' },
    });

    if (!res.ok) throw new Error(`TCMB responded ${res.status}`);

    const xml = await res.text();

    const parse = (code: string) => {
      const re = new RegExp(`CurrencyCode="${code}"[^>]*>[\\s\\S]*?<ForexSelling>([\\d.]+)<\\/ForexSelling>`);
      const m = xml.match(re);
      return m ? parseFloat(m[1]) : null;
    };

    const dateMatch = xml.match(/Date="([^"]+)"/);

    return NextResponse.json({
      usd: parse('USD'),
      eur: parse('EUR'),
      date: dateMatch ? dateMatch[1] : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
