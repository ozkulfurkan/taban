import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const headers = [
    'Tedarikçi Adı',
    'Para Birimi',
    'Başlangıç Bakiyesi',
    'Vergi Kimlik No',
    'Telefon',
    'Adres',
    'E-posta',
    'Notlar',
  ];

  const example = [
    'Örnek Tedarikçi Ltd.',
    'USD',
    '2000.00',
    '9876543210',
    '05329876543',
    'Organize Sanayi, Bursa',
    'info@ornek.com',
    '',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
    { wch: 16 }, { wch: 35 }, { wch: 28 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tedarikçiler');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tedarikci_import_sablonu.xlsx"',
    },
  });
}
