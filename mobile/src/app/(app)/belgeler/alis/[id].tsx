import { Stack, useLocalSearchParams, useSegments } from 'expo-router';

import { DocumentView } from '@/components/document-view';
import { ErrorState, Loading } from '@/components/ui';
import { useApi } from '@/core/query';
import { round2 } from '@shared/money';

type Purchase = {
  id: string; invoiceNo: string | null; date: string; currency: string; isReturn: boolean; total: number; notes: string | null;
  supplier: { id: string; name: string };
  purchaseMaterials: {
    kgAmount: number; pricePerKg: number | null;
    material?: { name: string } | null; product?: { name: string; code?: string | null } | null; subcontractor?: { name: string } | null;
  }[];
};

export default function PurchaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<Purchase>(`/api/purchases/${id}`);
  // Cariler sekmesinden açıldıysa yeni belge de orada açılır (geri tuşu cariye döner)
  const inCariler = (useSegments() as string[]).includes('cariler');
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={(q.error as Error)?.message || 'Belge bulunamadı'} onRetry={() => { void q.refetch(); }} />;
  const p = q.data;
  const no = p.invoiceNo ?? 'Alış';
  return (
    <>
      <Stack.Screen options={{ title: no, headerLargeTitle: false }} />
      <DocumentView
        refreshing={q.isRefetching}
        onRefresh={() => { void q.refetch(); }}
        doc={{
          title: p.isReturn ? 'Tedarikçiye İade' : 'Alış',
          number: no,
          date: p.date,
          partyLabel: 'Tedarikçi',
          partyName: p.supplier.name,
          partyHref: `/cariler/supplier/${p.supplier.id}`,
          currency: p.currency,
          lines: p.purchaseMaterials.map(m => ({
            code: m.product?.code,
            description: [m.material?.name ?? m.product?.name ?? '', m.subcontractor ? `(${m.subcontractor.name} deposuna)` : ''].filter(Boolean).join(' '),
            quantity: m.kgAmount,
            unit: m.material ? 'kg' : undefined,
            unitPrice: m.pricePerKg,
            total: round2(m.kgAmount * (m.pricePerKg ?? 0)),
          })),
          subtotal: Math.abs(p.total),
          total: Math.abs(p.total),
          notes: p.notes,
          manage: { editHref: `/belgeler/duzenle?type=alis&id=${p.id}`, deletePath: `/api/purchases/${p.id}` },
          followUp: p.isReturn ? undefined : {
            label: 'İade et',
            href: inCariler ? `/cariler/supplier/${p.supplier.id}/yeni?doc=purchaseReturn` : `/belgeler/yeni?kind=purchaseReturn&partyId=${p.supplier.id}`,
          },
        }}
      />
    </>
  );
}
