'use client';

import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

const WorkspaceMindSpaceContext = createContext<string | null>(null);

export function WorkspaceMindSpaceProvider({
  children,
  mindSpaceId,
}: {
  children: ReactNode;
  mindSpaceId: string;
}) {
  return (
    <WorkspaceMindSpaceContext.Provider value={mindSpaceId}>
      {children}
    </WorkspaceMindSpaceContext.Provider>
  );
}

export function useWorkspaceMindSpaceId() {
  const mindSpaceId = useContext(WorkspaceMindSpaceContext);
  if (!mindSpaceId) {
    throw new Error('useWorkspaceMindSpaceId must be used inside AppShell with a selected MindSpace.');
  }
  return mindSpaceId;
}
