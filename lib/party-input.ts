import { isCurrency } from '@/lib/money';

// Müşteri / tedarikçi kaydı için temel doğrulama.
export function partyInputError(body: any, opts: { requireName?: boolean } = { requireName: true }): string | null {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (opts.requireName !== false || body?.name !== undefined) {
    if (!name) return 'Ad / unvan boş olamaz';
    if (name.length > 200) return 'Ad / unvan en fazla 200 karakter olabilir';
  }
  if (body?.currency !== undefined && body.currency !== null && body.currency !== '' && !isCurrency(body.currency)) {
    return 'Para birimi TRY, USD veya EUR olmalı';
  }
  if (body?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
    return 'E-posta adresi geçersiz';
  }
  return null;
}
