'use client';

import { Loader2, Save } from 'lucide-react';

// Uzun formların altında hep görünen kayıt çubuğu: solda özet (genel toplam),
// sağda kaydet. Telefonda alt menünün hemen üstünde durur.
export default function StickySaveBar({
  summaryLabel,
  summaryValue,
  onSave,
  saving = false,
  saveLabel = 'Kaydet',
  savingLabel = 'Kaydediliyor...',
  disabled = false,
  tone = 'primary',
  children,
}: {
  summaryLabel?: string;
  summaryValue?: React.ReactNode;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[60px] lg:bottom-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 mt-4 px-4 md:px-6 lg:px-8 py-3 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        {summaryLabel !== undefined && (
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 leading-tight">{summaryLabel}</p>
            <p className="text-lg font-bold text-slate-800 tabular-nums truncate">{summaryValue}</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${summaryLabel === undefined ? 'ml-auto' : ''}`}>
          {children}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || disabled}
            className={`flex items-center gap-1.5 px-5 py-2.5 ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
