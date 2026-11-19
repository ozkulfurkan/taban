import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, Section, T } from '@/components/ui';
import { formatDate } from '@/core/format';
import { formatDiff, formatQty, orderLines, orderSteps, sizeSummary, statusLabel, statusTone, stepIndex, type PortalOrder } from '@/core/portal';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sipariş detay gövdesi: durum adımları, kalemler, bilgiler, sevkiyat ve geçmiş.
 * Portal müşterisi, gelen sipariş (satıcı) ve verilen sipariş (alıcı) ekranları ortak kullanır.
 * `subtitle` (ör. kaynak / tedarikçi adı) üstte, `children` (ör. satıcının yönetim kartları) adımların altında.
 */
export function OrderDetailBody({ order: o, subtitle, children }: { order: PortalOrder; subtitle?: string; children?: ReactNode }) {
  const c = useTheme();
  const current = stepIndex(o.status, o.unit);
  const steps = orderSteps(o.unit);
  const cancelled = o.status === 'CANCELLED';
  const lines = orderLines(o);
  const partials = (o.colorPartials ?? []).filter(p => p.color);

  return (
    <>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {subtitle ? <T style={{ fontWeight: '600' }} numberOfLines={2} testID="order-subtitle">{subtitle}</T> : null}
            <T variant="small">{formatDate(o.createdAt)} · {formatQty(o.totalQuantity, o.unit)}</T>
          </View>
          <Badge label={statusLabel(o.status, o.unit)} tone={statusTone(o.status)} />
        </View>
        <View style={{ gap: 0 }} testID="order-steps">
          {cancelled ? <T color={c.danger} style={{ fontWeight: '600' }} testID="order-cancelled">Bu sipariş iptal edildi.</T> : steps.map((s, i) => {
            const done = i <= current;
            return (
              <View key={s.key} style={styles.step}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.dot, { backgroundColor: done ? c.primary : c.card, borderColor: done ? c.primary : c.border }]}>
                    {done ? <T color={c.primaryText} style={{ fontSize: 11, fontWeight: '700' }}>✓</T> : null}
                  </View>
                  {i < steps.length - 1 ? <View style={[styles.line, { backgroundColor: i < current ? c.primary : c.border }]} /> : null}
                </View>
                <T style={{ fontWeight: i === current ? '700' : '400' }} color={done ? c.text : c.textMuted}>{s.label}</T>
              </View>
            );
          })}
        </View>
      </Card>

      {children}


      <Section title="Kalemler">
        <Card style={{ padding: 0, gap: 0 }}>
          {lines.map((l, i) => (
            <View key={i} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]} testID={`order-line-${i}`}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T style={{ fontWeight: '600' }} numberOfLines={1}>{[l.productCode, l.productName].filter(Boolean).join(' · ') || 'Model'}</T>
                {l.color ? <T variant="small">Renk: {l.color}</T> : null}
                {sizeSummary(l.sizeDistribution) ? <T variant="small">{sizeSummary(l.sizeDistribution)}</T> : null}
              </View>
              <T style={{ fontWeight: '700' }}>{formatQty(l.totalQuantity, l.unit ?? o.unit)}</T>
            </View>
          ))}
        </Card>
      </Section>

      {(o.material || partials.length || o.requestedDeliveryDate || o.confirmedDeliveryDate || o.notes) ? (
        <Section title="Bilgiler">
          <Card style={{ gap: 6 }}>
            {o.material ? <Info label="Malzeme" value={o.material} /> : null}
            {partials.map(p => <Info key={p.name} label={p.name} value={p.color} />)}
            {o.requestedDeliveryDate ? <Info label="İstenen termin" value={formatDate(o.requestedDeliveryDate)} /> : null}
            {o.confirmedDeliveryDate ? <Info label="Onaylanan termin" value={formatDate(o.confirmedDeliveryDate)} /> : null}
            {o.notes ? <Info label="Not" value={o.notes} /> : null}
          </Card>
        </Section>
      ) : null}

      {o.shipment ? (
        <Section title="Sevkiyat">
          <Card style={{ gap: 6 }} testID="order-shipment">
            <Info label="Sevk tarihi" value={formatDate(o.shipment.shipmentDate)} />
            {o.shipment.deliveryNoteNo ? <Info label="İrsaliye no" value={o.shipment.deliveryNoteNo} /> : null}
            {o.shipment.carrier ? <Info label="Taşıyıcı" value={o.shipment.carrier} /> : null}
            {o.shipment.trackingNo ? <Info label="Takip no" value={o.shipment.trackingNo} /> : null}
            {o.shipment.notes ? <Info label="Not" value={o.shipment.notes} /> : null}
            {(o.shipment.items ?? []).map(i => (
              <Info
                key={i.index}
                label={[i.productCode, i.productName].filter(Boolean).join(' ') || 'Ürün'}
                value={`${formatQty(i.shipped, i.unit)} sevk · sipariş ${formatQty(i.ordered, i.unit)}${formatDiff(i.ordered, i.shipped, i.unit) ? ` (${formatDiff(i.ordered, i.shipped, i.unit)})` : ''}`}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {o.statusHistory?.length ? (
        <Section title="Geçmiş">
          <Card style={{ gap: 8 }}>
            {[...o.statusHistory].reverse().map(h => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 12 }}>
                <T variant="small" style={{ width: 84 }}>{formatDate(h.createdAt)}</T>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{statusLabel(h.status, o.unit)}</T>
                  {h.note ? <T variant="small">{h.note}</T> : null}
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <T variant="small" style={{ width: 110 }}>{label}</T>
      <T style={{ flex: 1 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, height: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
