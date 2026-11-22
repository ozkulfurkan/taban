'use client';
import { usePortalText } from '@/lib/i18n/portal';

import { orderSteps, stepIndexOf } from '@/lib/order-status';

// Sipariş adımları ürün birimine göre: taban (çift) 7 üretim adımı, hammadde vb. 4 adım
export default function OrderStepper({ status, unit }: { status: string; unit?: string | null }) {
  const { tp } = usePortalText();
  const STEPS = orderSteps(unit);
  const currentIdx = stepIndexOf(status, unit);

  if (status === 'CANCELLED') {
    return (
      <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700" data-testid="order-cancelled">
        {tp('Bu sipariş iptal edildi.')}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max px-2 py-4">
        {STEPS.map((step, i) => {
          // Sevk edildi son adımdır: tamamlanmış gösterilir
          const done = i < currentIdx || (status === 'SHIPPED' && i === currentIdx);
          const active = i === currentIdx && !done;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  done ? 'bg-brand-700 border-brand-700 text-white' :
                  active ? 'bg-white border-brand-700 text-brand-700' :
                  'bg-white border-ink-300 text-ink-400'
                }`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-brand-700' : done ? 'text-ink-600' : 'text-ink-400'
                }`}>{tp(step.label)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-10 mx-1 mb-5 transition-all ${i < currentIdx ? 'bg-brand-700' : 'bg-ink-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
