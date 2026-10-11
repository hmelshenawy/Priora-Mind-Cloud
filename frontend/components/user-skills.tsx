'use client';

import {type FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';
import {createUserSkill, deleteUserSkill, getUserSkill, listUserSkills, updateUserSkill,
  UserSkillsApiError, type UserSkill, type CreateUserSkillInput} from '@/lib/api/user-skills';

const blank: CreateUserSkillInput = {name: '', description: '', instructions: ''};

export function UserSkills() {
  const t = useTranslations('userSkills');
  const locale = useLocale();
  const router = useRouter();
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [editor, setEditor] = useState<'create' | 'view' | 'edit' | null>(null);
  const [selected, setSelected] = useState<UserSkill | null>(null);
  const [draft, setDraft] = useState(blank);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const generation = useRef(0);
  const locked = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);

  const handleError = useCallback((cause: unknown, token: string) => {
    if (cause instanceof UserSkillsApiError && cause.code === 'unauthorized') {
      if (getAuthState()?.accessToken !== token) return;
      clearAuthState();
      clearSelectedMindSpaceId();
      router.replace(`/${locale}/login`);
    } else {
      setError(cause instanceof UserSkillsApiError ? cause.code : 'requestFailed');
    }
  }, [locale, router]);

  const load = useCallback(async (token: string) => {
    const summaries = await listUserSkills(token);
    // The list DTO contains only id, name and description.
    return Promise.all(summaries.map(({id}) => getUserSkill(token, id)));
  }, []);

  const refresh = useCallback(async () => {
    const id = ++generation.current;
    const token = getAuthState()?.accessToken;
    if (!token) { router.replace(`/${locale}/login`); return; }
    locked.current = true;
    setBusy(true);
    setStatus('loading');
    setError('');
    try {
      const result = await load(token);
      if (id !== generation.current || getAuthState()?.accessToken !== token) return;
      setSkills(result);
      setStatus('success');
    } catch (cause) {
      if (id !== generation.current || getAuthState()?.accessToken !== token) return;
      setStatus('error');
      handleError(cause, token);
    } finally {
      if (id === generation.current) { locked.current = false; setBusy(false); }
    }
  }, [handleError, load, locale, router]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; locked.current = false; };
  }, [refresh]);

  useEffect(() => { if (editor) editorHeading.current?.focus(); }, [editor, selected?.id]);

  function open(skill: UserSkill | null, mode: 'create' | 'view' | 'edit') {
    setSelected(skill);
    setDraft(skill ? {name: skill.name, description: skill.description, instructions: skill.instructions} : blank);
    setEnabled(skill?.isEnabled ?? true);
    setEditor(mode);
    setError('');
    setSuccess('');
  }

  function close() { setEditor(null); newButton.current?.focus(); }

  async function mutate(action: (token: string) => Promise<unknown>, message: string, deletedId?: string) {
    if (locked.current) return;
    const token = getAuthState()?.accessToken;
    if (!token) { router.replace(`/${locale}/login`); return; }
    const id = ++generation.current;
    const current = () => id === generation.current && getAuthState()?.accessToken === token;
    locked.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    let applied = false;
    try {
      await action(token);
      if (!current()) return;
      applied = true;
      const result = await load(token);
      if (!current()) return;
      setSkills(result);
      setStatus('success');
      if (deletedId && result.some(({id: skillId}) => skillId === deletedId)) {
        throw new UserSkillsApiError('deleteFailed');
      }
      close();
      setSuccess(message);
    } catch (cause) {
      if (!current()) return;
      // A successful write followed by a failed refresh must not invite duplicate creation.
      if (applied && !(cause instanceof UserSkillsApiError && cause.code === 'deleteFailed')) {
        close();
        setStatus('error');
        setSuccess(deletedId ? '' : message);
      }
      handleError(cause, token);
    } finally {
      if (current()) { locked.current = false; setBusy(false); }
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {name: draft.name.trim(), description: draft.description.trim(), instructions: draft.instructions.trim()};
    if (Object.values(input).some((value) => !value)) { setError('validation'); return; }
    if (editor === 'edit' && selected) {
      void mutate((token) => updateUserSkill(token, selected.id, {...input, isEnabled: enabled}), 'saved');
    } else {
      void mutate((token) => createUserSkill(token, input), 'created');
    }
  }

  function remove(skill: UserSkill) {
    if (!window.confirm(t('confirmDelete', {name: skill.name}))) return;
    void mutate((token) => deleteUserSkill(token, skill.id), 'deleted', skill.id);
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6" aria-labelledby="skills-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="skills-title" className="text-2xl font-bold">{t('title')}</h2><p className="mt-2 text-muted-foreground">{t('subtitle')}</p></div>
        <Button ref={newButton} disabled={busy} onClick={() => open(null, 'create')}>{t('new')}</Button>
      </div>
      {success ? <p role="status">{t(success)}</p> : null}
      {error ? <p className="text-destructive" role="alert">{t(error)}</p> : null}
      {busy ? <p role="status">{t('loading')}</p> : null}
      {status === 'error' ? <Button className="justify-self-start" variant="outline" disabled={busy} onClick={() => void refresh()}>{t('retry')}</Button> : null}
      {editor ? (
        <article className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <h3 ref={editorHeading} tabIndex={-1} className="mb-4 break-words text-xl font-bold">{editor === 'create' ? t('new') : selected?.name}</h3>
          {editor === 'view' && selected ? (
            <div className="grid gap-4">
              <p>{t(selected.isEnabled ? 'enabled' : 'disabled')}</p>
              <div><h4 className="font-bold">{t('description')}</h4><p className="whitespace-pre-wrap break-words">{selected.description}</p></div>
              <div><h4 className="font-bold">{t('instructions')}</h4><p className="whitespace-pre-wrap break-words">{selected.instructions}</p></div>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => open(selected, 'edit')}>{t('edit')}</Button><Button variant="outline" disabled={busy} onClick={close}>{t('close')}</Button></div>
            </div>
          ) : (
            <form onSubmit={save} className="grid gap-4">
              {(['name', 'description', 'instructions'] as const).map((field) => {
                const props = {id: `skill-${field}`, required: true, maxLength: field === 'name' ? 100 : field === 'description' ? 500 : 5000,
                  value: draft[field], disabled: busy, className: 'w-full rounded-xl border border-border bg-background p-3 text-foreground',
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({...draft, [field]: event.target.value})};
                return <div key={field} className="grid min-w-0 gap-2"><label htmlFor={props.id}>{t(field)}</label>{field === 'name' ? <input {...props} /> : <textarea {...props} rows={field === 'instructions' ? 10 : 3} />}</div>;
              })}
              {editor === 'edit' ? <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />{t('enabled')}</label> : <p className="text-sm text-muted-foreground">{t('createEnabled')}</p>}
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{t(editor === 'create' ? 'create' : 'save')}</Button><Button type="button" variant="outline" disabled={busy} onClick={close}>{t('cancel')}</Button></div>
            </form>
          )}
        </article>
      ) : null}
      {status === 'success' && skills.length === 0 ? <p className="rounded-2xl border border-border p-6">{t('empty')}</p> : null}
      {status === 'success' ? <ul className="grid gap-4 md:grid-cols-2">
        {skills.map((skill) => <li key={skill.id} className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <h3 className="break-words text-lg font-bold">{skill.name}</h3>
          <p className="my-2 text-sm text-muted-foreground">{t(skill.isEnabled ? 'enabled' : 'disabled')}</p>
          <p className="whitespace-pre-wrap break-words">{skill.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => open(skill, 'view')}>{t('view')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => open(skill, 'edit')}>{t('edit')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => void mutate((token) => updateUserSkill(token, skill.id, {isEnabled: !skill.isEnabled}), 'saved')}>{t(skill.isEnabled ? 'disable' : 'enable')}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => remove(skill)}>{t('delete')}</Button>
          </div>
        </li>)}
      </ul> : null}
    </section>
  );
}
