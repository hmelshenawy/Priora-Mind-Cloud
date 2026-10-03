'use client';

import {type FormEvent, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {createMindSpace, MindSpacesError, type MindSpace} from '@/lib/api/mindspaces';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

export function CreateMindSpace({onCreated, onCancel}: {
  onCreated: (mindSpace: MindSpace) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setValidation('');
    if (!name.trim()) {
      setValidation(t('nameRequired'));
      return;
    }
    const token = getAuthState()?.accessToken;
    function redirectToLogin() {
      clearAuthState();
      clearSelectedMindSpaceId();
      router.replace(`/${locale}/login`);
    }
    if (!token) {
      redirectToLogin();
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const mindSpace = await createMindSpace(token, name.trim());
      if (getAuthState()?.accessToken !== token) return;
      onCreated(mindSpace);
    } catch (cause) {
      if (getAuthState()?.accessToken !== token) return;
      if (cause instanceof MindSpacesError && cause.code === 'unauthorized') {
        redirectToLogin();
      } else {
        setError(t('createError'));
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">{t(onCancel ? 'create' : 'title')}</h2>
      <p>{t(onCancel ? 'additionalDescription' : 'description')}</p>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
        <div className="field">
          <label htmlFor="mindspace-name">{t('nameLabel')}</label>
          <input id="mindspace-name" name="name" value={name} disabled={loading}
            aria-invalid={Boolean(validation)} aria-describedby={validation ? 'name-error' : undefined}
            onChange={(event) => setName(event.target.value)} />
          {validation ? <span className="field-error" id="name-error">{validation}</span> : null}
        </div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? t('creating') : t('create')}
        </button>
        {onCancel ? (
          <div className="landing-actions">
            <button className="shell-button" type="button" disabled={loading} onClick={onCancel}>
              {t('cancel')}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
