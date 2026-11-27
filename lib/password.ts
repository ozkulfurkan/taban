// Tüm şifre belirleme akışlarında (kayıt, kullanıcı ekleme, şifre sıfırlama, portal) aynı kural.
// Yalnız yeni belirlenen şifrelere uygulanır; mevcut şifreyle giriş etkilenmez.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE_MESSAGE = 'Şifre en az 8 karakter olmalı, en az 1 harf ve 1 rakam içermeli; tahmin edilmesi kolay şifreler kabul edilmez.';

// Sızıntı listelerinde en sık görülen şifreler (küçük harfe çevrilip karşılaştırılır)
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '12345678a', 'a12345678', 'qwerty123', 'qwertyuiop', 'password', 'password1',
  'password123', 'parola123', 'sifre123', 'şifre123', 'abc12345', 'abcd1234', '1q2w3e4r', '1q2w3e4r5t', 'asdf1234',
  'iloveyou1', 'admin123', 'admin1234', 'welcome1', 'letmein1', 'test1234', 'deneme123', 'solecost1', 'solecost123',
  'galatasaray1', 'fenerbahce1', 'besiktas1', 'trabzonspor1', 'istanbul34', 'ankara06', 'turkiye1', 'türkiye1',
]);

export function passwordError(password: unknown, ctx?: { email?: string | null; name?: string | null }): string | null {
  if (typeof password !== 'string') return PASSWORD_RULE_MESSAGE;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 200) return PASSWORD_RULE_MESSAGE;
  if (!/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password) || !/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  const lower = password.toLocaleLowerCase('tr');
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return PASSWORD_RULE_MESSAGE;
  // E-posta ya da adla aynı / onu içeren şifre olmaz
  const local = ctx?.email?.split('@')[0]?.toLocaleLowerCase('tr');
  if (local && local.length >= 4 && lower.includes(local)) return 'Şifre e-posta adresinizi içermemeli.';
  return null;
}

/** Ekranlarda kullanılan kısa kural metni */
export const PASSWORD_HINT = 'En az 8 karakter, 1 harf ve 1 rakam';
