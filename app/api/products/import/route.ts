import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

const VALID_CURRENCIES = ['TRY', 'USD', 'EUR'];

export async function GET() {
  // Şablon Excel indir
  const wb = XLSX.utils.book_new();
  const data = [
    ['Ürün Kodu', 'Ürün Adı', 'Birim Fiyat', 'Stok', 'Birim', 'Para Birimi'],
    ['GRN-001', '701 Krep Termogranül', 85, 500, 'kg', 'TRY'],
    ['GRN-002', 'Siyah Taban Granülü', 72, 250, 'kg', 'TRY'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="urun-import-sablonu.xlsx"',
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) return NextResponse.json({ error: 'Excel dosyası boş' }, { status: 400 });

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const code = String(row['Ürün Kodu'] ?? '').trim() || null;
    const name = String(row['Ürün Adı'] ?? '').trim();

    if (!name) {
      results.errors.push(`Satır ${rowNum}: Ürün Adı zorunludur`);
      results.skipped++;
      continue;
    }

    const rawPrice = row['Birim Fiyat'];
    const unitPrice = rawPrice !== '' && rawPrice != null ? Number(rawPrice) : 0;
    const rawStock = row['Stok'];
    const stock = rawStock !== '' && rawStock != null ? Number(rawStock) : 0;
    const unit = String(row['Birim'] ?? '').trim() || (user.companyType === 'MATERIAL_SUPPLIER' ? 'kg' : 'çift');
    const rawCurrency = String(row['Para Birimi'] ?? '').trim().toUpperCase();
    const currency = VALID_CURRENCIES.includes(rawCurrency) ? rawCurrency : 'TRY';

    if (isNaN(unitPrice) || isNaN(stock)) {
      results.errors.push(`Satır ${rowNum} (${name}): Birim Fiyat veya Stok sayısal değil`);
      results.skipped++;
      continue;
    }

    try {
      if (code) {
        const existing = await prisma.product.findFirst({
          where: { companyId: user.companyId, code },
        });
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { name, unitPrice, stock, unit, currency },
          });
          results.updated++;
          continue;
        }
      }

      await prisma.product.create({
        data: { companyId: user.companyId, code, name, unitPrice, stock, unit, currency },
      });
      results.created++;
    } catch {
      results.errors.push(`Satır ${rowNum} (${name}): Kaydedilemedi`);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}
