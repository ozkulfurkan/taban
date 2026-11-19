import { router, useLocalSearchParams } from 'expo-router';

import { NewDocument, parseDocKind } from '@/components/new-document';

// Cari ekranından yeni belge: Cariler sekmesinde kalır, geri tuşu cariye döner.
// "doc" verilmezse müşteride satış, tedarikçide alış açılır.
export default function PartyNewDocument() {
  const { kind, id, doc } = useLocalSearchParams<{ kind: string; id: string; doc?: string }>();
  const supplier = kind === 'supplier';
  return (
    <NewDocument
      kind={parseDocKind(doc, supplier ? 'purchase' : 'sale')}
      initialPartyId={id}
      onSaved={d => router.replace(`/cariler/${d.purchase ? 'alis' : 'satis'}/${d.id}`)}
    />
  );
}
