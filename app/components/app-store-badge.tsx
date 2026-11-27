// "App Store'dan İndirin" düğmesi (Apple'ın resmi rozet görseli ve logosu kullanılmaz)
import { APP_STORE_URL } from '@/lib/app-links';
import { Smartphone } from '@/app/components/icons';

export function AppStoreBadge({ className = '', size = 'md', testId = 'app-store-badge' }: { className?: string; size?: 'sm' | 'md'; testId?: string }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs gap-1.5' : 'px-4 py-2.5 text-sm gap-2';
  return (
    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" data-testid={testId}
      className={`inline-flex items-center rounded-xl bg-black text-white hover:bg-ink-800 transition-colors ${pad} ${className}`}>
      <Smartphone className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
      <span className="flex flex-col leading-tight text-left">
        <span className={size === 'sm' ? 'text-[9px] opacity-80' : 'text-[10px] opacity-80'}>iPhone uygulaması</span>
        <span className="font-semibold">App Store&apos;dan İndirin</span>
      </span>
    </a>
  );
}
