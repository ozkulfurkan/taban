'use client';

import Link from 'next/link';
import {
  ClipboardList,
  Package,
  Calculator,
  FileText,
  Users,
  Factory,
  ArrowRight,
  CheckCircle,
  BarChart3,
  Layers,
  Truck,
  ChevronRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Sipariş Takibi',
    desc: 'Müşteri siparişlerini al, üretime gönder, hazır ve sevk edildi olarak takip et.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Package,
    title: 'Hammadde Stok',
    desc: 'Gerçek zamanlı stok takibi, giriş/çıkış hareketleri ve ihtiyaç hesabı.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Calculator,
    title: 'Maliyet Hesaplama',
    desc: 'Her ürün için hammadde bazlı maliyet analizi ve fire oranı hesabı.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: FileText,
    title: 'Satış & Fatura',
    desc: 'Sipariş → fatura dönüşümü tek tıkla; stok otomatik güncellenir.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Factory,
    title: 'Fason Yönetimi',
    desc: 'Fason sipariş takibi, fasoncu portalı ve hammadde zimmet takibi.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: Users,
    title: 'Müşteri Portalı',
    desc: 'Müşteriler kendi siparişlerini ve katalog ürünlerini portal üzerinden görür.',
    color: 'bg-cyan-50 text-cyan-600',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Sipariş Alın',
    desc: 'Müşteri portali veya admin panelinden sipariş girin; numara dağılımı ve hammadde seçimi yapın.',
  },
  {
    num: '02',
    title: 'Üretime Gönderin',
    desc: 'Siparişi "Üretimde" olarak işaretleyin; hammadde ihtiyacı otomatik hesaplanır.',
  },
  {
    num: '03',
    title: 'Faturalandırın',
    desc: 'Sipariş hazır olduğunda tek tıkla satışa çevirin; stok ve muhasebe otomatik güncellenir.',
  },
];

const STATS = [
  { value: '11', label: 'Numara desteği (36–46)' },
  { value: 'Anlık', label: 'Stok güncelleme' },
  { value: '3', label: 'Ayrı portal (admin/müşteri/fasoncu)' },
  { value: '100%', label: 'Web tabanlı, kurulum yok' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">SoleCost</span>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Giriş Yap
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full inline-block" />
              Taban üretimi için ERP
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-5 tracking-tight">
              Üretimi yönet,<br />
              <span className="text-blue-400">maliyeti takip et.</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              Sipariş, hammadde, fason ve satış — tüm süreçleri tek platformda yönetin.
              Stok gerçek zamanlı güncellenir, maliyet otomatik hesaplanır.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/40"
              >
                Hemen Başla <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:ozkulfurkann@gmail.com?subject=SoleCost Demo İsteği"
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-sm transition-colors border border-white/20"
              >
                Demo İste
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-extrabold text-blue-600 mb-1">{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Her şey tek platformda</h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              Taban üretiminin tüm süreçlerini kapsayan modüler yapı — ihtiyacınız olan her şey hazır.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Nasıl çalışır?</h2>
            <p className="text-slate-500">Üç adımda sipariş → üretim → fatura.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {step.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block w-px flex-1 bg-blue-200 mt-2" />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-800 mb-2 mt-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Hammadde gereksinimini anında görün</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">
                Üretimdeki siparişler için hangi hammaddeden ne kadar lazım olduğunu otomatik hesaplayın.
                Stok yetersizse sistem sizi uyarır.
              </p>
              <ul className="space-y-3">
                {[
                  'Ürün bazlı hammadde ve fire oranı tanımı',
                  'Sipariş adetine göre otomatik kg hesabı',
                  'Mevcut stok ile karşılaştırma ve eksik uyarısı',
                  'Fason hammadde zimmet takibi',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-semibold text-slate-300">Hammadde Gereksinimi — Üretimde</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: '701 Krep Termogranül', required: '245,50 kg', stock: '420,00 kg', ok: true },
                  { name: 'Siyah Taban Granülü', required: '180,00 kg', stock: '120,50 kg', ok: false },
                  { name: 'Beyaz Hammadde', required: '92,30 kg', stock: '315,00 kg', ok: true },
                ].map(row => (
                  <div key={row.name} className={`rounded-lg p-3 flex items-center justify-between text-xs ${row.ok ? 'bg-slate-700/60' : 'bg-red-900/40 border border-red-700/40'}`}>
                    <span className="font-medium text-slate-200 truncate mr-2">{row.name}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-slate-400">{row.required}</span>
                      {row.ok
                        ? <span className="text-emerald-400 font-semibold">✓ Yeterli</span>
                        : <span className="text-red-400 font-semibold">✗ Eksik</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Second highlight */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Müşteri Sipariş Portalı</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'SİP-2025-0042', customer: 'Ahmet Deri', qty: '240 çift', status: 'Üretimde', color: 'bg-amber-100 text-amber-700' },
                  { label: 'SİP-2025-0041', customer: 'Yılmaz Lastik', qty: '180 çift', status: 'Hazır', color: 'bg-green-100 text-green-700' },
                  { label: 'SİP-2025-0040', customer: 'Öztaban A.Ş.', qty: '320 çift', status: 'Sevk Edildi', color: 'bg-emerald-100 text-emerald-700' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{row.label}</div>
                      <div className="text-xs text-slate-500">{row.customer} · {row.qty}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.color}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Müşterileriniz kendi siparişlerini takip etsin</h2>
              <p className="text-slate-500 mb-6 leading-relaxed">
                Her müşterinize özel portal erişimi verin. Sipariş durumlarını, termin tarihlerini
                ve ürün katalogunu portaldan görebilsinler.
              </p>
              <ul className="space-y-3">
                {[
                  'Müşteriye özel giriş ve sipariş geçmişi',
                  'Sipariş numarası, numara dağılımı ve termin',
                  'Fasoncu için ayrı portal (hammadde zimmet)',
                  'E-posta bildirim desteği',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Hemen kullanmaya başlayın</h2>
          <p className="text-blue-200 mb-8 text-lg">
            Kurulum gerektirmez. Tarayıcınızdan giriş yapın, dakikalar içinde sipariş almaya başlayın.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-xl text-base hover:bg-blue-50 transition-colors shadow-xl"
          >
            Giriş Yap <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <Layers className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-white">SoleCost</span>
            <span className="text-slate-600">© 2025</span>
          </div>
          <a href="mailto:ozkulfurkann@gmail.com" className="hover:text-white transition-colors">
            ozkulfurkann@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
