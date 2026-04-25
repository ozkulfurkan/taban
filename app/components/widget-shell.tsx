'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, GripHorizontal, ChevronUp } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Shared collapse body ───────────────────────────────────────────────────

function CollapseBody({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Single full-width sortable widget ─────────────────────────────────────

interface WidgetShellProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function WidgetShell({
  id, title, icon, headerExtra, collapsed, onToggle, children,
}: WidgetShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
      className={`bg-white rounded-2xl border border-slate-100 overflow-hidden transition-shadow duration-200 ${isDragging ? 'shadow-2xl ring-2 ring-blue-200' : 'shadow-sm'}`}
    >
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 select-none bg-white">
        <button
          {...attributes} {...listeners}
          className="flex-shrink-0 p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors touch-none"
          tabIndex={-1} aria-label="Sürükle"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {icon && <span className="flex-shrink-0 text-slate-500">{icon}</span>}
        <h2 className="font-bold text-slate-800 text-sm flex-1 truncate">{title}</h2>
        {headerExtra && <div className="flex items-center gap-1.5 flex-shrink-0">{headerExtra}</div>}
        <button
          onClick={onToggle}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={collapsed ? 'Genişlet' : 'Küçült'}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.22 }}>
            <ChevronUp className="w-4 h-4" />
          </motion.div>
        </button>
      </div>
      <CollapseBody collapsed={collapsed}>{children}</CollapseBody>
    </div>
  );
}

// ── Non-sortable half-width card (used inside PairShell) ──────────────────

interface CardShellProps {
  title: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CardShell({ title, icon, headerExtra, collapsed, onToggle, children }: CardShellProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 select-none">
        {icon && <span className="flex-shrink-0 text-slate-500">{icon}</span>}
        <h2 className="font-bold text-slate-800 text-sm flex-1 truncate">{title}</h2>
        {headerExtra && <div className="flex items-center gap-1.5 flex-shrink-0">{headerExtra}</div>}
        <button
          onClick={onToggle}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={collapsed ? 'Genişlet' : 'Küçült'}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.22 }}>
            <ChevronUp className="w-4 h-4" />
          </motion.div>
        </button>
      </div>
      <CollapseBody collapsed={collapsed}>{children}</CollapseBody>
    </div>
  );
}

// ── Sortable pair: two half-width cards side by side ─────────────────────

interface SortablePairShellProps {
  id: string;
  left: { title: string; icon?: React.ReactNode; headerExtra?: React.ReactNode; collapsed: boolean; onToggle: () => void; children: React.ReactNode };
  right: { title: string; icon?: React.ReactNode; headerExtra?: React.ReactNode; collapsed: boolean; onToggle: () => void; children: React.ReactNode };
}

export function SortablePairShell({ id, left, right }: SortablePairShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
    >
      {/* Drag handle bar */}
      <div className={`flex items-center justify-center py-1.5 mb-1 rounded-xl transition-colors ${isDragging ? 'bg-blue-50' : 'hover:bg-slate-100/60'}`}>
        <button
          {...attributes} {...listeners}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors touch-none select-none"
          tabIndex={-1} aria-label="Grubu Sürükle"
        >
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-medium">Varlıklar &amp; Çekler</span>
        </button>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell {...left} />
        <CardShell {...right} />
      </div>
    </div>
  );
}
