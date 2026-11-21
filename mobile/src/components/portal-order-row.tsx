import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, T } from '@/components/ui';
import { formatDate } from '@/core/format';
import { formatQty, stageLabel, statusTone, type PortalOrder } from '@/core/portal';
import { useTheme } from '@/hooks/use-theme';

// Portal sipariş satırı: numara, tarih, model/adet ve durum rozeti
export function OrderRow({ order: o, first }: { order: PortalOrder; first?: boolean }) {
  const c = useTheme();
  const model = Array.isArray(o.orderItems) && o.orderItems.length
    ? `${o.orderItems.length} model`
    : (o.productCode || o.product?.name || 'Sipariş');
  return (
    <Pressable
      onPress={() => router.push(`/siparisler/${o.id}`)}
      accessibilityRole="button"
      testID={`order-${o.id}`}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, pressed && { opacity: 0.6 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T style={{ fontWeight: '600' }} numberOfLines={1}>{o.orderNo}</T>
        <T variant="small" numberOfLines={1}>{formatDate(o.createdAt)} · {model} · {formatQty(o.totalQuantity, o.unit)}</T>
      </View>
      <Badge label={stageLabel(o)} tone={statusTone(o.status, o.confirmedAt)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
