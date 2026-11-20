// Mesaj başlığından tür: hata ifadeleri önceliklidir ("gönderilemedi" başarı sayılmaz)
export type Tone = 'success' | 'error' | 'info';

const ERROR_RE = /(amadı|emedi|olmadı|başarısız|hata|geçersiz|bulunamadı|yetkiniz|reddedildi)/i;
const SUCCESS_RE = /(eklendi|kaydedildi|güncellendi|gönderildi|silindi|oluşturuldu|alındı|kapatıldı|onaylandı|tamamlandı|kopyalandı|yenilendi|verildi|edildi|bağlandı|kaldırıldı)/i;

export function toneOf(title: string): Tone {
  if (ERROR_RE.test(title)) return 'error';
  if (SUCCESS_RE.test(title)) return 'success';
  return 'info';
}
