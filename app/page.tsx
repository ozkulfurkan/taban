'use client';

import Link from 'next/link';
import {
  ClipboardList, Package, Calculator, FileText, Users, Factory, ArrowRight,
  Truck, UserCheck, Wallet, Smartphone, Check,
} from '@/app/components/icons';
import { BrandMark } from '@/app/components/brand-mark';

const FEATURES = [
  { icon: ClipboardList, title: 'Sipariş takibi', desc: 'Müşteri siparişlerini alın, onaylayın; üretim, hazır ve sevk aşamalarını izleyin.' },
  { icon: Package, title: 'Hammadde ve stok', desc: 'Gerçek zamanlı stok, giriş/çıkış hareketleri ve sipariş bazlı ihtiyaç hesabı.' },
  { icon: Calculator, title: 'Maliyet hesaplama', desc: 'Her ürün için hammadde bazlı maliyet ve fire oranı; döviz kurlarıyla birlikte.' },
  { icon: FileText, title: 'Satış ve fatura', desc: 'Siparişten faturaya tek adım; stok ve cari hesap kendiliğinden güncellenir.' },
  { icon: Factory, title: 'Fason yönetimi', desc: 'Fason siparişleri, fasoncu portalı ve hammadde zimmet takibi.' },
  { icon: Users, title: 'Müşteri portalı', desc: 'Müşterileriniz katalogdan sipariş verir, durumunu ve ekstresini kendisi görür.' },
  { icon: Wallet, title: 'Ön muhasebe', desc: 'Cari hesaplar, çek portföyü, kasa-banka ve ödeme takibi tek ekranda.' },
  { icon: UserCheck, title: 'Personel takibi', desc: 'Giriş-çıkış, izin ve fazla mesai kayıtları.' },
  { icon: Smartphone, title: 'Mobil uygulama', desc: 'iOS ve Android uygulamasıyla verilerinize her yerden ulaşın.', soon: true },
];

const STEPS = [
  { num: '01', title: 'Siparişi alın', desc: 'Portaldan ya da panelden; beden dağılımı ve hammadde seçimiyle.' },
  { num: '02', title: 'Üretime gönderin', desc: 'Hammadde ihtiyacı hesaplanır, eksik varsa uyarılırsınız.' },
  { num: '03', title: 'Faturalandırın', desc: 'Hazır siparişi tek tıkla satışa çevirin; stok ve cari güncellenir.' },
];

const STATS = [
  { value: 'Anlık', label: 'Stok güncelleme' },
  { value: '3', label: 'Ayrı portal: firma, müşteri, fasoncu' },
  { value: '%100', label: 'Web tabanlı, kurulum yok' },
  { value: '1 yıl', label: 'Ücretsiz, sonra aylık 500 ₺' },
];

const display = { fontVariationSettings: "'opsz' 96, 'SOFT' 40" } as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      {/* Üst menü */}
      <header className="sticky top-0 z-50 bg-ink-50/85 backdrop-blur-md border-b border-ink-200/70">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="font-display text-[22px] font-semibold tracking-tight">SoleCost</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-600">
            <a href="#moduller" className="hover:text-ink-900">Modüller</a>
            <a href="#nasil" className="hover:text-ink-900">Nasıl çalışır</a>
            <a href="#fiyat" className="hover:text-ink-900">Fiyat</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">Giriş yap</Link>
            <Link href="/register" className="btn-primary">Ücretsiz başla</Link>
          </div>
        </div>
      </header>

      {/* Kampanya şeridi */}
      <div className="bg-brand-700 text-[#F6EDE4] text-center py-2 px-4 text-[13px]">
        Lansmana özel: yeni üyeliklerde <strong className="font-semibold">1 yıl ücretsiz</strong>, sonrasında aylık yalnızca 500 ₺
      </div>

      {/* Kahraman alanı */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 md:pt-24 pb-14 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <p className="section-title text-brand-700">Ayakkabı sektörü için ERP</p>
            <h1 className="mt-5 font-display text-[2.75rem] md:text-[4rem] leading-[1.02] font-medium tracking-tight" style={display}>
              Üretimi yönet,<br />
              <em className="italic font-normal text-brand-700">maliyeti</em> kuruşu<br className="hidden md:block" /> kuruşuna takip et.
            </h1>
            <p className="mt-6 text-lg text-ink-600 leading-relaxed max-w-xl">
              Sipariş, hammadde, fason, muhasebe ve personel tek platformda. Stok gerçek zamanlı güncellenir,
              maliyet kendiliğinden hesaplanır.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3 text-[15px]">
                Hemen başla <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-[15px]">Giriş yap</Link>
            </div>
          </div>

          {/* Ürün kesiti: sipariş kartı */}
          <div className="relative">
            <div aria-hidden className="absolute -inset-4 rounded-[28px] border border-dashed border-brand-300/60" />
            <div className="relative card p-6 shadow-pop">
              <div className="flex items-center justify-between">
                <span className="section-title">Gelen siparişler</span>
                <span className="badge-brand">3 yeni</span>
              </div>
              <ul className="mt-4 divide-y divide-ink-100">
                {[
                  { no: 'SİP-2026-0142', who: 'Ayakkabı Dünyası A.Ş.', qty: '1.200 çift', st: 'Onay bekliyor', cls: 'badge-warning' },
                  { no: 'SİP-2026-0141', who: 'Yıldız Spor', qty: '600 çift', st: 'Üretimde', cls: 'badge-brand' },
                  { no: 'SİP-2026-0139', who: 'Moda Adım Ltd.', qty: '350 kg', st: 'Sevk edildi', cls: 'badge-success' },
                ].map(r => (
                  <li key={r.no} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-ink-500">{r.no}</p>
                      <p className="text-sm font-medium text-ink-900 truncate">{r.who}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular">{r.qty}</p>
                      <span className={`${r.cls} mt-1`}>{r.st}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-dashed border-ink-200 grid grid-cols-3 gap-3">
                {[['Hammadde', '₺18,40'], ['İşçilik', '₺6,10'], ['Birim maliyet', '₺27,85']].map(([k, v], i) => (
                  <div key={k}>
                    <p className="text-[11px] text-ink-500">{k}</p>
                    <p className={`font-display text-xl tabular ${i === 2 ? 'text-brand-700' : 'text-ink-900'}`}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rakamlar */}
        <div className="border-y border-ink-200 bg-white/60">
          <dl className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-2 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={s.label} className={`py-7 px-4 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t md:border-t-0' : ''} md:border-l first:md:border-l-0 border-ink-200`}>
                <dt className="font-display text-3xl text-brand-700 tabular" style={display}>{s.value}</dt>
                <dd className="mt-1 text-[13px] text-ink-500">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Modüller */}
      <section id="moduller" className="py-24">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-6 items-end mb-12">
            <div>
              <p className="section-title text-brand-700">Modüller</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight" style={display}>Her şey tek platformda</h2>
            </div>
            <p className="text-ink-600 leading-relaxed md:pb-1">
              Ayakkabı, taban ve yan sanayi üretiminin tüm süreçlerini kapsayan modüler yapı. İhtiyacınız olan her şey hazır.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-ink-200 bg-white">
            {FEATURES.map(f => (
              <div key={f.title} className="group relative p-7 border-r border-b border-ink-200 hover:bg-ink-50 transition-colors">
                <div className="flex items-center justify-between">
                  <f.icon className="w-6 h-6 text-brand-700" />
                  {f.soon ? <span className="badge-neutral">Yakında</span> : null}
                </div>
                <h3 className="mt-6 font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">{f.desc}</p>
                <span aria-hidden className="absolute left-0 bottom-0 h-[2px] w-0 bg-brand-700 transition-all duration-300 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section id="nasil" className="py-24 bg-white border-y border-ink-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <p className="section-title text-brand-700">Nasıl çalışır</p>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight" style={display}>Siparişten faturaya üç adım</h2>
          <ol className="mt-14 grid md:grid-cols-3 gap-10">
            {STEPS.map(step => (
              <li key={step.num} className="relative">
                <div className="flex items-center gap-4">
                  <span className="font-display text-5xl text-brand-200 tabular" style={display}>{step.num}</span>
                  <span aria-hidden className="flex-1 stitch text-ink-200" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Öne çıkanlar */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="font-display text-[2.1rem] leading-tight font-medium tracking-tight" style={display}>Hammadde ihtiyacını anında görün</h2>
            <p className="mt-4 text-ink-600 leading-relaxed">
              Üretimdeki siparişler için hangi hammaddeden ne kadar gerektiği kendiliğinden hesaplanır. Stok yetmiyorsa uyarılırsınız.
            </p>
            <ul className="mt-7 space-y-3">
              {['Ürün bazlı hammadde ve fire oranı', 'Sipariş adedine göre kg hesabı', 'Stokla karşılaştırma ve eksik uyarısı', 'Fason hammadde zimmet takibi'].map(item => (
                <li key={item} className="flex items-start gap-3 text-[15px] text-ink-700">
                  <Check className="w-4 h-4 text-brand-700 mt-1 flex-shrink-0" weight="bold" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <span className="section-title">Hammadde gereksinimi · Üretimde</span>
            </div>
            <table className="table-base mt-4">
              <thead><tr><th>Hammadde</th><th className="text-right">Gereken</th><th className="text-right">Durum</th></tr></thead>
              <tbody>
                {[
                  { name: '701 Krep Termogranül', req: '245,50 kg', ok: true },
                  { name: 'Siyah Taban Granülü', req: '180,00 kg', ok: false },
                  { name: 'Beyaz Hammadde', req: '92,30 kg', ok: true },
                ].map(r => (
                  <tr key={r.name}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-right tabular">{r.req}</td>
                    <td className="text-right">{r.ok ? <span className="badge-success">Yeterli</span> : <span className="badge-danger">Eksik</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 sm:px-6 mt-24 grid md:grid-cols-2 gap-14 items-center">
          <div className="order-2 md:order-1 card p-6">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-700" />
              <span className="section-title">Müşteri portalı</span>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Onaylandı', 'Termin 15.12.2026', true], ['Üretimde', 'Kalıplama', true], ['Sevke hazır', '', false], ['Sevk edildi', '', false],
              ].map(([k, v, done], i) => (
                <div key={String(k)} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold ${done ? 'bg-brand-700 text-white' : 'border border-ink-300 text-ink-400'}`}>{i + 1}</span>
                  <span className={`text-sm ${done ? 'text-ink-900 font-medium' : 'text-ink-500'}`}>{k}</span>
                  {v ? <span className="text-xs text-ink-500 ml-auto">{v}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="font-display text-[2.1rem] leading-tight font-medium tracking-tight" style={display}>Ön muhasebe, portal ve personel bir arada</h2>
            <p className="mt-4 text-ink-600 leading-relaxed">
              Cari hesaplar, çek portföyü, alış-satış faturaları ve ödemeler. Müşterileriniz siparişlerinin her adımını portaldan izler.
            </p>
            <ul className="mt-7 space-y-3">
              {['Cari hesap ve ekstre paylaşımı', 'Çek portföyü ve vade takibi', 'Müşteriye özel giriş ve sipariş geçmişi', 'Fasoncu için ayrı portal', 'Personel izin, mesai ve devam takibi'].map(item => (
                <li key={item} className="flex items-start gap-3 text-[15px] text-ink-700">
                  <Check className="w-4 h-4 text-brand-700 mt-1 flex-shrink-0" weight="bold" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Fiyat / çağrı */}
      <section id="fiyat" className="px-5 sm:px-6 pb-24">
        <div className="relative max-w-6xl mx-auto bg-brand-700 text-[#F6EDE4] rounded-3xl overflow-hidden">
          <div aria-hidden className="absolute inset-4 rounded-[18px] border border-dashed border-[#F6EDE4]/25" />
          <div className="relative px-8 py-16 md:py-20 text-center">
            <p className="text-xs tracking-[0.18em] uppercase text-[#F6EDE4]/70">Lansmana özel kampanya</p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-medium" style={display}>İlk 1 yıl tamamen ücretsiz</h2>
            <p className="mt-4 text-lg text-[#F6EDE4]/85">Sonrasında aylık yalnızca <strong className="font-semibold text-white">500 ₺</strong>. Kurulum yok; tarayıcıdan girin, dakikalar içinde başlayın.</p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className="btn bg-[#F6EDE4] text-brand-800 hover:bg-white px-7 py-3 text-[15px] font-semibold">
                Ücretsiz başla <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="btn border border-[#F6EDE4]/40 text-[#F6EDE4] hover:bg-white/10 px-7 py-3 text-[15px]">Giriş yap</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Alt bilgi */}
      <footer className="border-t border-ink-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-500">
          <div className="flex items-center gap-2.5">
            <BrandMark size={22} />
            <span className="font-display font-semibold text-ink-900">SoleCost</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/gizlilik" className="hover:text-ink-900">Gizlilik</Link>
            <Link href="/hesap-silme" className="hover:text-ink-900">Hesap silme</Link>
            <Link href="/destek" className="hover:text-ink-900">Destek</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
