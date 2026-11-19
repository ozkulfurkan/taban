import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderDetailBody } from '@/components/order-detail';
import { Sheet } from '@/components/sheet';
import { DateField } from '@/components/date-field';
import { Button, ErrorState, Field, Loading, Screen, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { useAuth, useCanDelete, useCanWrite } from '@/core/auth';
import { printOrders, shareOrdersPdf } from '@/core/order-pdf';
import { confirm, notify } from '@/core/dialog';
import { isoDay } from '@/core/format';
import { formatDiff, formatQty, orderSteps, statusLabel, unitDecimals, type PortalOrder } from '@/core/portal';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { shipLines } from '@shared/shipment';

type Incoming = PortalOrder & {
  productId?: string | null;
  customer?: { id: string; name: string } | null;
  portalCustomer?: { email: string } | null;
  link?: { buyerCompany?: { name: string } | null } | null;
};

// Gelen sipariş (satıcı): durum güncelleme, sevkiyat (sevk edilen gerçek miktar), iptal
export default function GelenSiparis() {
  const qc = useQueryClient();
  const canWrite = useCanWrite();
  const canDelete = useCanDelete();
  const { user } = useAuth();
  const companyName = user?.type === 'staff' ? user.companyName : null;
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<Incoming>(`/api/orders/${id}`);
  const [statusOpen, setStatusOpen] = useState(false);
  const [note, setNote] = useState('');
  const [shipOpen, setShipOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <><Stack.Screen options={{ title: 'Sipariş' }} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={{ title: 'Sipariş' }} /><ErrorState message={(q.error as Error)?.message || 'Sipariş bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;
  const o = q.data;
  // Kaynak: bağlı SoleCost firması, portal ya da firma içi kayıt (müşteri adı zaten başta)
  const source = o.link ? 'SoleCost bağlantısı' : o.portalCustomer ? `Portal · ${o.portalCustomer.email}` : 'Firma içi kayıt';
  const closed = o.status === 'CANCELLED';

  const refresh = async () => { await qc.invalidateQueries(); };
  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await api(`/api/orders/${o.id}`, { method: 'PUT', body: { status, statusNote: note.trim() || undefined } });
      setNote('');
      await refresh();
      notify('Durum güncellendi', statusLabel(status, o.unit));
    } catch (e: any) { notify('Kaydedilemedi', e?.message ?? ''); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!(await confirm('Sipariş iptal edilsin mi?', `${o.orderNo} iptal edilir; müşteriye bildirim gider.`, 'İptal et', true))) return;
    setBusy(true);
    try { await api(`/api/orders/${o.id}`, { method: 'DELETE' }); await refresh(); } catch (e: any) { notify('İptal edilemedi', e?.message ?? ''); } finally { setBusy(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: o.orderNo }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <OrderDetailBody order={o} subtitle={`${o.customer?.name ?? '—'} · ${source}`}>
          {canWrite && !closed ? (
            <View style={styles.actions}>
              <Button title="Durum" icon="edit" onPress={() => setStatusOpen(true)} loading={busy} style={styles.action} testID="order-status" />
              <Button title={o.shipment ? 'Sevkiyatı düzenle' : 'Sevk et'} icon="truck" variant="secondary" onPress={() => setShipOpen(true)} style={styles.action} testID="order-ship" />
              {canDelete && o.status !== 'SHIPPED' ? <Button title="İptal" icon="trash" variant="ghost" onPress={cancel} style={styles.action} testID="order-cancel" /> : null}
            </View>
          ) : null}
          {/* Sipariş föyü: üretim / depo için PDF ya da doğrudan yazdırma */}
          <View style={styles.actions}>
            <Button title="PDF paylaş" icon="pdf" variant="secondary" style={styles.action} testID="order-pdf"
              onPress={() => { void shareOrdersPdf([o], { title: `Sipariş ${o.orderNo}`, companyName }).catch((e: any) => notify('PDF oluşturulamadı', e?.message ?? '')); }} />
            <Button title="Yazdır" icon="doc" variant="secondary" style={styles.action} testID="order-print"
              onPress={() => { void printOrders([o], { title: `Sipariş ${o.orderNo}`, companyName }).catch((e: any) => notify('Yazdırılamadı', e?.message ?? '')); }} />
          </View>
        </OrderDetailBody>
      </Screen>

      <Sheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Durum güncelle"
        description={`Şu an: ${statusLabel(o.status, o.unit)}. Müşteriye bildirim gider.`}
        actions={orderSteps(o.unit).filter(s => s.key !== o.status && s.key !== 'SHIPPED').map(s => ({
          label: s.label, onPress: () => { void setStatus(s.key); }, testID: `status-${s.key}`,
        }))}
      >
        <Field label="Not (isteğe bağlı)" value={note} onChangeText={setNote} placeholder="Müşteriye iletilecek not" testID="status-note" />
        <T variant="small">Sevk edildi durumu sevkiyat kaydıyla verilir.</T>
      </Sheet>

      {shipOpen ? <ShipModal order={o} onClose={() => setShipOpen(false)} onSaved={refresh} /> : null}
    </>
  );
}

function ShipModal({ order: o, onClose, onSaved }: { order: Incoming; onClose: () => void; onSaved: () => Promise<void> }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const lines = shipLines(o as any);
  const prev = Array.isArray(o.shipment?.items) ? o.shipment!.items! : [];
  const [date, setDate] = useState(o.shipment?.shipmentDate ? isoDay(new Date(o.shipment.shipmentDate)) : isoDay());
  const [irsaliye, setIrsaliye] = useState(o.shipment?.deliveryNoteNo ?? '');
  const [carrier, setCarrier] = useState(o.shipment?.carrier ?? '');
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(prev.map(i => [i.index, formatAmountInput(String(i.shipped).replace('.', ','), unitDecimals(i.unit))])),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const parse = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

  const save = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Sevk tarihini seçin.');
    setSaving(true);
    try {
      await api(`/api/orders/${o.id}`, {
        method: 'PUT',
        body: {
          shipment: {
            shipmentDate: date, deliveryNoteNo: irsaliye, carrier,
            items: lines.map(l => ({ index: l.index, shipped: qty[l.index] ? parse(qty[l.index]) : undefined })),
          },
        },
      });
      await onSaved();
      onClose();
      notify('Sevkiyat kaydedildi', 'Sipariş "Sevk Edildi" oldu, müşteriye bildirim gitti.');
    } catch (e: any) { setError(e?.message || 'Kaydedilemedi'); } finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + Spacing.three }]} testID="ship-sheet">
          <T variant="heading">Sevkiyat</T>
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: Spacing.three }} keyboardShouldPersistTaps="handled">
            <DateField label="Sevk tarihi" value={date} onChange={setDate} testID="ship-date" />
            <Field label="İrsaliye no" value={irsaliye} onChangeText={setIrsaliye} testID="ship-waybill" />
            <Field label="Taşıyıcı" value={carrier} onChangeText={setCarrier} />
            <T variant="label">Sevk edilen miktar (boş = sipariş miktarı)</T>
            {lines.map(l => {
              const raw = qty[l.index];
              const shipped = raw ? parse(raw) : l.ordered;
              const diff = Number.isFinite(shipped) ? formatDiff(l.ordered, shipped, l.unit) : '';
              return (
                <View key={l.index} style={{ gap: 4 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={1}>{[l.productCode, l.productName].filter(Boolean).join(' · ') || 'Ürün'}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label={`Sipariş ${formatQty(l.ordered, l.unit)}`}
                        value={raw ?? ''}
                        onChangeText={v => setQty(s => ({ ...s, [l.index]: formatAmountInput(v, unitDecimals(l.unit)) }))}
                        keyboardType={unitDecimals(l.unit) ? 'decimal-pad' : 'number-pad'}
                        placeholder={formatQty(l.ordered, l.unit).split(' ')[0]}
                        testID={`ship-qty-${l.index}`}
                      />
                    </View>
                    <T variant="small" style={{ width: 90, textAlign: 'right' }} color={diff ? (shipped < l.ordered ? c.warning : c.primary) : undefined}>{diff || 'tam'}</T>
                  </View>
                </View>
              );
            })}
            {error ? <T color={c.danger} testID="ship-error">{error}</T> : null}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Kaydet" onPress={save} loading={saving} style={{ flex: 2 }} testID="ship-save" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '30%' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.three, gap: Spacing.three },
});
