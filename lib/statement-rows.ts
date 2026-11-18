import { matchesText } from './search';

// Hesap ekstresi satırlarını oluşturan saf fonksiyonlar.
// İç ekstre sayfaları ve link ile paylaşılan ekstre sayfası aynı hesabı kullanır.

export type StatementRow = {
  id: string;
  date: string;
  dueDate?: string;
  hareket: string;
  belgeNo?: string;
  aciklama?: string;
  borc: number;
  alacak: number;
  bakiye: number;
  isSubRow?: boolean;
  parentId?: string; // alt satırın (fatura kalemi) bağlı olduğu fatura satırı
  miktar?: string;
  fiyat?: number;
  tutar?: number; // kalem tutarı (iskonto dahil)
  productCode?: string;
  extraInfo?: string; // çapraz döviz için
};

export type StatementResult = {
  rows: StatementRow[];
  totalBorc: number;
  totalAlacak: number;
  lastBalance: number;
};

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (d: unknown) => new Date(d as any).getTime();

function summarize(rows: StatementRow[]): StatementResult {
  const main = rows.filter(r => !r.isSubRow);
  return {
    rows,
    totalBorc: main.reduce((s, r) => s + r.borc, 0),
    totalAlacak: main.reduce((s, r) => s + r.alacak, 0),
    lastBalance: main.length > 0 ? main[main.length - 1].bakiye : 0,
  };
}

// Ödeme / fiş kayıtları (müşteri ve tedarikçide aynı kurallar). "normal" = Tahsilat ya da Ödeme.
function paymentRow(ev: any, balance: number, normal: string): { row: StatementRow; balance: number } {
  const method = ev.method || '';
  const notesStr: string = ev.notes || '';
  const base = { id: ev.id, date: ev.date };
  if (method === 'Borç Fişi' || method === 'Alacak Fişi') {
    const debit = method === 'Borç Fişi';
    balance += debit ? ev.amount : -ev.amount;
    return {
      balance,
      row: { ...base, hareket: method, aciklama: notesStr.replace(/^Vade:[^\s|]+\s*\|?\s*/, ''),
        borc: debit ? ev.amount : 0, alacak: debit ? 0 : ev.amount, bakiye: balance },
    };
  }
  if (method === 'Bakiye Düzeltme') {
    const debit = notesStr.startsWith('+');
    balance += debit ? ev.amount : -ev.amount;
    return {
      balance,
      row: { ...base, hareket: 'Bakiye Düzeltme', aciklama: notesStr.replace(/^[+-]\s*\|?\s*/, ''),
        borc: debit ? ev.amount : 0, alacak: debit ? 0 : ev.amount, bakiye: balance },
    };
  }
  balance -= ev.amount;
  return {
    balance,
    row: {
      ...base,
      hareket: matchesText(notesStr, 'iade') ? 'İade' : normal,
      aciklama: [method, notesStr && notesStr !== 'İade' ? notesStr : ''].filter(Boolean).join(' — '),
      borc: 0, alacak: ev.amount, bakiye: balance,
    },
  };
}

export function buildCustomerRows(data: any): StatementResult {
  const rows: StatementRow[] = [];
  if (!data || data.error) return summarize(rows);
  let balance = 0;
  const events: any[] = [
    ...(data.invoices || []).map((inv: any) => ({ ...inv, _type: 'invoice', _sortDate: inv.date })),
    ...(data.payments || []).map((p: any) => ({ ...p, _type: 'payment', _sortDate: p.date })),
    ...(data.cekler || []).map((c: any) => ({ ...c, _type: 'cek', _sortDate: c.islemTarihi })),
  ].sort((a, b) => (time(a._sortDate) - time(b._sortDate)) || (time(a.createdAt) - time(b.createdAt)));

  for (const ev of events) {
    if (ev._type === 'invoice') {
      if (ev.isReturn) {
        // İade faturası → alacak; eski kayıtlarda iade tutarı negatif saklanmış olabilir
        const amt = Math.abs(ev.total);
        balance -= amt;
        rows.push({ id: ev.id, date: ev.date, dueDate: ev.dueDate, hareket: 'İade', belgeNo: ev.invoiceNo,
          aciklama: ev.notes || '', borc: 0, alacak: amt, bakiye: balance });
      } else {
        balance += ev.total;
        rows.push({ id: ev.id, date: ev.date, dueDate: ev.dueDate, hareket: 'Satış', belgeNo: ev.invoiceNo,
          aciklama: ev.notes || '', borc: ev.total, alacak: 0, bakiye: balance });
        (ev.items || []).forEach((item: any, i: number) => {
          rows.push({
            id: `${ev.id}-item-${i}`,
            parentId: ev.id,
            date: ev.date,
            hareket: '',
            aciklama: item.description,
            miktar: item.quantity ? `${item.quantity.toLocaleString('tr-TR')}` : '',
            fiyat: item.unitPrice,
            tutar: item.total ?? undefined,
            productCode: item.product?.code || undefined,
            borc: 0,
            alacak: 0,
            bakiye: balance,
            isSubRow: true,
          });
        });
      }
    } else if (ev._type === 'payment') {
      const r = paymentRow(ev, balance, 'Tahsilat');
      balance = r.balance;
      rows.push(r.row);
    } else {
      // Çek: customerAmount varsa müşteri dövizindeki karşılığı, yoksa çek tutarı
      const amt = ev.customerAmount ?? ev.tutar;
      balance -= amt;
      rows.push({
        id: `cek-${ev.id}`,
        date: ev.islemTarihi,
        dueDate: ev.vadesi,
        hareket: 'Çek',
        belgeNo: ev.seriNo || undefined,
        aciklama: [ev.islem, ev.borclu, ev.bankasi, ev.seriNo].filter(Boolean).join(' — '),
        borc: 0,
        alacak: amt,
        bakiye: balance,
        extraInfo: ev.customerAmount ? `${fmt(ev.tutar)} ${ev.currency}` : undefined,
      });
    }
  }
  return summarize(rows);
}

export function buildSupplierRows(data: any): StatementResult {
  const rows: StatementRow[] = [];
  if (!data || data.error) return summarize(rows);
  let balance = 0;
  const events: any[] = [
    ...(data.purchases || []).map((p: any) => ({ ...p, _type: 'purchase' })),
    ...(data.payments || []).map((p: any) => ({ ...p, _type: 'payment' })),
  ].sort((a, b) => (time(a.date) - time(b.date)) || (time(a.createdAt) - time(b.createdAt)));

  for (const ev of events) {
    if (ev._type === 'purchase') {
      // Tedarikçiye mal iadesi borcu azaltır
      const amt = ev.isReturn ? Math.abs(ev.total) : ev.total;
      balance += ev.isReturn ? -amt : amt;
      rows.push({
        id: ev.id, date: ev.date, hareket: ev.isReturn ? 'Alış İadesi' : 'Alış', belgeNo: ev.invoiceNo,
        aciklama: ev.notes || '', borc: ev.isReturn ? 0 : amt, alacak: ev.isReturn ? amt : 0, bakiye: balance,
      });
      if (Array.isArray(ev.items)) {
        ev.items.forEach((item: any, i: number) => {
          rows.push({
            id: `${ev.id}-item-${i}`,
            parentId: ev.id,
            date: ev.date,
            hareket: '',
            aciklama: item.description || item.material?.name || '',
            miktar: item.quantity ? `${item.quantity.toLocaleString('tr-TR')}` : '',
            fiyat: item.unitPrice ?? undefined,
            tutar: item.total ?? undefined,
            productCode: item.product?.code || undefined,
            borc: 0,
            alacak: 0,
            bakiye: balance,
            isSubRow: true,
          });
        });
      }
    } else {
      const r = paymentRow(ev, balance, 'Ödeme');
      balance = r.balance;
      rows.push(r.row);
    }
  }
  return summarize(rows);
}
