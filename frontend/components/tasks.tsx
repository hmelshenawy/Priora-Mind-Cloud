'use client';

import {type FormEvent, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {
  createTask,
  listTasks,
  type Task,
  type TaskExecutor,
  TasksApiError,
} from '@/lib/api/tasks';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

type ListStatus = 'loading' | 'empty' | 'success' | 'error';

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === 'string' && task.id.trim().length > 0 &&
    typeof task.mindSpaceId === 'string' && task.mindSpaceId.trim().length > 0 &&
    typeof task.title === 'string' && task.title.trim().length > 0 &&
    (task.description === null || typeof task.description === 'string') &&
    typeof task.executor === 'string' && task.executor.trim().length > 0 &&
    typeof task.status === 'string' && task.status.trim().length > 0 &&
    typeof task.createdAt === 'string' && task.createdAt.trim().length > 0 &&
    typeof task.updatedAt === 'string' && task.updatedAt.trim().length > 0
  );
}

function taskList(value: unknown, mindSpaceId: string) {
  if (!Array.isArray(value)) return null;
  const tasks: Task[] = [];
  const seenIds = new Set<string>();
  for (const item of value) {
    if (!isTask(item) || item.mindSpaceId !== mindSpaceId) return null;
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      tasks.push(item);
    }
  }
  return tasks;
}

export function Tasks({mindSpaceId}: {mindSpaceId: string}) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [executor, setExecutor] = useState<TaskExecutor>('USER');
  const [titleError, setTitleError] = useState('');
  const [createError, setCreateError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [createSucceeded, setCreateSucceeded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const createToggleRef = useRef<HTMLButtonElement>(null);
  const wasFormOpen = useRef(false);
  const mindSpaceRef = useRef(mindSpaceId);
  const listRequest = useRef(0);
  const createRequest = useRef(0);

  function redirectToLogin() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  function handleUnauthorized(accessToken: string) {
    if (getAuthState()?.accessToken === accessToken) redirectToLogin();
  }

  useEffect(() => {
    const requestId = ++listRequest.current;
    mindSpaceRef.current = mindSpaceId;
    createRequest.current += 1;
    setTasks([]);
    setListStatus('loading');
    setIsFormOpen(false);
    setTitle('');
    setDescription('');
    setExecutor('USER');
    setTitleError('');
    setCreateError('');
    setRefreshError('');
    setCreateSucceeded(false);
    setIsCreating(false);
    setIsRevalidating(false);

    const token = getAuthState()?.accessToken;
    if (!token) {
      redirectToLogin();
      return;
    }

    listTasks(token, mindSpaceId)
      .then((result) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        const validTasks = taskList(result, mindSpaceId);
        if (!validTasks) {
          setListStatus('error');
          return;
        }
        setTasks(validTasks);
        setListStatus(validTasks.length === 0 ? 'empty' : 'success');
      })
      .catch((error: unknown) => {
        if (error instanceof TasksApiError && error.code === 'unauthorized') {
          handleUnauthorized(token);
          return;
        }
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        setListStatus('error');
      });

    return () => {
      listRequest.current += 1;
      createRequest.current += 1;
    };
  }, [mindSpaceId, locale, router]);

  useEffect(() => {
    if (wasFormOpen.current && !isFormOpen) createToggleRef.current?.focus();
    wasFormOpen.current = isFormOpen;
  }, [isFormOpen]);

  function executorLabel(executor: string) {
    if (executor === 'USER') return t('executorUser');
    if (executor === 'AGENT') return t('executorAgent');
    return executor;
  }

  function statusLabel(status: string) {
    if (status === 'PENDING') return t('statusPending');
    if (status === 'PROGRESS') return t('statusProgress');
    if (status === 'COMPLETED') return t('statusCompleted');
    if (status === 'CANCELLED') return t('statusCancelled');
    return status;
  }

  function createdAtLabel(createdAt: string) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return t('invalidDate');
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(date);
  }

  function resetDraft() {
    setTitle('');
    setDescription('');
    setExecutor('USER');
    setTitleError('');
    setCreateError('');
  }

  function closeForm() {
    if (isCreating) return;
    resetDraft();
    setIsFormOpen(false);
  }

  function revalidateTasks(accessToken: string, expectedMindSpace: string) {
    const requestId = ++listRequest.current;
    setIsRevalidating(true);
    listTasks(accessToken, expectedMindSpace)
      .then((result) => {
        if (
          requestId !== listRequest.current ||
          mindSpaceRef.current !== expectedMindSpace
        ) return;
        const validTasks = taskList(result, expectedMindSpace);
        if (!validTasks) {
          setRefreshError(t('refreshError'));
          return;
        }
        setTasks(validTasks);
        setListStatus(validTasks.length === 0 ? 'empty' : 'success');
        setRefreshError('');
      })
      .catch((error: unknown) => {
        if (error instanceof TasksApiError && error.code === 'unauthorized') {
          handleUnauthorized(accessToken);
          return;
        }
        if (
          requestId !== listRequest.current ||
          mindSpaceRef.current !== expectedMindSpace
        ) return;
        setRefreshError(t('refreshError'));
      })
      .finally(() => {
        if (
          requestId === listRequest.current &&
          mindSpaceRef.current === expectedMindSpace
        ) setIsRevalidating(false);
      });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const nextTitleError = trimmedTitle ? '' : t('titleRequired');
    setTitleError(nextTitleError);
    setCreateError('');
    setRefreshError('');
    setCreateSucceeded(false);
    if (nextTitleError) return;

    const requestId = ++createRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    const token = getAuthState()?.accessToken;
    if (!token) {
      redirectToLogin();
      return;
    }
    setIsCreating(true);

    try {
      const created = await createTask(token, {
        mindSpaceId: expectedMindSpace,
        title: trimmedTitle,
        ...(trimmedDescription ? {description: trimmedDescription} : {}),
        executor,
      });
      if (
        requestId !== createRequest.current ||
        mindSpaceRef.current !== expectedMindSpace
      ) return;
      if (!isTask(created) || created.mindSpaceId !== expectedMindSpace) {
        setCreateError(t('createError'));
        return;
      }

      setTasks((current) => {
        const existingIndex = current.findIndex(({id}) => id === created.id);
        if (existingIndex === -1) return [created, ...current];
        const next = [...current];
        next[existingIndex] = created;
        return next;
      });
      setListStatus('success');
      resetDraft();
      setIsFormOpen(false);
      setCreateSucceeded(true);
      setIsCreating(false);
      revalidateTasks(token, expectedMindSpace);
    } catch (error) {
      if (error instanceof TasksApiError && error.code === 'unauthorized') {
        handleUnauthorized(token);
        return;
      }
      if (
        requestId !== createRequest.current ||
        mindSpaceRef.current !== expectedMindSpace
      ) return;
      setCreateError(t('createError'));
    } finally {
      if (
        requestId === createRequest.current &&
        mindSpaceRef.current === expectedMindSpace
      ) setIsCreating(false);
    }
  }

  return (
    <section className="tasks" aria-labelledby="tasks-title">
      <div className="tasks-heading">
        <div>
          <h2 id="tasks-title">{t('title')}</h2>
          <p>{t('description')}</p>
        </div>
        <button
          ref={createToggleRef}
          className="tasks-create-toggle"
          type="button"
          aria-expanded={isFormOpen}
          aria-controls="task-create-form"
          onClick={() => {
            setIsFormOpen(true);
            setCreateSucceeded(false);
          }}
        >
          {t('createAction')}
        </button>
      </div>

      {isFormOpen ? (
        <form id="task-create-form" className="task-form" onSubmit={handleCreate} noValidate>
          <label htmlFor="task-title">{t('titleLabel')}</label>
          <input
            id="task-title"
            value={title}
            placeholder={t('titlePlaceholder')}
            disabled={isCreating}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? 'task-title-error' : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleError('');
            }}
          />
          {titleError ? <p id="task-title-error" className="tasks-error" role="alert">{titleError}</p> : null}

          <label htmlFor="task-description">{t('descriptionLabel')}</label>
          <textarea
            id="task-description"
            value={description}
            placeholder={t('descriptionPlaceholder')}
            disabled={isCreating}
            onChange={(event) => setDescription(event.target.value)}
          />

          <label htmlFor="task-executor">{t('executorLabel')}</label>
          <select
            id="task-executor"
            value={executor}
            disabled={isCreating}
            onChange={(event) => setExecutor(event.target.value as TaskExecutor)}
          >
            <option value="USER">{t('executorUser')}</option>
            <option value="AGENT">{t('executorAgent')}</option>
          </select>

          {createError ? <p className="tasks-error" role="alert">{createError}</p> : null}
          <div className="task-form-actions">
            <button type="button" className="task-cancel" disabled={isCreating} onClick={closeForm}>{t('closeCreate')}</button>
            <button type="submit" disabled={isCreating}>{isCreating ? t('submitting') : t('submit')}</button>
          </div>
        </form>
      ) : null}

      <div className="task-create-status" aria-live="polite">
        {isCreating ? <span className="visually-hidden">{t('submitting')}</span> : null}
        {createSucceeded ? <p className="tasks-success">{t('createSuccess')}</p> : null}
        {refreshError ? <p className="tasks-error" role="alert">{refreshError}</p> : null}
        {isRevalidating ? <span className="visually-hidden">{t('loading')}</span> : null}
      </div>

      <div className="tasks-list-status" aria-live="polite">
        {listStatus === 'loading' ? <p>{t('loading')}</p> : null}
        {listStatus === 'empty' ? <p>{t('empty')}</p> : null}
      </div>
      {listStatus === 'error' ? <p className="tasks-error" role="alert">{t('listError')}</p> : null}
      {listStatus === 'success' ? (
        <ul className="tasks-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <h3>{task.title}</h3>
              {task.description?.trim() ? <p className="task-description">{task.description}</p> : null}
              <dl className="task-metadata">
                <div><dt>{t('executorLabel')}</dt><dd>{executorLabel(task.executor)}</dd></div>
                <div><dt>{t('statusLabel')}</dt><dd>{statusLabel(task.status)}</dd></div>
                <div><dt>{t('createdAt')}</dt><dd><time dateTime={task.createdAt}>{createdAtLabel(task.createdAt)}</time></dd></div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
