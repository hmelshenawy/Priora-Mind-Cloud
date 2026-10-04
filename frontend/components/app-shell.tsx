'use client';

import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {getMindSpaces, MindSpacesError, type MindSpace} from '@/lib/api/mindspaces';
import {
  clearSelectedMindSpaceId,
  getSelectedMindSpaceId,
  saveSelectedMindSpaceId,
} from '@/lib/mindspace-selection';
import {CreateMindSpace} from '@/components/create-mindspace';
import {WorkspaceMindSpaceProvider} from '@/components/workspace-context';
import {WorkspaceHeader} from '@/components/workspace-header';
import {WorkspaceSidebar} from '@/components/workspace-sidebar';

type ShellStatus = 'loading' | 'success' | 'empty' | 'error';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'priora.sidebar.collapsed';

export function AppShell({children}: {children: ReactNode}) {
  const t = useTranslations('appShell');
  const onboarding = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<ShellStatus>('loading');
  const [mindSpaces, setMindSpaces] = useState<MindSpace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [workspaceNavOpen, setWorkspaceNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
  }, []);

  useEffect(() => {
    let isActive = true;
    const authState = getAuthState();

    function redirectToLogin() {
      clearAuthState();
      clearSelectedMindSpaceId();
      router.replace(`/${locale}/login`);
    }

    if (!authState?.accessToken) {
      redirectToLogin();
      return;
    }

    getMindSpaces(authState.accessToken)
      .then((response) => {
        if (!isActive) return;

        const nextMindSpaces = response.result;
        setMindSpaces(nextMindSpaces);

        if (nextMindSpaces.length === 0) {
          clearSelectedMindSpaceId();
          setSelectedId(null);
          setStatus('empty');
          return;
        }

        const storedId = getSelectedMindSpaceId();
        const nextSelectedId = storedId && nextMindSpaces.some(({id}) => id === storedId)
          ? storedId
          : nextMindSpaces[0].id;

        saveSelectedMindSpaceId(nextSelectedId);
        setSelectedId(nextSelectedId);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (!isActive) return;

        if (error instanceof MindSpacesError && error.code === 'unauthorized') {
          redirectToLogin();
          return;
        }

        setStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [locale, router]);

  const selectedMindSpace = mindSpaces.find(({id}) => id === selectedId);
  const userEmail = getAuthState()?.user.email;

  function handleSelection(mindSpaceId: string) {
    setSelectedId(mindSpaceId);
    saveSelectedMindSpaceId(mindSpaceId);
  }

  function handleCreated(mindSpace: MindSpace) {
    saveSelectedMindSpaceId(mindSpace.id);
    setMindSpaces((current) => [...current.filter(({id}) => id !== mindSpace.id), mindSpace]);
    setSelectedId(mindSpace.id);
    setStatus('success');
    setShowCreate(false);
  }

  function handleLogout() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  }

  return (
    <div className="app-shell workspace-shell">
      <WorkspaceSidebar
        open={workspaceNavOpen}
        onOpenChange={setWorkspaceNavOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsedChange}
      />
      <div className="workspace-column">
        <WorkspaceHeader
          userEmail={userEmail}
          mindSpaces={mindSpaces}
          selectedId={selectedId}
          onSelectMindSpace={handleSelection}
          onCreateMindSpace={() => setShowCreate(true)}
          onLogout={handleLogout}
          menu={<WorkspaceSidebar open={workspaceNavOpen} onOpenChange={setWorkspaceNavOpen} showDesktop={false} />}
        />

        <main className="workspace-main" tabIndex={-1}>
          {status === 'loading' ? (
            <p className="shell-state" aria-live="polite">
              {t('loading')}
            </p>
          ) : null}

          {status === 'empty' ? (
            <section className="mindspace-panel" aria-labelledby="mindspace-title">
              <CreateMindSpace onCreated={handleCreated} />
            </section>
          ) : null}

          {status === 'error' ? (
            <div className="shell-state shell-error" role="alert">
              <h2>{t('errorTitle')}</h2>
              <p>{t('errorDescription')}</p>
            </div>
          ) : null}

          {status === 'success' && showCreate ? (
            <section className="mindspace-panel" aria-labelledby="mindspace-title">
              <p className="app-eyebrow">{t('currentLabel')}</p>
              <h2 id="mindspace-title">{selectedMindSpace?.name ?? t('title')}</h2>
              <CreateMindSpace onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
            </section>
          ) : null}

          {status === 'success' && selectedId && !showCreate ? (
            <WorkspaceMindSpaceProvider mindSpaceId={selectedId}>{children}</WorkspaceMindSpaceProvider>
          ) : null}
        </main>
      </div>
    </div>
  );
}
