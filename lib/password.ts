// Tüm şifre belirleme akışlarında (kayıt, kullanıcı ekleme, şifre sıfırlama) aynı kural.
export const PASSWORD_RULE_MESSAGE = 'Şifre en az 6 karakter, 1 harf ve 1 rakam içermelidir.';

export function passwordError(password: unknown): string | null {
  if (typeof password !== 'string') return PASSWORD_RULE_MESSAGE;
  if (password.length < 6 || !/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password) || !/[0-9]/.test(password)) {
    return PASSWORD_RULE_MESSAGE;
  }
  return null;
}
