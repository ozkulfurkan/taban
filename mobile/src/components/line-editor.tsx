import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { isPurchaseKind, lineKey, type DocKind, type FormLine, type LineType } from '@/core/documents';
import { money } from '@/core/format';
import { useTheme } from '@/hooks/use-theme';
import { lineTotal } from '@shared/money';
import { Picker, type PickerItem } from './picker';
import { Button, Card, Field, Segmented, T } from './ui';

export type Catalog = {
  products: { id: string; name: string; code?: string | null; unit?: string | null; unitPrice?: number | null; currency?: string | null; stock?: number | null }[];
  materials: { id: string; name: string; pricePerKg?: number | null; currency?: string | null; stock?: number | null }[];
  /** Müşteriye özel fiyatlar (productId → fiyat) */
  specialPrices: Record<string, { unitPrice: number; currency: string }>;
  loading: boolean;
};

/** Kalem ekleme / düzenleme penceresi. Ürün seçilince fiyat önerilir (müşteri fiyatı > katalog fiyatı). */
export function LineEditor({ kind, currency, initial, catalog, onSave, onClose }: {
  kind: DocKind; currency: string; initial: FormLine | null; catalog: Catalog;
  onSave: (l: FormLine) => void; onClose: () => void;
}) {
  const c = useTheme();
  const purchase = isPurchaseKind(kind);
  const types: { value: LineType; label: string }[] = purchase
    ? [{ value: 'material', label: 'Hammadde' }, { value: 'product', label: 'Ürün' }]
    : [{ value: 'product', label: 'Ürün' }, { value: 'free', label: 'Serbest' }];
  const [line, setLine] = useState<FormLine>(() => initial ?? {
    key: lineKey(), type: purchase ? 'material' : 'product', description: '', quantity: '', unitPrice: '', discount: '0',
  });
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<FormLine>) => setLine(l => ({ ...l, ...patch }));

  const items: PickerItem[] = line.type === 'material'
    ? catalog.materials.map(m => ({
        id: m.id, title: m.name, subtitle: m.stock != null ? `Stok ${formatAmountInput(String(Math.round(m.stock * 100) / 100))} kg` : undefined,
        right: m.pricePerKg != null ? money(m.pricePerKg, m.currency || '') : undefined,
      }))
    : catalog.products.map(p => {
        const sp = catalog.specialPrices[p.id];
        return {
          id: p.id, title: p.name, subtitle: [p.code, p.stock != null ? `Stok ${p.stock} ${p.unit || ''}` : null].filter(Boolean).join(' · ') || undefined,
          right: sp ? money(sp.unitPrice, sp.currency) : p.unitPrice != null ? money(p.unitPrice, p.currency || '') : undefined,
          search: p.code ?? undefined,
        };
      });

  const pick = (id: string) => {
    setPicking(false);
    if (line.type === 'material') {
      const m = catalog.materials.find(x => x.id === id)!;
      const price = m.pricePerKg != null && (!m.currency || m.currency === currency) ? m.pricePerKg : null;
      set({ materialId: id, productId: undefined, description: m.name, code: undefined, unitPrice: price != null ? formatAmountInput(String(price), 4) : line.unitPrice });
    } else {
      const p = catalog.products.find(x => x.id === id)!;
      const sp = !purchase ? catalog.specialPrices[id] : undefined;
      const price = sp && sp.currency === currency ? sp.unitPrice : p.unitPrice != null && p.currency === currency ? p.unitPrice : null;
      set({ productId: id, materialId: undefined, description: p.name, code: p.code ?? undefined, unitPrice: price != null ? formatAmountInput(String(price), 4) : line.unitPrice });
    }
  };

  const selected = line.type === 'material'
    ? catalog.materials.find(m => m.id === line.materialId)
    : catalog.products.find(p => p.id === line.productId);
  const catalogCurrency = selected?.currency;
  const total = lineTotal({ quantity: parseAmountInput(line.quantity), unitPrice: parseAmountInput(line.unitPrice), discount: parseAmountInput(line.discount) });

  const save = () => {
    if (line.type !== 'free' && !(line.productId || line.materialId)) return setError(line.type === 'material' ? 'Hammadde seçin.' : 'Ürün seçin.');
    if (!line.description.trim()) return setError('Açıklama girin.');
    if (!(parseAmountInput(line.quantity) > 0)) return setError('Miktar girin.');
    const d = parseAmountInput(line.discount);
    if (d < 0 || d > 100) return setError('İskonto %0 ile %100 arasında olmalı.');
    onSave(line);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button"><T color={c.primary}>Vazgeç</T></Pressable>
          <T variant="heading">{initial ? 'Kalemi düzenle' : 'Kalem ekle'}</T>
          <Pressable onPress={save} hitSlop={12} accessibilityRole="button" testID="line-save-top"><T color={c.primary} style={{ fontWeight: '700' }}>Tamam</T></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <Segmented
            value={line.type}
            onChange={t => setLine(l => ({ ...l, type: t, productId: undefined, materialId: undefined, code: undefined, description: t === 'free' ? l.description : '' }))}
            options={types}
          />

          {line.type !== 'free' ? (
            <Card onPress={() => setPicking(true)} testID="line-pick">
              <T variant="label">{line.type === 'material' ? 'Hammadde' : 'Ürün'}</T>
              <T style={{ fontWeight: '600' }} color={selected ? c.text : c.primary}>
                {selected ? `${line.code ? `[${line.code}] ` : ''}${line.description}` : 'Seçmek için dokunun'}
              </T>
            </Card>
          ) : null}

          <Field label="Açıklama" value={line.description} onChangeText={v => set({ description: v })} testID="line-desc" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label={line.type === 'material' ? 'Miktar (kg)' : 'Miktar'} value={line.quantity} keyboardType="decimal-pad"
                onChangeText={v => set({ quantity: formatAmountInput(v, 3) })} placeholder="0" testID="line-qty" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={`${line.type === 'material' ? 'Kg fiyatı' : 'Birim fiyat'} (${currency})`} value={line.unitPrice} keyboardType="decimal-pad"
                onChangeText={v => set({ unitPrice: formatAmountInput(v, 4) })} placeholder="0,00" testID="line-price" />
            </View>
          </View>
          {selected && catalogCurrency && catalogCurrency !== currency && !(line.productId && catalog.specialPrices[line.productId]) ? (
            <T variant="small" color={c.warning}>Katalog fiyatı {catalogCurrency} cinsinden; {currency} fiyatı elle girin.</T>
          ) : null}
          {line.productId && !purchase && catalog.specialPrices[line.productId] ? (
            <T variant="small" color={c.success}>Müşteriye özel fiyat uygulandı.</T>
          ) : null}
          {!purchase ? (
            <Field label="İskonto (%)" value={line.discount} keyboardType="decimal-pad" onChangeText={v => set({ discount: formatAmountInput(v) })} />
          ) : null}

          <Card style={styles.total}>
            <T variant="label">Kalem tutarı</T>
            <T variant="money">{money(total, currency)}</T>
          </Card>
          {error ? <T color={c.danger} testID="line-error">{error}</T> : null}
          <Button title={initial ? 'Kaydet' : 'Kalemi ekle'} onPress={save} testID="line-save" />
        </ScrollView>
        <Picker
          visible={picking}
          title={line.type === 'material' ? 'Hammadde seç' : 'Ürün seç'}
          items={items}
          loading={catalog.loading}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', gap: Spacing.two },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
