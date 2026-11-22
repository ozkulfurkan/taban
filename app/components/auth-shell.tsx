import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from './brand-mark';

// Giriş, kayıt ve şifre ekranlarının ortak çerçevesi.
// Solda bordo marka paneli (dikiş çizgisi ve taban silüeti), sağda sade form alanı. Telefonda yalnızca form görünür.

const SOLE = 'M60 92 Q82 76 112 76 L182 76 Q204 76 214 94 L226 138 Q228 162 214 174 L192 190 Q180 196 160 196 L92 196 Q68 196 52 184 L36 168 Q30 150 36 132 Z';

export function AuthShell({ title, subtitle, children, footer, panelTitle, panelPoints }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Sol paneldeki büyük başlık (varsayılan: genel slogan) */
  panelTitle?: ReactNode;
  panelPoints?: string[];
}) {
  const points = panelPoints ?? [
    'Maliyetten siparişe, cari hesaptan çeke tek yerde',
    'Müşterileriniz portaldan sipariş verir, siz takip edersiniz',
    'Web ve mobilde aynı veriler, anlık bildirimler',
  ];
  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* Marka paneli */}
      <aside className="hidden lg:flex relative w-[46%] max-w-[640px] bg-brand-700 text-[#F6EDE4] overflow-hidden">
        {/* Taban silüeti (filigran) */}
        <svg viewBox="0 0 256 256" aria-hidden className="absolute -right-24 -bottom-24 w-[560px] h-[560px] opacity-[0.07] rotate-[-18deg]">
          <path d={SOLE} fill="none" stroke="currentColor" strokeWidth="3" />
          <path d={SOLE} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 5" transform="translate(128 136) scale(0.9) translate(-128 -136)" />
        </svg>
        {/* Dikiş çerçevesi */}
        <div aria-hidden className="absolute inset-5 rounded-[20px] border border-dashed border-[#F6EDE4]/25" />

        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          <Link href="/" className="flex items-center gap-3">
            <span className="rounded-[22%] ring-1 ring-[#F6EDE4]/30"><BrandMark size={40} /></span>
            <span className="font-display text-2xl font-semibold tracking-tight">SoleCost</span>
          </Link>

          <div className="max-w-md">
            <h2 className="font-display text-[2.6rem] leading-[1.08] font-medium" style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 50" }}>
              {panelTitle ?? <>Ayakkabının maliyeti,<br /><em className="italic font-normal text-[#EBC8CE]">kuruşu kuruşuna.</em></>}
            </h2>
            <ul className="mt-10 space-y-4">
              {points.map((p, i) => (
                <li key={p} className="flex gap-4 items-baseline">
                  <span className="font-mono text-xs text-[#EBC8CE]/80 tabular">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[15px] leading-relaxed text-[#F6EDE4]/90">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs tracking-[0.18em] uppercase text-[#F6EDE4]/55">Ayakkabı sektörü için işletme yazılımı</p>
        </div>
      </aside>

      {/* Form alanı */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-10">
            <BrandMark size={36} />
            <span className="font-display text-2xl font-semibold text-ink-900 tracking-tight">SoleCost</span>
          </Link>
          <h1 className="font-display text-[2rem] leading-tight font-semibold text-ink-900" style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 30" }}>{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-ink-500">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** Giriş ekranlarındaki etiketli alan */
export function AuthField({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium text-ink-700">{label}</span>
        {hint}
      </span>
      {children}
    </label>
  );
}

export const authInput = 'input py-2.5 text-[15px]';
export const authPrimary = 'btn-primary w-full py-3 text-[15px]';
