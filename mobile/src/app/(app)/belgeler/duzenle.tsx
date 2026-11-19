import { Stack, router, useLocalSearchParams } from 'expo-router';

import { NewDocument, type EditDoc } from '@/components/new-document';
import { ErrorState, Loading } from '@/components/ui';
import { amountToInput } from '@/core/amount';
import { lineKey, type DocKind } from '@/core/documents';
import { isoDay } from '@/core/format';
import { useApi } from '@/core/query';

type Invoice = {
  id: string; customerId: string; currency: string; isReturn: boolean; date: string; dueDate: string | null; vatRate: number; notes: string | null;
  items: { productId: string | null; description: string; quantity: number; unitPrice: number; discount: number | null; product?: { code?: string | null } | null }[];
};
type Purchase = {
  id: string; supplierId: string; currency: string; isReturn: boolean; date: string; notes: string | null;
  purchaseMaterials: {
    materialId: string | null; productId: string | null; subcontractorId: string | null; kgAmount: number; pricePerKg: number | null;
    material?: { name: string } | null; product?: { name: string; code?: string | null } | null;
  }[];
};

const day = (v: string | null) => (v ? isoDay(new Date(v)) : '');

// Satış / iade / alış düzenleme: belge okunur, kalemler forma çevrilir, kayıt PUT ile gider
export default function EditDocumentScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const purchase = type === 'alis';
  const inv = useApi<Invoice>(!purchase ? `/api/invoices/${id}` : null);
  const pur = useApi<Purchase>(purchase ? `/api/purchases/${id}` : null);
  const q = purchase ? pur : inv;

  if (q.isLoading) return <><Stack.Screen options={{ title: purchase ? 'Alış' : 'Satış' }} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={{ title: purchase ? 'Alış' : 'Satış' }} /><ErrorState message={(q.error as Error)?.message || 'Belge bulunamadı'} onRetry={() => { void q.refetch(); }} /></>;

  let kind: DocKind;
  let edit: EditDoc;
  if (purchase) {
    const p = pur.data!;
    kind = p.isReturn ? 'purchaseReturn' : 'purchase';
    edit = {
      id: p.id, partyId: p.supplierId, currency: p.currency, date: day(p.date), dueDate: '', vatRate: 0, notes: p.notes ?? '',
      lines: p.purchaseMaterials.map(m => ({
        key: lineKey(),
        type: m.materialId ? 'material' : 'product',
        materialId: m.materialId ?? undefined,
        productId: m.productId ?? undefined,
        subcontractorId: m.subcontractorId,
        code: m.product?.code ?? undefined,
        description: m.material?.name ?? m.product?.name ?? '',
        quantity: amountToInput(m.kgAmount, 3),
        unitPrice: amountToInput(m.pricePerKg ?? 0, 4),
        discount: '0',
      })),
    };
  } else {
    const i = inv.data!;
    kind = i.isReturn ? 'return' : 'sale';
    edit = {
      id: i.id, partyId: i.customerId, currency: i.currency, date: day(i.date), dueDate: day(i.dueDate), vatRate: i.vatRate ?? 0, notes: i.notes ?? '',
      lines: i.items.map(it => ({
        key: lineKey(),
        type: it.productId ? 'product' : 'free',
        productId: it.productId ?? undefined,
        code: it.product?.code ?? undefined,
        description: it.description,
        quantity: amountToInput(it.quantity, 3),
        unitPrice: amountToInput(it.unitPrice, 4),
        discount: amountToInput(it.discount ?? 0),
      })),
    };
  }

  return (
    <NewDocument
      key={edit.id}
      kind={kind}
      edit={edit}
      onSaved={() => router.back()}
    />
  );
}
