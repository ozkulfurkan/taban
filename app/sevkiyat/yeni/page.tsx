'use client';

// Yeni sevk fişi (form: app/sevkiyat/dispatch-form.tsx)
import { Suspense } from 'react';
import AppShell from '@/app/components/app-shell';
import { DispatchForm } from '@/app/sevkiyat/dispatch-form';

export default function Page() {
  return <AppShell><Suspense fallback={null}><DispatchForm /></Suspense></AppShell>;
}
