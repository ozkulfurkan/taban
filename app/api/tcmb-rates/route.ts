import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 3600 }, // cache 1 hour
    });
    if (!res.ok) throw new Error('TCMB fetch failed');
    const xml = await res.text();

    const extract = (code: string, field: string): number => {
      const currencyMatch = xml.match(new RegExp(`CurrencyCode="${code}"[\\s\\S]*?<${field}>([\\d.]+)<\/${field}>`));
      return currencyMatch ? parseFloat(currencyMatch[1]) : 0;
    };

    const usd = extract('USD', 'ForexSelling');
    const eur = extract('EUR', 'ForexSelling');

    if (!usd || !eur) throw new Error('Could not parse rates');

    return NextResponse.json({ usd, eur });
  } catch {
    return NextResponse.json({ error: 'TCMB kurları alınamadı' }, { status: 502 });
  }
}
