import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Hesap ve Veri Silme — SoleCost' };

// Mağazaların (Google Play, App Store) istediği herkese açık hesap silme sayfası
export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <article className="max-w-3xl mx-auto px-4 py-10 sm:py-14 text-ink-700 leading-relaxed space-y-6 text-[15px]">
        <header className="space-y-2">
          {/* Uygulama içinden açılır: ana sayfaya (ücret/kayıt) bağlantı verilmez (App Store 3.1.1) */}
          <span className="text-sm text-brand-700">SoleCost</span>
          <h1 className="page-title">Hesap ve veri silme</h1>
          <p className="text-sm text-ink-500">{LEGAL.product} hesabınızı ve verilerinizi nasıl sileceğiniz</p>
        </header>

        <Section title="Mobil uygulamadan">
          <ol className="list-decimal pl-5 space-y-1">
            <li>{LEGAL.product} uygulamasında oturum açın.</li>
            <li><b>Ayarlar → Hesabı sil</b> bölümüne girin.</li>
            <li>&quot;Onay kodu gönder&quot; ile e-postanıza gelen 6 haneli kodu girin ve silmeyi onaylayın.</li>
          </ol>
        </Section>

        <Section title="Web'den ya da uygulamaya erişemiyorsanız">
          <p>
            Hesabınıza kayıtlı e-posta adresiyle{' '}
            {LEGAL.email
              ? <a href={`mailto:${LEGAL.email}?subject=Hesap%20silme%20talebi`} className="text-brand-700 underline">{LEGAL.email}</a>
              : <Link href="/destek" className="text-brand-700 underline">destek sayfası</Link>}
            {' '}üzerinden &quot;hesap silme talebi&quot; iletin. Kimliğinizi doğruladıktan sonra talebiniz işleme alınır.
          </p>
        </Section>

        <Section title="Ne silinir, ne kadar sürer?">
          <ul className="list-disc pl-5 space-y-1">
            <li>Onaydan sonra hesap hemen <b>pasif</b> olur ve oturumlar kapanır.</li>
            <li><b>15 gün</b> içinde tekrar giriş yapmazsanız hesap kalıcı olarak silinir; bu sürede giriş yaparsanız silme iptal olur.</li>
            <li><b>Firma sahibi</b> silerse firma, firmaya ait tüm kullanıcılar ve kayıtlar (cari, fatura, ödeme, çek, stok, sipariş, personel, ürün fotoğrafları) silinir.</li>
            <li><b>Firma kullanıcısı</b> silerse yalnızca kendi hesabı silinir; firmanın kayıtları firmada kalır.</li>
            <li>Bildirim kayıtları ve cihaz bildirim anahtarları hesapla birlikte silinir.</li>
            <li>Vergi ve ticaret mevzuatı gereği saklanması zorunlu kayıtlar, yasal süre boyunca erişime kapalı olarak saklanabilir ve süre sonunda silinir.</li>
          </ul>
        </Section>

        <Section title="Müşteri portalı hesapları">
          <p>
            Müşteri portalı hesabını, çalıştığınız firma açar ve yönetir. Portal hesabınızın kapatılmasını o firmadan
            ya da yukarıdaki iletişim yolundan isteyebilirsiniz.
          </p>
        </Section>

        <p className="text-sm text-ink-500">
          Ayrıntılar için <Link href="/gizlilik" className="text-brand-700 underline">Gizlilik Politikası</Link>.
        </p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}
