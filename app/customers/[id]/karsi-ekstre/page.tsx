'use client';

import { useParams } from 'next/navigation';
import { LinkStatementPage } from '@/app/components/link-statement';

export default function CounterpartStatement() {
  const params = useParams();
  return <LinkStatementPage kind="customer" partyId={String(params?.id || '')} />;
}
