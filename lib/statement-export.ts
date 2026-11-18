import { formatDate } from '@/lib/time';
import type { StatementRow, StatementResult } from '@/lib/statement-rows';

// Hesap ekstresi dışa aktarımı (CSV ve PDF). İç ekstre sayfaları ve paylaşılan ekstre ortak kullanır.

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// jsPDF'in yerleşik yazı tipi Türkçe karakter içermediği için karşılıklarına çevrilir
const ascii = (s: string) => (s || '').replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
  .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I')
  .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');

export type StatementExportInput = StatementResult & {
  partyName: string;
  currency: string;
  from: string; // yyyy-mm-dd
  to: string;
  /** Vade, miktar, fiyat sütunları ve kalem satırları */
  detailed: boolean;
  /** Başlık şeridi rengi (RGB) */
  color: [number, number, number];
  /** Paylaşılan ekstrede gönderen firma bilgisi */
  company?: { name: string; phone?: string | null; address?: string | null; taxId?: string | null } | null;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const describe = (r: StatementRow) => (r.productCode ? `[${r.productCode}] ` : '') + (r.aciklama || '');

export function exportStatementCsv(p: StatementExportInput) {
  const cur = p.currency;
  const money = [`Borç (${cur})`, `Alacak (${cur})`, `Bakiye (${cur})`];
  const header = p.detailed
    ? ['Tarih', 'Vade', 'Hareket', 'Belge No', 'Açıklama', 'Miktar', 'Fiyat', ...money]
    : ['Tarih', 'Hareket', 'Belge No', 'Açıklama', ...money];
  const lines = p.rows.map(r => {
    const tail = [r.borc > 0 ? fmt(r.borc) : '', r.alacak > 0 ? fmt(r.alacak) : '', !r.isSubRow ? fmt(r.bakiye) : ''];
    return (p.detailed
      ? [formatDate(r.date), r.dueDate ? formatDate(r.dueDate) : '', r.hareket, r.belgeNo || '', describe(r),
         r.miktar || '', r.fiyat != null ? fmt(r.fiyat) : '', ...tail]
      : [formatDate(r.date), r.hareket, r.belgeNo || '', r.aciklama || '', ...tail]
    ).map(v => String(v).replace(/[;\r\n]+/g, ' ')).join(';');
  });
  const blob = new Blob(['﻿' + header.join(';') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  download(blob, `${p.partyName || 'ekstre'}_hesap_ekstresi.csv`);
}

export async function exportStatementPdf(p: StatementExportInput) {
  const { default: jsPDF } = await import('jspdf');
  const cur = p.currency;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297; const M = 10;

  doc.setFillColor(...p.color);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(ascii(`${p.partyName} - HESAP EKSTRESI`), M, 11);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`${formatDate(p.from)} - ${formatDate(p.to)}`, W - M, 11, { align: 'right' });
  let y = 26;

  if (p.company) {
    doc.setTextColor(30, 30, 30); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(ascii(p.company.name), M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
    const info = [p.company.phone && `Tel: ${p.company.phone}`, p.company.taxId && `VKN: ${p.company.taxId}`, p.company.address]
      .filter(Boolean).join('  |  ');
    if (info) doc.text(ascii(info).substring(0, 180), M, y + 4.5);
    y += 12;
  }

  doc.setTextColor(30, 30, 30); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  const money = [`Borc ${cur}`, `Alacak ${cur}`, `Bakiye ${cur}`];
  const cols = p.detailed ? [20, 20, 22, 26, 70, 16, 20, 27, 27, 29] : [22, 24, 30, 95, 33, 33, 40];
  const headers = p.detailed
    ? ['Tarih', 'Vade', 'Hareket', 'Belge No', 'Aciklama', 'Miktar', 'Fiyat', ...money]
    : ['Tarih', 'Hareket', 'Belge No', 'Aciklama', ...money];
  const descMax = p.detailed ? 42 : 60;
  let x = M;
  doc.setFillColor(241, 245, 249); doc.rect(M, y - 4, W - 2 * M, 7, 'F');
  headers.forEach((h, i) => { doc.text(h, x + 1, y); x += cols[i]; });
  y += 5; doc.setFont('helvetica', 'normal');

  for (const r of p.rows) {
    if (y > 190) { doc.addPage(); y = 15; }
    if (r.isSubRow) { doc.setFillColor(255, 251, 235); doc.rect(M, y - 3.5, W - 2 * M, 6, 'F'); }
    const tail = [r.borc > 0 ? fmt(r.borc) : '', r.alacak > 0 ? fmt(r.alacak) : '', !r.isSubRow ? fmt(r.bakiye) : ''];
    const vals = p.detailed
      ? [r.isSubRow ? '' : formatDate(r.date), r.dueDate ? formatDate(r.dueDate) : '', ascii(r.hareket || ''), ascii(r.belgeNo || ''),
         ascii(describe(r)).substring(0, descMax), ascii(r.miktar || ''), r.fiyat != null ? fmt(r.fiyat) : '', ...tail]
      : [formatDate(r.date), ascii(r.hareket), ascii(r.belgeNo || ''), ascii(r.aciklama || '').substring(0, descMax), ...tail];
    x = M;
    vals.forEach((v, i) => { doc.text(String(v), x + 1, y); x += cols[i]; });
    doc.setDrawColor(230, 230, 230); doc.line(M, y + 2, W - M, y + 2);
    y += 6;
  }

  y += 4;
  if (y > 200) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.text(`Toplam Borc: ${fmt(p.totalBorc)} ${cur}  |  Toplam Alacak: ${fmt(p.totalAlacak)} ${cur}  |  Bakiye: ${fmt(p.lastBalance)} ${cur}`, M, y);
  doc.save(`${ascii(p.partyName || 'ekstre')}_hesap_ekstresi.pdf`);
}
