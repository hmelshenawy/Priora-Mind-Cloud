'use client';

import {Tasks} from '@/components/tasks';
import {useWorkspaceMindSpaceId} from '@/components/workspace-context';

export default function TasksPage() {
  const mindSpaceId = useWorkspaceMindSpaceId();
  return <Tasks key={mindSpaceId} mindSpaceId={mindSpaceId} />;
}
