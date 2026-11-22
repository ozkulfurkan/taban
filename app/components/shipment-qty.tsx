'use client';

// Sevk edilen miktar tablosu: sipariş edilen / sevk edilen / fark (satıcı ve alıcı ekranları)
import DecimalInput from '@/app/components/decimal-input';
import { formatQty, unitDecimals } from '@/lib/order-units';
import { formatDiff, shipDiff, type ShipLine, type ShippedLine } from '@/lib/shipment';

const diffClass = (ordered: number, shipped: number) => {
  const { diff } = shipDiff(ordered, shipped);
  return diff === 0 ? 'text-ink-400' : diff > 0 ? 'text-brand-700' : 'text-amber-600';
};

export function ShippedTable({ items, testId }: { items: ShippedLine[]; testId?: string }) {
  const total = (k: 'ordered' | 'shipped') => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const sameUnit = new Set(items.map(i => i.unit)).size === 1;
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-ink-400 uppercase">
          <th className="py-1.5">Ürün</th><th className="text-right">Sipariş</th><th className="text-right">Sevk edilen</th><th className="text-right">Fark</th>
        </tr></thead>
        <tbody className="divide-y divide-ink-100">
          {items.map(i => (
            <tr key={i.index}>
              <td className="py-2 text-ink-700">{[i.productCode, i.productName].filter(Boolean).join(' · ') || '—'}</td>
              <td className="text-right text-ink-500 whitespace-nowrap">{formatQty(i.ordered, i.unit)}</td>
              <td className="text-right font-semibold text-ink-800 whitespace-nowrap">{formatQty(i.shipped, i.unit)}</td>
              <td className={`text-right text-xs font-medium whitespace-nowrap ${diffClass(i.ordered, i.shipped)}`}>{formatDiff(i.ordered, i.shipped, i.unit) || 'tam'}</td>
            </tr>
          ))}
          {items.length > 1 && sameUnit && (
            <tr className="font-semibold">
              <td className="py-2 text-ink-600">Toplam</td>
              <td className="text-right text-ink-500 whitespace-nowrap">{formatQty(total('ordered'), items[0].unit)}</td>
              <td className="text-right text-ink-800 whitespace-nowrap">{formatQty(total('shipped'), items[0].unit)}</td>
              <td className={`text-right text-xs whitespace-nowrap ${diffClass(total('ordered'), total('shipped'))}`}>{formatDiff(total('ordered'), total('shipped'), items[0].unit) || 'tam'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Sevkiyat formunda kalem başına sevk edilen miktar girişi; boş bırakılırsa sipariş miktarı */
export function ShipQtyInputs({ lines, value, onChange }: {
  lines: ShipLine[]; value: Record<number, string>; onChange: (v: Record<number, string>) => void;
}) {
  return (
    <div className="space-y-2" data-testid="ship-qty">
      <p className="text-xs font-medium text-ink-500">Sevk edilen miktar</p>
      {lines.map(l => {
        const raw = value[l.index];
        const shipped = raw === undefined || raw === '' ? l.ordered : Number(raw);
        const diff = Number.isFinite(shipped) ? formatDiff(l.ordered, shipped, l.unit) : '';
        return (
          <div key={l.index} className="flex items-center gap-2 flex-wrap">
            <span className="flex-1 min-w-[140px] text-sm text-ink-700 truncate">{[l.productCode, l.productName].filter(Boolean).join(' · ') || 'Ürün'}</span>
            <span className="text-xs text-ink-400 whitespace-nowrap">Sipariş {formatQty(l.ordered, l.unit)}</span>
            <DecimalInput
              value={raw ?? ''}
              onChange={e => onChange({ ...value, [l.index]: e.target.value })}
              integer={!unitDecimals(l.unit)}
              placeholder={String(l.ordered).replace('.', ',')}
              data-testid={`ship-qty-${l.index}`}
              className="w-28 px-2 py-1.5 border border-ink-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <span className="text-xs text-ink-500 w-8">{l.unit}</span>
            <span className={`text-xs font-medium w-28 text-right ${diffClass(l.ordered, Number.isFinite(shipped) ? shipped : l.ordered)}`}>{diff || ' '}</span>
          </div>
        );
      })}
      <p className="text-xs text-ink-400">Boş bırakılan kalem sipariş miktarı kadar sevk edilmiş sayılır. Fatura sevk edilen miktarla oluşur.</p>
    </div>
  );
}
