import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni — SoleCost' };

export default function PrivacyPage() {
  const controller = LEGAL.controller || LEGAL.product;
  return (
    <main className="min-h-screen bg-slate-50">
      <article className="max-w-3xl mx-auto px-4 py-10 sm:py-14 text-slate-700 leading-relaxed space-y-6 text-[15px]">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-blue-600">SoleCost</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gizlilik Politikası ve KVKK Aydınlatma Metni</h1>
          <p className="text-sm text-slate-500">Son güncelleme: {LEGAL.updatedAt}</p>
        </header>

        <Section title="1. Veri sorumlusu">
          <p>
            Bu metin, {LEGAL.product} web uygulaması ve mobil uygulamaları (&quot;Hizmet&quot;) kapsamında kişisel verilerin
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca nasıl işlendiğini açıklar.
            Veri sorumlusu: <b>{controller}</b>{LEGAL.address ? `, ${LEGAL.address}` : ''}.
          </p>
          <p>
            Hizmeti kullanan firmalar, kendi müşteri, tedarikçi ve personel kayıtları bakımından veri sorumlusudur;
            {' '}{LEGAL.product} bu kayıtları firma adına ve firmanın talimatıyla işleyen veri işleyendir.
          </p>
        </Section>

        <Section title="2. İşlenen veriler">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Hesap bilgileri:</b> ad soyad, e-posta, şifrenin geri döndürülemez özeti, rol ve yetkiler.</li>
            <li><b>Firma bilgileri:</b> unvan, adres, vergi numarası, telefon, logo.</li>
            <li><b>İşlem kayıtları:</b> firmanın girdiği cari, fatura, ödeme, çek, stok, sipariş ve personel kayıtları.</li>
            <li><b>Güvenlik kayıtları:</b> giriş denemeleri, IP adresi, işlem günlükleri.</li>
            <li><b>Mobil uygulama:</b> kamera yalnızca barkod okurken kullanılır, görüntü saklanmaz ve gönderilmez.
              Face ID / parmak izi doğrulaması cihazda yapılır; biyometrik veri bize ulaşmaz.</li>
          </ul>
        </Section>

        <Section title="3. Amaçlar ve hukuki sebepler">
          <p>
            Veriler; hizmetin sunulması ve sözleşmenin ifası (KVKK m.5/2-c), hukuki yükümlülüklerin yerine getirilmesi (m.5/2-ç),
            hesap güvenliğinin sağlanması ve kötüye kullanımın önlenmesi için meşru menfaat (m.5/2-f) sebeplerine dayanılarak işlenir.
            Verileriniz reklam amacıyla kullanılmaz, satılmaz ve üçüncü kişilerle pazarlama amacıyla paylaşılmaz.
          </p>
        </Section>

        <Section title="4. Aktarım">
          <p>
            Hizmet; barındırma (Vercel), veritabanı (Neon) ve e-posta gönderimi için hizmet sağlayıcılardan yararlanır.
            Bu sağlayıcıların sunucuları yurt dışında bulunabileceğinden veriler, KVKK m.9 kapsamındaki güvencelerle yurt dışına aktarılabilir.
            Yetkili kurumların hukuka uygun talepleri dışında başka bir aktarım yapılmaz.
          </p>
        </Section>

        <Section title="5. Saklama ve silme">
          <p>
            Veriler hesap süresince ve ilgili mevzuatta öngörülen süreler boyunca saklanır. Hesabın kapatılmasıyla birlikte veriler,
            yasal saklama yükümlülükleri saklı kalmak kaydıyla silinir veya anonim hâle getirilir.
            Hesap ve veri silme talebinizi <Link href="/destek" className="text-blue-600 underline">destek sayfasından</Link> iletebilirsiniz.
          </p>
        </Section>

        <Section title="6. Güvenlik">
          <p>
            Bağlantılar şifrelidir (HTTPS). Şifreler geri döndürülemez biçimde saklanır, firmalar arası veri ayrımı her istekte
            sunucuda denetlenir, hatalı giriş denemeleri sınırlandırılır.
          </p>
        </Section>

        <Section title="7. Çerezler">
          <p>Yalnızca oturumun sürdürülmesi için zorunlu çerezler kullanılır; reklam veya takip çerezi kullanılmaz.</p>
        </Section>

        <Section title="8. Haklarınız">
          <p>
            KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme,
            aktarıldığı kişileri öğrenme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.
            {LEGAL.email
              ? <> Taleplerinizi <a href={`mailto:${LEGAL.email}`} className="text-blue-600 underline">{LEGAL.email}</a> adresine iletebilirsiniz.</>
              : <> Taleplerinizi <Link href="/destek" className="text-blue-600 underline">destek sayfası</Link> üzerinden iletebilirsiniz.</>}
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
