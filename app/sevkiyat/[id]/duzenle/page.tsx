'use client';

// Sevk fişi düzenle: kalemler, miktarlar, fiyatlar ve başlık (hesaba işlenmişse satış yeniden oluşturulur)
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/app/components/app-shell';
import { DispatchForm } from '@/app/sevkiyat/dispatch-form';

function Edit() {
  const params = useParams();
  return <DispatchForm editId={String(params?.id ?? '')} />;
}

export default function Page() {
  return <AppShell><Suspense fallback={null}><Edit /></Suspense></AppShell>;
}
