'use client';

import { useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Package, Trash2 } from '@/app/components/icons';

// Ürün fotoğrafı (web): seçilen dosya tarayıcıda 1200 px JPEG'e küçültülüp yüklenir (mobil ile aynı uç ve ayar).

const MAX_SIDE = 1200;

export function productImageSrc(productId: string, imageUpdatedAt?: string | null, base = '/api/products') {
  return imageUpdatedAt ? `${base}/${productId}/image?v=${encodeURIComponent(imageUpdatedAt)}` : null;
}

/** Liste / kart küçük görseli; fotoğraf yoksa simge */
export function ProductThumb({ productId, imageUpdatedAt, className = 'w-10 h-10', base }: {
  productId: string; imageUpdatedAt?: string | null; className?: string; base?: string;
}) {
  const src = productImageSrc(productId, imageUpdatedAt, base);
  if (!src) {
    return (
      <div className={`${className} rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0`}>
        <Package className="w-1/2 h-1/2 text-brand-600" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className={`${className} rounded-lg object-cover bg-ink-100 flex-shrink-0`} />;
}

async function resizeToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Fotoğraf okunamadı'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Fotoğraf işlenemedi');
    ctx.fillStyle = '#fff'; // şeffaf PNG siyaha dönmesin
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ürün sayfası fotoğraf alanı: yükle / değiştir / kaldır */
export function ProductImageEditor({ productId, imageUpdatedAt, canEdit, onChange }: {
  productId: string; imageUpdatedAt: string | null; canEdit: boolean; onChange: (v: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const src = productImageSrc(productId, imageUpdatedAt);

  const save = async (data: string | null) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/products/${productId}/image`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Fotoğraf kaydedilemedi');
      onChange(j.imageUpdatedAt ?? null);
    } catch (e: any) {
      setError(e?.message || 'Fotoğraf kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Bir fotoğraf dosyası seçin'); return; }
    try { await save(await resizeToJpeg(file)); } catch (err: any) { setError(err?.message || 'Fotoğraf okunamadı'); }
  };

  if (!canEdit && !src) return null;
  return (
    <div className="bg-white rounded-xl shadow-card p-4 flex flex-col sm:flex-row gap-4 items-start border border-ink-200/80" data-testid="product-image-editor">
      <div className="relative w-full sm:w-48 aspect-square rounded-xl overflow-hidden bg-ink-50 border border-dashed border-ink-300 flex items-center justify-center flex-shrink-0">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Ürün fotoğrafı" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-10 h-10 text-ink-300" />
        )}
        {busy && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-700" /></div>}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink-700">Ürün fotoğrafı</p>
        <p className="text-xs text-ink-500">Katalog PDF&apos;inde, müşteri portalında ve firma ağı sipariş kataloğunda görünür.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid="product-image-upload"
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <Camera className="w-4 h-4" /> {src ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
            </button>
            {src && (
              <button type="button" onClick={() => { if (confirm('Ürün fotoğrafı kaldırılsın mı?')) void save(null); }} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Kaldır
              </button>
            )}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={pick} />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
