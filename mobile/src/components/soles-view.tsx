import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import type { CatalogProduct } from '@/core/portal';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';
import { matchesText } from '@shared/search';
import { Picker } from './picker';
import { Empty, ErrorState, Loading, T } from './ui';

// "Tabanlarım": alıcının kendi taban modelleri ve reçetedeki hammaddelerin bu tedarikçideki karşılığı.
// Eşleşmiş hammadde → "Sepete ekle" (miktarı kullanıcı girer); eşleşmemiş → öneri ya da katalogdan "Eşleştir".

type Brief = { productId: string; code: string | null; name: string; unit: string | null };
type SolePart = {
  id: string; name: string; gramsPerPiece: number; wasteRate: number;
  material: { id: string; name: string } | null; match: Brief | null; suggestion: Brief | null;
};
type Sole = { id: string; code: string | null; name: string; parts: SolePart[] };

export function SolesView({ solesUrl, mapUrl, products, search, header, bottomPad, onAdd }: {
  solesUrl: string;
  mapUrl: string;
  products: CatalogProduct[];
  search: string;
  header?: React.ReactNode;
  bottomPad: number;
  onAdd: (p: CatalogProduct) => void;
}) {
  const c = useTheme();
  const q = useApi<{ soles: Sole[] }>(solesUrl);
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState<SolePart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const soles = (q.data?.soles ?? []).filter(s => !search || matchesText(`${s.code ?? ''} ${s.name} ${s.parts.map(p => p.material?.name ?? '').join(' ')}`, search));

  const save = async (part: SolePart, sellerProductId: string | null) => {
    if (!part.material) return;
    setBusy(part.material.id);
    try {
      await api(mapUrl, { method: 'PUT', body: { materialId: part.material.id, sellerProductId } });
      await q.refetch();
    } catch (e: any) {
      notify('Eşleştirilemedi', e?.message ?? '');
    } finally {
      setBusy(null);
    }
  };
  const addToCart = (b: Brief) => {
    const p = products.find(x => x.id === b.productId);
    if (p) onAdd(p); else notify('Ürün katalogda yok', 'Tedarikçi bu ürünü kataloğundan kaldırmış olabilir.');
  };

  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={q.isLoading || q.error ? [] : soles}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        ListHeaderComponent={<>{header}<T variant="small" style={styles.hint}>Tabanınızı açın; reçetedeki hammaddelerin bu tedarikçideki karşılığını sepete ekleyin.</T></>}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error
          ? <ErrorState message={(q.error as Error).message} onRetry={() => { void q.refetch(); }} />
          : <Empty message={search ? 'Aramaya uyan taban yok.' : 'Hammadde reçetesi tanımlı tabanınız yok. Web\'de ürün parçalarına hammadde ekleyin.'} />}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
        renderItem={({ item: s }) => {
          const isOpen = open === s.id;
          const matched = s.parts.filter(p => p.match).length;
          return (
            <View style={{ backgroundColor: c.card, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
              <Pressable onPress={() => setOpen(o => (o === s.id ? null : s.id))} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                testID={`sole-${s.id}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={1}>{s.code ? `${s.code} · ` : ''}{s.name}</T>
                  <T variant="small">{s.parts.length} hammadde · {matched} eşleşmiş</T>
                </View>
                <T color={c.primary}>{isOpen ? '▲' : '▼'}</T>
              </Pressable>
              {isOpen ? s.parts.map(part => (
                <View key={part.id} style={[styles.part, { borderTopColor: c.border }]} testID={`sole-part-${part.id}`}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T style={{ fontWeight: '500' }} numberOfLines={1}>{part.material?.name ?? part.name}</T>
                    <T variant="small" numberOfLines={1}>{part.name} · {part.gramsPerPiece} g{part.wasteRate ? ` · fire %${part.wasteRate}` : ''}</T>
                    {part.match ? (
                      <T variant="small" color={c.success} numberOfLines={1}>→ {part.match.code ? `${part.match.code} · ` : ''}{part.match.name}</T>
                    ) : part.suggestion ? (
                      <T variant="small" color={c.warning} numberOfLines={1}>Öneri: {part.suggestion.code ? `${part.suggestion.code} · ` : ''}{part.suggestion.name}</T>
                    ) : (
                      <T variant="small" color={c.textMuted}>Tedarikçide karşılığı seçilmedi</T>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {part.match ? (
                      <>
                        <Pressable onPress={() => addToCart(part.match!)} style={[styles.pill, { backgroundColor: c.primary }]} accessibilityRole="button" testID={`sole-add-${part.id}`}>
                          <T color={c.primaryText} variant="small" style={{ fontWeight: '700' }}>Sepete ekle</T>
                        </Pressable>
                        <Pressable onPress={() => setPicking(part)} hitSlop={6} accessibilityRole="button"><T variant="small" color={c.primary}>Değiştir</T></Pressable>
                      </>
                    ) : part.suggestion ? (
                      <>
                        <Pressable onPress={() => { void save(part, part.suggestion!.productId); }} disabled={busy === part.material?.id}
                          style={[styles.pill, { backgroundColor: c.primarySoft }]} accessibilityRole="button" testID={`sole-accept-${part.id}`}>
                          <T variant="small" color={c.primary} style={{ fontWeight: '700' }}>Eşleştir</T>
                        </Pressable>
                        <Pressable onPress={() => setPicking(part)} hitSlop={6} accessibilityRole="button"><T variant="small" color={c.primary}>Başka ürün</T></Pressable>
                      </>
                    ) : (
                      <Pressable onPress={() => setPicking(part)} style={[styles.pill, { backgroundColor: c.primarySoft }]} accessibilityRole="button" testID={`sole-pick-${part.id}`}>
                        <T variant="small" color={c.primary} style={{ fontWeight: '700' }}>Eşleştir</T>
                      </Pressable>
                    )}
                  </View>
                </View>
              )) : null}
            </View>
          );
        }}
      />
      <Picker
        visible={!!picking}
        title={picking?.material ? `${picking.material.name} → tedarikçi ürünü` : 'Ürün seç'}
        items={[
          ...(picking?.match ? [{ id: '__none__', title: 'Eşleşmeyi kaldır', subtitle: picking.match.name }] : []),
          ...products.map(p => ({ id: p.id, title: p.code ? `${p.code} · ${p.name}` : p.name, subtitle: p.description ?? undefined })),
        ]}
        onPick={id => { const part = picking!; setPicking(null); void save(part, id === '__none__' ? null : id); }}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 16, borderTopWidth: StyleSheet.hairlineWidth },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  hint: { paddingHorizontal: 16, paddingBottom: 8 },
});
