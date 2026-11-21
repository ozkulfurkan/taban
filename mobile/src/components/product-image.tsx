import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { authHeaders } from '@/core/api';
import { pickProductImage, productImageUrl, type PickedImage } from '@/core/product-image';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { T } from './ui';

/** Küçük ürün görseli (liste satırı, katalog seçimi); fotoğraf yoksa simge */
export function ProductThumb({ productId, imageUpdatedAt, size = 48, localUri, base }: {
  productId: string; imageUpdatedAt?: string | null; size?: number; localUri?: string | null; base?: string;
}) {
  const c = useTheme();
  const url = localUri ?? productImageUrl(productId, imageUpdatedAt, base);
  const box = { width: size, height: size, borderRadius: Math.round(size / 5), backgroundColor: c.primarySoft };
  if (!url) {
    return (
      <View style={[styles.center, box]}>
        <Icon name="tag" size={Math.round(size * 0.42)} color={c.primary} />
      </View>
    );
  }
  return (
    <Image
      source={localUri ? { uri: localUri } : { uri: url, headers: authHeaders() }}
      style={box}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * Ürün formu / detayında fotoğraf alanı: dokununca "Fotoğraf çek / Galeriden seç / Kaldır".
 * onPicked seçilen (küçültülmüş) fotoğrafı, onRemove kaldırmayı bildirir; yükleme çağıranın işidir.
 */
export function ProductImageField({ productId, imageUpdatedAt, localUri, busy, onPicked, onRemove }: {
  productId?: string; imageUpdatedAt?: string | null; localUri?: string | null; busy?: boolean;
  onPicked: (img: PickedImage) => void; onRemove?: () => void;
}) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const has = !!localUri || !!imageUpdatedAt;

  const pick = async (source: 'camera' | 'library') => {
    try {
      // Seçenek penceresi kapanmadan sistem seçicisi açılırsa iOS reddeder
      await new Promise(r => setTimeout(r, 400));
      const img = await pickProductImage(source);
      if (img) onPicked(img);
    } catch { /* kullanıcı vazgeçti ya da okunamadı */ }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={has ? 'Ürün fotoğrafını değiştir' : 'Ürün fotoğrafı ekle'}
        testID="product-image"
        style={({ pressed }) => [styles.field, { borderColor: c.border, backgroundColor: c.card, opacity: pressed || busy ? 0.7 : 1 }]}
      >
        {has ? (
          <ProductThumb productId={productId ?? 'new'} imageUpdatedAt={imageUpdatedAt} localUri={localUri} size={96} />
        ) : (
          <View style={[styles.center, styles.empty, { backgroundColor: c.primarySoft }]}>
            <Icon name="camera" size={30} color={c.primary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '700' }} color={c.primary}>{busy ? 'Yükleniyor…' : has ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}</T>
          <T variant="small">Katalog PDF&apos;inde ve ürün sayfasında görünür.</T>
        </View>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Ürün fotoğrafı"
        actions={[
          { label: 'Fotoğraf çek', icon: 'camera', onPress: () => { void pick('camera'); }, testID: 'image-camera' },
          { label: 'Galeriden seç', icon: 'image', onPress: () => { void pick('library'); }, testID: 'image-library' },
          ...(has && onRemove ? [{ label: 'Fotoğrafı kaldır', icon: 'trash' as const, destructive: true, onPress: onRemove }] : []),
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  empty: { width: 96, height: 96, borderRadius: 19 },
});
