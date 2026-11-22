'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useEffect, useState } from 'react';
import { LucideIcon } from '@/app/components/icons';

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  decimals?: number;
}

export default function StatCard({ title, value, prefix, suffix, icon: Icon, color, decimals = 0 }: StatCardProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1000;
    const steps = 30;
    const increment = (value ?? 0) / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= (value ?? 0)) {
        current = value ?? 0;
        clearInterval(timer);
      }
      setDisplayValue(current);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, value]);

  const colorStyles: Record<string, string> = {
    blue: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-brand-50 text-brand-700',
    orange: 'bg-amber-50 text-amber-600',
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl p-5 shadow-card hover:shadow-md transition-shadow-card border border-ink-200/80"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink-500">{title}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorStyles[color] ?? colorStyles.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-ink-800">
        {prefix ?? ''}{displayValue?.toFixed?.(decimals) ?? '0'}{suffix ?? ''}
      </p>
    </motion.div>
  );
}
