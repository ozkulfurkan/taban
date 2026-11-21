import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { api } from './api';
import { API_URL } from './config';
import { notify } from './dialog';

// Ürün fotoğrafı: kamera ya da galeriden seçilir, 1200 px'e küçültülüp JPEG olarak yüklenir
// (sunucu sınırı 1,5 MB; bu ayarlarla tipik fotoğraf 150-300 KB olur).

const MAX_SIDE = 1200;

export type PickedImage = { uri: string; base64: string; mime?: 'image/png' | 'image/jpeg' };

export type PickOptions = { maxSide?: number; format?: 'jpeg' | 'png'; square?: boolean };

export async function pickProductImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  return pickImage(source, { maxSide: MAX_SIDE, format: 'jpeg', square: true });
}

/** Kamera ya da galeriden görsel seçer, küçültür ve base64 döndürür (PNG saydamlığı korur) */
export async function pickImage(source: 'camera' | 'library', o: PickOptions = {}): Promise<PickedImage | null> {
  const maxSide = o.maxSide ?? MAX_SIDE;
  const png = o.format === 'png';
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    notify('İzin gerekli', source === 'camera'
      ? 'Fotoğraf çekmek için Ayarlar > SoleCost bölümünden kamera iznini açın.'
      : 'Fotoğraf seçmek için Ayarlar > SoleCost bölümünden fotoğraflar iznini açın.');
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = o.square === false
    ? { mediaTypes: 'images', allowsEditing: false, quality: 1 }
    : { mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = r.canceled ? null : r.assets?.[0];
  if (!asset) return null;

  const ctx = ImageManipulator.manipulate(asset.uri);
  const w = asset.width || maxSide;
  const h = asset.height || maxSide;
  if (Math.max(w, h) > maxSide) ctx.resize(w >= h ? { width: maxSide } : { height: maxSide });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync(png ? { format: SaveFormat.PNG, base64: true } : { compress: 0.72, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) return null;
  return { uri: saved.uri, base64: saved.base64, mime: png ? 'image/png' : 'image/jpeg' };
}

export async function uploadProductImage(productId: string, base64: string | null) {
  return api<{ imageUpdatedAt: string | null }>(`/api/products/${productId}/image`, {
    method: 'PUT', body: { data: base64 ? `data:image/jpeg;base64,${base64}` : null },
  });
}

/** Ürün fotoğrafının adresi (sürüm parametresi önbelleği yeniler); fotoğraf yoksa null */
/** base: fotoğrafı sunan katalog adresi (kendi ürünleri /api/products; portal ve firma ağı kendi kataloğu) */
export function productImageUrl(productId: string, imageUpdatedAt?: string | null, base = '/api/products') {
  return imageUpdatedAt ? `${API_URL}${base}/${productId}/image?v=${encodeURIComponent(imageUpdatedAt)}` : null;
}

/** Firma logosu: en fazla 512 px PNG (saydamlık korunur); null → logoyu kaldırır */
export async function uploadCompanyLogo(img: PickedImage | null) {
  if (!img) return api<{ logoUrl: null }>('/api/company/logo', { method: 'DELETE' });
  return api<{ logoUrl: string }>('/api/company/logo', { method: 'PUT', body: { data: `data:${img.mime ?? 'image/png'};base64,${img.base64}` } });
}
