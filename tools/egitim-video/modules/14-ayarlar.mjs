// Ayarlar ve kullanıcılar
export default {
  slug: 'ayarlar',
  title: 'Ayarlar ve Kullanıcılar',
  summary: ['Firma bilgileri ve logo', 'Döviz kuru ve KDV', 'Çalışan ekleme: rol ve sayfa izinleri', 'Şifre ve dil'],
  async run(h) {
    const { p } = h;
    await h.go('/settings', 2000);
    await h.say('Sistem → Ayarlar: profil, dil ve para birimi tercihleri, şifre değiştirme.', 3000);
    await h.scroll(700, 1200);
    await h.say('Firma Bilgileri: logo, ünvan, adres ve vergi no; belgelerde ve PDF’lerde kullanılır.', 3200);
    await h.scroll(700, 1200);
    await h.say('Döviz kurları TCMB’den otomatik gelir; varsayılan KDV oranı ve banka bilgilerinizi de buradan girin.', 3400);
    await h.go('/settings/users', 1800);
    await h.say('Sistem → Kullanıcılar: çalışanlarınıza kendi giriş hesabını açın.', 2600);
    await h.click(p.getByRole('button', { name: /Yeni Kullanıcı/ }).first(), 1200);
    await h.say('Rolü seçin: Firma Yöneticisi her şeyi görür, Editör kayıt girer, Görüntüleyici yalnızca bakar.', 3400);
    await h.say('"Sayfa İzinleri" ile kişinin hangi ekranları göreceğini işaretleyin (ör. yalnızca Siparişler).', 3400);
    await h.click(p.getByRole('button', { name: /^İptal$|Vazgeç/ }).last(), 900).catch(() => p.keyboard.press('Escape'));
    await h.say('Her kullanıcının yaptığı işlemler kayıt altında tutulur.', 2400);
  },
  recap: ['Ayarlar: firma bilgileri, logo, kur, KDV', 'Kullanıcılar → Yeni Kullanıcı', 'Rol + sayfa izinleri'],
};
