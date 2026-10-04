'use client';

import {Notes} from '@/components/notes';
import {useWorkspaceMindSpaceId} from '@/components/workspace-context';

export default function NotesPage() {
  const mindSpaceId = useWorkspaceMindSpaceId();
  return <Notes key={mindSpaceId} mindSpaceId={mindSpaceId} />;
}
