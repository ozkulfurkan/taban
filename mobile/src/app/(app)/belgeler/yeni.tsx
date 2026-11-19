import { router, useLocalSearchParams } from 'expo-router';

import { NewDocument, parseDocKind } from '@/components/new-document';

// Belgeler sekmesinden yeni belge: kayıttan sonra belgenin detayı açılır
export default function NewDocumentScreen() {
  const params = useLocalSearchParams<{ kind?: string; partyId?: string }>();
  return (
    <NewDocument
      kind={parseDocKind(params.kind)}
      initialPartyId={params.partyId}
      onSaved={d => router.replace(`/belgeler/${d.purchase ? 'alis' : 'satis'}/${d.id}`)}
    />
  );
}
