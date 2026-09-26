'use client';

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
import {Chat} from '@/components/chat';
import {Documents} from '@/components/documents';
import {Notes} from '@/components/notes';

type ShellStatus = 'loading' | 'success' | 'empty' | 'error';

export function AppShell() {
  const t = useTranslations('appShell');
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<ShellStatus>('loading');
  const [mindSpaces, setMindSpaces] = useState<MindSpace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  function handleSelection(mindSpaceId: string) {
    setSelectedId(mindSpaceId);
    saveSelectedMindSpaceId(mindSpaceId);
  }

  function handleLogout() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-eyebrow">{t('eyebrow')}</p>
          <p className="app-brand">{t('brand')}</p>
        </div>
        <button className="shell-button" type="button" onClick={handleLogout}>
          {t('logout')}
        </button>
      </header>

      <main className="app-main">
        <section className="mindspace-panel" aria-labelledby="mindspace-title">
          <div className="panel-heading">
            <p className="app-eyebrow">{t('currentLabel')}</p>
            <h1 id="mindspace-title">{selectedMindSpace?.name ?? t('title')}</h1>
          </div>

          {status === 'loading' ? (
            <p className="shell-state" aria-live="polite">
              {t('loading')}
            </p>
          ) : null}

          {status === 'empty' ? (
            <div className="shell-state" aria-live="polite">
              <h2>{t('emptyTitle')}</h2>
              <p>{t('emptyDescription')}</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="shell-state shell-error" role="alert">
              <h2>{t('errorTitle')}</h2>
              <p>{t('errorDescription')}</p>
            </div>
          ) : null}

          {status === 'success' && selectedId ? (
            <div className="mindspace-control">
              <label htmlFor="mindspace-selector">{t('selectorLabel')}</label>
              <select
                id="mindspace-selector"
                value={selectedId}
                onChange={(event) => handleSelection(event.target.value)}
              >
                {mindSpaces.map((mindSpace) => (
                  <option key={mindSpace.id} value={mindSpace.id}>
                    {mindSpace.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>
        {status === 'success' && selectedId ? (
          <>
            <Documents key={`documents-${selectedId}`} mindSpaceId={selectedId} />
            <Chat mindSpaceId={selectedId} />
            <Notes key={`notes-${selectedId}`} mindSpaceId={selectedId} />
          </>
        ) : null}
      </main>
    </div>
  );
}
