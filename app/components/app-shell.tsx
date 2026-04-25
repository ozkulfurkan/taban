'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './sidebar';
import { Loader2, ChevronDown, LogOut, User, Clock, AlertTriangle } from 'lucide-react';

function UserMenu() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center">
          <User className="w-4 h-4 text-slate-600" />
        </div>
        <span className="text-sm font-medium text-slate-700 hidden sm:block">{user?.name ?? 'Kullanıcı'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700 truncate">{user?.name ?? 'Kullanıcı'}</p>
            <p className="text-xs text-slate-400 truncate">{user?.companyName ?? ''}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}

const IDLE_MS = 30 * 60 * 1000;     // 30 dakika
const WARN_BEFORE_MS = 60 * 1000;   // son 60 saniyede uyar

function useIdleLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(60);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      let remaining = 60;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 && countdownRef.current) clearInterval(countdownRef.current);
      }, 1000);
    }, IDLE_MS - WARN_BEFORE_MS);

    logoutTimerRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/login' });
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return { showWarning, countdown, onContinue: reset };
}

function IdleWarningModal({ countdown, onContinue }: { countdown: number; onContinue: () => void }) {
  const circumference = 2 * Math.PI * 22;
  const progress = countdown / 60;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl shadow-black/20 border border-slate-200"
      >
        {/* Icon + countdown ring */}
        <div className="flex justify-center mb-5">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="#f1f5f9" strokeWidth="3" />
              <circle
                cx="26" cy="26" r="22"
                fill="none"
                stroke={countdown <= 15 ? '#ef4444' : '#f59e0b'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Clock className={`w-5 h-5 mb-0.5 ${countdown <= 15 ? 'text-red-500' : 'text-amber-500'}`} />
              <span className={`text-sm font-bold leading-none ${countdown <= 15 ? 'text-red-600' : 'text-amber-600'}`}>
                {countdown}
              </span>
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-lg font-semibold text-slate-800">Oturum Kapanmak Üzere</h3>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            {countdown} saniye hareketsizlik nedeniyle oturumunuz otomatik olarak kapatılacak.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            Çıkış Yap
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/25"
          >
            Devam Et
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const { showWarning, countdown, onContinue } = useIdleLogout();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AnimatePresence>
        {showWarning && (
          <IdleWarningModal countdown={countdown} onContinue={onContinue} />
        )}
      </AnimatePresence>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur border-b border-slate-200/60">
          <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-end">
            <UserMenu />
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto p-4 pb-20 md:p-6 lg:p-8 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
