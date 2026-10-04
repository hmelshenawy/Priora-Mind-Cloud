'use client';

import {Documents} from '@/components/documents';
import {useWorkspaceMindSpaceId} from '@/components/workspace-context';

export default function DocumentsPage() {
  const mindSpaceId = useWorkspaceMindSpaceId();
  return <Documents key={mindSpaceId} mindSpaceId={mindSpaceId} />;
}
