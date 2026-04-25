import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const headers = [
    'Müşteri Adı',
    'Para Birimi',
    'Başlangıç Bakiyesi',
    'Vergi Kimlik No',
    'Vergi Dairesi',
    'Telefon',
    'Adres',
    'E-posta',
    'Notlar',
  ];

  const example = [
    'Örnek Firma A.Ş.',
    'TRY',
    '1500.00',
    '1234567890',
    'Kadıköy VD',
    '05551234567',
    'Kadıköy, İstanbul',
    'info@ornekfirma.com',
    '',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 35 }, { wch: 28 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Müşteriler');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="musteri_import_sablonu.xlsx"',
    },
  });
}
