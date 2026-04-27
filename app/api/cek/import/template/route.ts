import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const headers = ['Müşteri Adı', 'Vadesi', 'Çek No', 'Bankası', 'Tutar', 'Para Birimi'];

  const example = [
    'Örnek Firma A.Ş.',
    '31.12.2025',
    '123456789',
    'Ziraat Bankası',
    '10000.00',
    'TRY',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Çekler');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="cek_import_sablonu.xlsx"',
    },
  });
}
