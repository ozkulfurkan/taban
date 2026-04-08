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
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) return NextResponse.json({ error: 'Excel dosyası boş' }, { status: 400 });

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row number (1=header, 2=first data row)

    const name = String(row['Müşteri Adı'] ?? '').trim();
    const currency = String(row['Para Birimi'] ?? '').trim().toUpperCase();

    if (!name) {
      results.errors.push(`Satır ${rowNum}: Müşteri Adı zorunludur`);
      results.skipped++;
      continue;
    }
    if (!VALID_CURRENCIES.includes(currency)) {
      results.errors.push(`Satır ${rowNum} (${name}): Para Birimi geçersiz — TRY, USD veya EUR olmalı`);
      results.skipped++;
      continue;
    }

    const taxId = String(row['Vergi Kimlik No'] ?? '').trim() || null;
    const taxOffice = String(row['Vergi Dairesi'] ?? '').trim() || null;
    const phone = String(row['Telefon'] ?? '').trim() || null;
    const address = String(row['Adres'] ?? '').trim() || null;
    const email = String(row['E-posta'] ?? '').trim() || null;
    const notes = String(row['Notlar'] ?? '').trim() || null;

    try {
      await prisma.customer.create({
        data: {
          companyId: user.companyId,
          name,
          currency,
          taxId,
          taxOffice,
          phone,
          address,
          email,
          notes,
        },
      });
      results.created++;
    } catch (err: any) {
      results.errors.push(`Satır ${rowNum} (${name}): Kaydedilemedi`);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}
