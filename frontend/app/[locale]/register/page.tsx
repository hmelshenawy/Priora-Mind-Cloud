'use client';

import {FormEvent, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {login, register, RegisterError} from '@/lib/api/auth';
import {saveAuthState} from '@/lib/auth-state';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = t('emailRequired');
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) nextErrors.email = t('emailInvalid');
    if (!password) nextErrors.password = t('passwordRequired');
    else if (password.length < 5) nextErrors.password = t('passwordTooShort');

    setFieldErrors(nextErrors);
    setFormError('');

    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);

    let accountCreated = registered;
    try {
      if (!accountCreated) {
        await register({email: trimmedEmail, password});
        accountCreated = true;
        setRegistered(true);
      }
      const authState = await login({email: trimmedEmail, password});
      saveAuthState(authState);
      clearSelectedMindSpaceId();
      router.replace(`/${locale}/app`);
    } catch (error) {
      if (accountCreated) {
        setFormError(t('registrationLoginFailed'));
      } else if (error instanceof RegisterError && error.code === 'duplicateEmail') {
        setFormError(t('duplicateEmail'));
      } else {
        setFormError(t('networkError'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title">{t('createAccount')}</h1>
        <p>{t('registerDescription')}</p>

        {formError ? (
          <div className="form-error" role="alert">
            {formError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
          <div className="field">
            <label htmlFor="email">{t('emailLabel')}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={isLoading || registered}
              value={email}
              placeholder={t('emailPlaceholder')}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldErrors.email ? (
              <span className="field-error" id="email-error">
                {fieldErrors.email}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="password">{t('passwordLabel')}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={5}
              disabled={isLoading}
              value={password}
              placeholder={t('passwordPlaceholder')}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password ? (
              <span className="field-error" id="password-error">
                {fieldErrors.password}
              </span>
            ) : null}
          </div>

          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? t('registerLoading') : registered ? t('retryLogin') : t('createAccount')}
          </button>
        </form>
        <div className="landing-actions"><Link href={`/${locale}/login`}>{t('submit')}</Link></div>
      </section>
    </main>
  );
}
