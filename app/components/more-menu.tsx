'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, LucideIcon } from 'lucide-react';

export type MoreMenuItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

// "⋯" menüsü: silme gibi seyrek ve geri dönüşü zor işlemler ana düğmelerin
// yanında durmasın, bir tık geride kalsın diye.
export default function MoreMenu({
  items,
  label = 'Diğer işlemler',
  align = 'right',
  size = 'md',
}: {
  items: MoreMenuItem[];
  label?: string;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Menü fixed konumlanır: tablo gibi overflow-hidden kapların içinde kesilmesin.
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuH = items.length * 42 + 8;
      const up = r.bottom + menuH + 8 > window.innerHeight && r.top > menuH;
      setPos({
        position: 'fixed',
        top: up ? undefined : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : undefined,
        ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
      });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); e.preventDefault(); toggle(); }}
        className={`flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ${size === 'sm' ? 'w-8 h-8' : 'h-full min-h-[30px] px-2 border border-slate-200 bg-white'}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} role="menu" style={pos} className={`bg-white rounded-xl shadow-lg border border-slate-100 z-50 min-w-[180px] py-1`}>
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(false); item.onClick(); }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left disabled:opacity-50 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {item.icon && <item.icon className="w-4 h-4" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
