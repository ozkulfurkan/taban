'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, ChevronUp } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        position: 'relative',
      }}
      className={`bg-white rounded-2xl border border-slate-100 overflow-hidden transition-shadow duration-200 ${
        isDragging ? 'shadow-2xl ring-2 ring-blue-200' : 'shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 select-none bg-white">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors touch-none"
          tabIndex={-1}
          aria-label="Sürükle"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Icon */}
        {icon && <span className="flex-shrink-0 text-slate-500">{icon}</span>}

        {/* Title */}
        <h2 className="font-bold text-slate-800 text-sm flex-1 truncate">{title}</h2>

        {/* Header slot */}
        {headerExtra && (
          <div className="flex items-center gap-1.5 flex-shrink-0">{headerExtra}</div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={collapsed ? 'Genişlet' : 'Küçült'}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.22 }}
          >
            <ChevronUp className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Collapsible body */}
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
    </div>
  );
}
