'use client';

const STEPS = [
  { key: 'ORDER_RECEIVED', label: 'Sipariş Alındı' },
  { key: 'IN_PRODUCTION', label: 'Üretime Girdi' },
  { key: 'MOLDING', label: 'Kalıplama' },
  { key: 'PAINTING', label: 'Boya / Apre' },
  { key: 'PACKAGING', label: 'Paketleme' },
  { key: 'READY_FOR_SHIPMENT', label: 'Sevkiyata Hazır' },
  { key: 'SHIPPED', label: 'Sevk Edildi' },
];

export default function OrderStepper({ status }: { status: string }) {
  const currentIdx = STEPS.findIndex(s => s.key === status);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max px-2 py-4">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  done ? 'bg-blue-600 border-blue-600 text-white' :
                  active ? 'bg-white border-blue-600 text-blue-600' :
                  'bg-white border-slate-300 text-slate-400'
                }`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'
                }`}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-10 mx-1 mb-5 transition-all ${i < currentIdx ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
