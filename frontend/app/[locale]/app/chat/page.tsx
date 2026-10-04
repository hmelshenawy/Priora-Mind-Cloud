'use client';

import {Chat} from '@/components/chat';
import {useWorkspaceMindSpaceId} from '@/components/workspace-context';

export default function ChatPage() {
  const mindSpaceId = useWorkspaceMindSpaceId();
  return <Chat mindSpaceId={mindSpaceId} />;
}
