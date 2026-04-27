import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

const VALID_CURRENCIES = ['TRY', 'USD', 'EUR'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) return NextResponse.json({ error: 'Excel dosyası boş' }, { status: 400 });

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const borclu = String(row['Müşteri Adı'] ?? '').trim();
    if (!borclu) {
      results.errors.push(`Satır ${rowNum}: Müşteri Adı zorunludur`);
      results.skipped++;
      continue;
    }

    // Parse vade date — Excel may give Date object, serial number, or string
    let vadesi: Date;
    const vadesRaw = row['Vadesi'];
    if (vadesRaw instanceof Date) {
      vadesi = vadesRaw;
    } else if (typeof vadesRaw === 'number') {
      vadesi = new Date((vadesRaw - 25569) * 86400 * 1000);
    } else {
      vadesi = new Date(String(vadesRaw));
    }
    if (isNaN(vadesi.getTime())) {
      results.errors.push(`Satır ${rowNum} (${borclu}): Geçersiz vade tarihi — GG.AA.YYYY formatında girin`);
      results.skipped++;
      continue;
    }

    const tutar = parseFloat(String(row['Tutar'] ?? '').toString().replace(',', '.'));
    if (isNaN(tutar) || tutar <= 0) {
      results.errors.push(`Satır ${rowNum} (${borclu}): Geçersiz tutar`);
      results.skipped++;
      continue;
    }

    const seriNo = String(row['Çek No'] ?? '').trim() || null;
    const bankasi = String(row['Bankası'] ?? '').trim() || null;
    const currencyRaw = String(row['Para Birimi'] ?? 'TRY').trim().toUpperCase();
    const currency = VALID_CURRENCIES.includes(currencyRaw) ? currencyRaw : 'TRY';

    try {
      await prisma.cek.create({
        data: {
          companyId: user.companyId,
          borclu,
          vadesi,
          tutar,
          currency,
          seriNo,
          bankasi,
          customerId: null,
          supplierId: null,
          islem: 'İçeri Aktarılan Çek',
          durum: 'PORTFOY',
        },
      });
      results.created++;
    } catch {
      results.errors.push(`Satır ${rowNum} (${borclu}): Kaydedilemedi`);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}
