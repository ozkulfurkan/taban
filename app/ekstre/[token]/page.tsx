'use client';

import { useParams } from 'next/navigation';
import { SharedStatement } from '@/app/components/shared-statement';

export default function SharedStatementPage() {
  const params = useParams();
  const token = String(params?.token || '');
  return <SharedStatement endpoint={`/api/public/statement/${encodeURIComponent(token)}`} invalidOn404 />;
}
