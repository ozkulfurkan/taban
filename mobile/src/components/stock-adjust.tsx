import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, Segmented, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import {
  DECIMALS, KIND_PATH, adjustBody, formatQty, nextStock, validateAdjust,
  type AdjustMode, type StockKind,
} from '@/core/stock';
import { useTheme } from '@/hooks/use-theme';

const MODE_LABEL: Record<AdjustMode, string> = { in: 'Giriş', out: 'Çıkış', count: 'Sayım' };

/** Ürün / hammadde stok düzeltme penceresi: giriş, çıkış ve (hammaddede) sayım */
export function StockAdjustModal({ kind, item, initialMode = 'in', onClose }: {
  kind: StockKind; item: { id: string; name: string; stock: number; unit: string }; initialMode?: AdjustMode; onClose: () => void;
}) {
  const c = useTheme();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AdjustMode>(initialMode);
  const [qtyText, setQtyText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const qty = parseAmountInput(qtyText);
  const after = qtyText ? nextStock(mode, qty, item.stock) : null;
  const modes: AdjustMode[] = kind === 'material' ? ['in', 'out', 'count'] : ['in', 'out'];

  const save = async () => {
    setError('');
    const err = validateAdjust(kind, mode, qty, item.stock);
    if (err) return setError(err);
    const result = nextStock(mode, qty, item.stock);
    if (result < 0 && !(await confirm('Stok eksiye düşecek', `İşlem sonrası stok ${formatQty(result)} ${item.unit} olacak. Devam edilsin mi?`, 'Devam et'))) return;
    setSaving(true);
    try {
      await api(`/api/${KIND_PATH[kind]}/${item.id}/stok`, { method: 'POST', body: adjustBody(kind, mode, qty, notes) });
      await qc.invalidateQueries();
      onClose();
      notify('Stok güncellendi', `${item.name}: ${formatQty(result)} ${item.unit}`);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + Spacing.three }]} testID="stock-adjust">
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <T variant="heading" numberOfLines={1}>{item.name}</T>
          <T variant="small">Mevcut stok {formatQty(item.stock)} {item.unit}</T>
          <Segmented value={mode} onChange={m => { setMode(m); setError(''); }} options={modes.map(m => ({ value: m, label: MODE_LABEL[m] }))} />
          <Field
            label={mode === 'count' ? `Sayılan miktar (${item.unit})` : `Miktar (${item.unit})`}
            value={qtyText}
            onChangeText={v => setQtyText(formatAmountInput(v, DECIMALS[kind]))}
            keyboardType={kind === 'product' ? 'number-pad' : 'decimal-pad'}
            placeholder="0"
            autoFocus
            testID="stock-qty"
          />
          <Field label="Açıklama" value={notes} onChangeText={setNotes} placeholder="İsteğe bağlı (örn. sayım farkı)" testID="stock-notes" />
          {after !== null ? (
            <T testID="stock-after" color={after < 0 ? c.danger : c.textSecondary}>
              İşlem sonrası: <T style={{ fontWeight: '700' }} color={after < 0 ? c.danger : c.text}>{formatQty(after)} {item.unit}</T>
            </T>
          ) : null}
          {error ? <T color={c.danger} testID="stock-error">{error}</T> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Kaydet" onPress={save} loading={saving} style={{ flex: 2 }} testID="stock-save" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.three, gap: Spacing.three },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
});
