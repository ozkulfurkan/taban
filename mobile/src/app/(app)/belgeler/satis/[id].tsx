import { Stack, useLocalSearchParams } from 'expo-router';

import { DocumentView } from '@/components/document-view';
import { ErrorState, Loading } from '@/components/ui';
import { useApi } from '@/core/query';

type Invoice = {
  id: string; invoiceNo: string; date: string; dueDate: string | null; currency: string; isReturn: boolean; status: string;
  subtotal: number; vatRate: number; vatAmount: number; total: number; paidAmount: number; notes: string | null;
  customer: { id: string; name: string };
  items: { description: string; quantity: number; unitPrice: number; discount: number; total: number; product?: { code?: string | null; unit?: string | null } | null }[];
};

const STATUS = {
  PAID: { label: 'Ödendi', tone: 'success' as const },
  PARTIAL: { label: 'Kısmi ödendi', tone: 'warning' as const },
  PENDING: { label: 'Açık', tone: 'neutral' as const },
};

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<Invoice>(`/api/invoices/${id}`);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={(q.error as Error)?.message || 'Belge bulunamadı'} onRetry={() => { void q.refetch(); }} />;
  const inv = q.data;
  return (
    <>
      <Stack.Screen options={{ title: inv.invoiceNo, headerLargeTitle: false }} />
      <DocumentView
        refreshing={q.isRefetching}
        onRefresh={() => { void q.refetch(); }}
        doc={{
          title: inv.isReturn ? 'İade Faturası' : 'Satış Faturası',
          number: inv.invoiceNo,
          date: inv.date,
          dueDate: inv.dueDate,
          partyLabel: 'Müşteri',
          partyName: inv.customer.name,
          partyHref: `/cariler/customer/${inv.customer.id}`,
          currency: inv.currency,
          lines: inv.items.map(i => ({
            code: i.product?.code, description: i.description, quantity: i.quantity, unit: i.product?.unit ?? undefined,
            unitPrice: i.unitPrice, discount: i.discount || undefined, total: i.total,
          })),
          subtotal: inv.subtotal,
          vatRate: inv.vatRate,
          vatAmount: inv.vatAmount,
          total: Math.abs(inv.total),
          notes: inv.notes,
          status: inv.isReturn ? undefined : STATUS[inv.status as keyof typeof STATUS],
          paid: inv.isReturn ? undefined : inv.paidAmount,
          followUp: inv.isReturn ? undefined : { label: 'İade al', href: `/belgeler/yeni?kind=return&partyId=${inv.customer.id}` },
        }}
      />
    </>
  );
}
