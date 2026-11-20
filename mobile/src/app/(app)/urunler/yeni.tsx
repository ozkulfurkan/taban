import { useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Picker } from '@/components/picker';
import { ProductImageField } from '@/components/product-image';
import { uploadProductImage, type PickedImage } from '@/core/product-image';
import { Button, Card, Field, ListRow, Screen, Segmented, T } from '@/components/ui';
import { formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { useAuth } from '@/core/auth';
import { notify } from '@/core/dialog';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

const CURRENCIES = ['TRY', 'USD', 'EUR'] as const;
type Category = { id: string; name: string };

// Yeni ürün (web /products/new ile aynı alanlar ve uç). Reçete/maliyet web'de ürün detayından girilir.
export default function NewProduct() {
  const c = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isMaterial = user?.type === 'staff' && user.companyType === 'MATERIAL_SUPPLIER';
  const units = isMaterial ? ['kg', 'ton', 'lt', 'adet'] : ['çift', 'adet', 'kg', 'metre', 'paket'];
  const categories = useApi<Category[]>('/api/product-categories');

  const [f, setF] = useState({ name: '', code: '', unit: units[0], unitPrice: '', currency: 'TRY', stock: '', description: '' });
  const [category, setCategory] = useState<Category | null>(null);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [pickCategory, setPickCategory] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));

  const save = async () => {
    setError('');
    if (!f.name.trim()) return setError('Ürün adını girin.');
    setSaving(true);
    try {
      const p = await api<{ id: string; name: string }>('/api/products', {
        method: 'POST',
        body: {
          name: f.name.trim(), code: f.code.trim(), unit: f.unit, currency: f.currency,
          unitPrice: parseAmountInput(f.unitPrice), stock: parseAmountInput(f.stock),
          description: f.description.trim(), categoryId: category?.id ?? null,
        },
      });
      let photoFailed = '';
      if (photo) await uploadProductImage(p.id, photo.base64).catch((e: any) => { photoFailed = e?.message || ''; });
      await qc.invalidateQueries();
      router.replace(`/stok/product/${p.id}`);
      if (photoFailed) notify('Fotoğraf yüklenemedi', `Ürün kaydedildi; fotoğrafı ürün sayfasından tekrar ekleyebilirsiniz. ${photoFailed}`);
      else notify('Ürün eklendi', p.name);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Yeni ürün' }} />
      <Screen>
        <ProductImageField localUri={photo?.uri} onPicked={setPhoto} onRemove={() => setPhoto(null)} />
        <Field label="Ürün adı *" value={f.name} onChangeText={set('name')}
          placeholder={isMaterial ? 'örn. PU Sistem 60 Shore' : 'örn. Klasik Erkek Taban'} testID="product-name" />
        <Field label="Ürün kodu" value={f.code} onChangeText={set('code')} autoCapitalize="characters" placeholder="örn. TB-101" testID="product-code" />

        <View style={{ gap: 6 }}>
          <T variant="label">Birim</T>
          <Segmented value={f.unit} onChange={set('unit')} options={units.map(u => ({ value: u, label: u }))} />
        </View>

        <Field label={`Satış fiyatı (${f.unit} başına)`} value={f.unitPrice} onChangeText={v => set('unitPrice')(formatAmountInput(v))}
          keyboardType="decimal-pad" placeholder="0,00" testID="product-price" />
        <Segmented value={f.currency} onChange={set('currency')} options={CURRENCIES.map(x => ({ value: x, label: x }))} />

        <Field label={`Açılış stoğu (${f.unit})`} value={f.stock} onChangeText={v => set('stock')(formatAmountInput(v, 3))}
          keyboardType="decimal-pad" placeholder="0" testID="product-stock" />

        <View style={{ gap: 6 }}>
          <T variant="label">Kategori</T>
          <Card style={{ padding: 0, gap: 0 }}>
            <ListRow title={category?.name ?? 'Kategori seçin (isteğe bağlı)'} onPress={() => setPickCategory(true)} testID="product-category" />
          </Card>
          {category ? <Button title="Kategoriyi kaldır" variant="ghost" onPress={() => setCategory(null)} /> : null}
        </View>

        <Field label="Açıklama" value={f.description} onChangeText={set('description')} multiline style={{ minHeight: 60, paddingTop: 12 }} />
        {!isMaterial ? <T variant="small">Reçete (hammadde, gramaj) ve maliyet hesabı web&apos;de ürün sayfasından eklenir.</T> : null}
        {error ? <T color={c.danger} testID="product-error">{error}</T> : null}
        <Button title="Kaydet" onPress={save} loading={saving} testID="product-save" />
      </Screen>
      <Picker
        visible={pickCategory}
        title="Kategori"
        loading={categories.isLoading}
        items={(categories.data ?? []).map(x => ({ id: x.id, title: x.name }))}
        emptyText="Kategori yok. Kategorileri web'de Ürünler sayfasından ekleyebilirsiniz."
        onPick={id => { setCategory(categories.data?.find(x => x.id === id) ?? null); setPickCategory(false); }}
        onClose={() => setPickCategory(false)}
      />
    </>
  );
}
