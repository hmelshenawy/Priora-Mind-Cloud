'use client';

import {type FormEvent, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {createNote, getNote, listNotes, NotesApiError, type Note} from '@/lib/api/notes';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

type ListStatus = 'loading' | 'empty' | 'success' | 'error';
type SelectionStatus = 'idle' | 'loading' | 'success' | 'unavailable' | 'error';

export function Notes({mindSpaceId}: {mindSpaceId: string}) {
  const t = useTranslations('notes');
  const locale = useLocale();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus>('idle');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const mindSpaceRef = useRef(mindSpaceId);
  const selectedRef = useRef<string | null>(null);
  const listRequest = useRef(0);
  const selectionRequest = useRef(0);
  const createRequest = useRef(0);

  function redirectToLogin() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  useEffect(() => {
    const requestId = ++listRequest.current;
    mindSpaceRef.current = mindSpaceId;
    selectionRequest.current += 1;
    createRequest.current += 1;
    selectedRef.current = null;
    setNotes([]);
    setListStatus('loading');
    setSelectedId(null);
    setSelectedNote(null);
    setSelectionStatus('idle');
    setTitle('');
    setContent('');
    setTitleError('');
    setContentError('');
    setCreateError('');
    setIsCreating(false);

    const token = getAuthState()?.accessToken;
    if (!token) {
      redirectToLogin();
      return;
    }

    listNotes(token, mindSpaceId)
      .then((result) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        setNotes(result);
        setListStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch((error: unknown) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        if (error instanceof NotesApiError && error.code === 'unauthorized') {
          redirectToLogin();
          return;
        }
        setListStatus('error');
      });

    return () => {
      listRequest.current += 1;
      selectionRequest.current += 1;
      createRequest.current += 1;
    };
  }, [mindSpaceId, locale, router]);

  async function openNote(noteId: string) {
    const requestId = ++selectionRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    selectedRef.current = noteId;
    setSelectedId(noteId);
    setSelectedNote(null);
    setSelectionStatus('loading');

    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();

    try {
      const result = await getNote(token, noteId);
      if (
        requestId !== selectionRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        selectedRef.current !== noteId
      ) return;
      if (result.id !== noteId || result.mindSpaceId !== expectedMindSpace) {
        setSelectionStatus('unavailable');
        return;
      }
      setSelectedNote(result);
      setSelectionStatus('success');
    } catch (error) {
      if (
        requestId !== selectionRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        selectedRef.current !== noteId
      ) return;
      if (error instanceof NotesApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else {
        setSelectionStatus(
          error instanceof NotesApiError && error.code === 'notFound' ? 'unavailable' : 'error',
        );
      }
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const nextTitleError = trimmedTitle ? '' : t('titleValidation');
    const nextContentError = trimmedContent ? '' : t('contentValidation');
    setTitleError(nextTitleError);
    setContentError(nextContentError);
    setCreateError('');
    if (nextTitleError || nextContentError) return;

    const requestId = ++createRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();
    setIsCreating(true);

    try {
      const created = await createNote(token, {
        mindSpaceId: expectedMindSpace,
        title: trimmedTitle,
        content: trimmedContent,
      });
      if (requestId !== createRequest.current || mindSpaceRef.current !== expectedMindSpace) return;
      if (created.mindSpaceId !== expectedMindSpace) {
        setCreateError(t('createError'));
        return;
      }
      selectionRequest.current += 1;
      selectedRef.current = created.id;
      setNotes((current) => [created, ...current]);
      setListStatus('success');
      setSelectedId(created.id);
      setSelectedNote(created);
      setSelectionStatus('success');
      setTitle('');
      setContent('');
    } catch (error) {
      if (requestId !== createRequest.current || mindSpaceRef.current !== expectedMindSpace) return;
      if (error instanceof NotesApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else {
        setCreateError(t('createError'));
      }
    } finally {
      if (requestId === createRequest.current && mindSpaceRef.current === expectedMindSpace) {
        setIsCreating(false);
      }
    }
  }

  return (
    <section className="notes" aria-labelledby="notes-title">
      <aside className="notes-sidebar">
        <h2 id="notes-title">{t('title')}</h2>
        <form className="note-form" onSubmit={handleCreate} noValidate>
          <h3>{t('newNoteTitle')}</h3>
          <label htmlFor="note-title">{t('titleLabel')}</label>
          <input id="note-title" value={title} placeholder={t('titlePlaceholder')} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(titleError)} aria-describedby={titleError ? 'note-title-error' : undefined} />
          {titleError ? <p id="note-title-error" className="notes-error" role="alert">{titleError}</p> : null}
          <label htmlFor="note-content">{t('contentLabel')}</label>
          <textarea id="note-content" value={content} placeholder={t('contentPlaceholder')} onChange={(event) => setContent(event.target.value)} aria-invalid={Boolean(contentError)} aria-describedby={contentError ? 'note-content-error' : undefined} />
          {contentError ? <p id="note-content-error" className="notes-error" role="alert">{contentError}</p> : null}
          {createError ? <p className="notes-error" role="alert">{createError}</p> : null}
          <button type="submit" disabled={isCreating}>{isCreating ? t('creating') : t('create')}</button>
        </form>

        <h3 className="notes-list-title">{t('listTitle')}</h3>
        {listStatus === 'loading' ? <p aria-live="polite">{t('listLoading')}</p> : null}
        {listStatus === 'empty' ? <p>{t('listEmpty')}</p> : null}
        {listStatus === 'error' ? <p className="notes-error" role="alert">{t('listError')}</p> : null}
        {listStatus === 'success' ? (
          <ul className="notes-list">
            {notes.map((note) => (
              <li key={note.id}>
                <button type="button" className={selectedId === note.id ? 'active' : ''} aria-current={selectedId === note.id ? 'true' : undefined} onClick={() => openNote(note.id)}>{note.title}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      <article className="note-reader" aria-live="polite">
        {selectionStatus === 'idle' ? <><h2>{t('title')}</h2><p>{t('selectNote')}</p></> : null}
        {selectionStatus === 'loading' ? <p>{t('noteLoading')}</p> : null}
        {selectionStatus === 'unavailable' ? <p className="notes-error" role="alert">{t('noteUnavailable')}</p> : null}
        {selectionStatus === 'error' ? <p className="notes-error" role="alert">{t('noteError')}</p> : null}
        {selectionStatus === 'success' && selectedNote ? <><h2>{selectedNote.title}</h2><p className="note-body">{selectedNote.content}</p></> : null}
      </article>
    </section>
  );
}
