import type {ReactNode} from 'react';
import {AuthGate} from '@/components/auth-gate';
import {AppShell} from '@/components/app-shell';
import {ThemeProvider} from '@/components/theme-provider';

export default function WorkspaceLayout({children}: {children: ReactNode}) {
  return (
    <AuthGate>
      <ThemeProvider>
        <AppShell>{children}</AppShell>
      </ThemeProvider>
    </AuthGate>
  );
}
