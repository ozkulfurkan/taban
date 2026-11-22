import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Destek — SoleCost' };

const FAQ: Array<[string, string]> = [
  ['Şifremi unuttum', 'Giriş ekranındaki "Şifremi unuttum" bağlantısıyla e-posta adresinize sıfırlama bağlantısı gönderilir.'],
  ['Mobil uygulamada hesap açabilir miyim?', 'Hesap solecost.com üzerinden açılır. Mobil uygulamaya aynı e-posta ve şifreyle giriş yapabilirsiniz.'],
  ['Müşteri portalına nasıl girerim?', 'Portal hesabınızı çalıştığınız firma açar. Firmanın gönderdiği davet e-postasındaki bilgilerle giriş yapın.'],
  ['Hesabımı ve verilerimi nasıl silerim?', 'Aşağıdaki iletişim kanalından hesap e-postanızla talep gönderin. Firma sahibi hesaplarında firmanın tüm verileri silinir; diğer kullanıcılarda yalnızca kullanıcı hesabı silinir. Talep en geç 30 gün içinde sonuçlandırılır.'],
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-8 text-ink-700">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-brand-700">SoleCost</Link>
          <h1 className="page-title">Destek</h1>
          <p>SoleCost web ve mobil uygulamaları hakkında yardım.</p>
        </header>

        <section className="bg-white rounded-2xl border border-ink-200 p-5 space-y-2">
          <h2 className="font-semibold text-ink-900">Bize ulaşın</h2>
          {LEGAL.email && (
            <p>E-posta: <a href={`mailto:${LEGAL.email}`} className="text-brand-700 underline">{LEGAL.email}</a></p>
          )}
          <p>
            Giriş yapmış kullanıcılar uygulamadaki{' '}
            <Link href="/destek-merkezi" className="text-brand-700 underline">Destek Merkezi</Link>
            {' '}üzerinden talep açabilir.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-ink-900">Sık sorulanlar</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="bg-white rounded-xl border border-ink-200 px-5 py-3">
              <summary className="cursor-pointer font-medium text-ink-800">{q}</summary>
              <p className="mt-2 text-sm">{a}</p>
            </details>
          ))}
        </section>

        <p className="text-sm text-ink-500">
          <Link href="/gizlilik" className="underline">Gizlilik Politikası ve KVKK Aydınlatma Metni</Link>
        </p>
      </div>
    </main>
  );
}
