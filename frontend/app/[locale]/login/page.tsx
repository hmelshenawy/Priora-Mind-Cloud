'use client';

import {FormEvent, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {LoginError, login} from '@/lib/api/auth';
import {saveAuthState} from '@/lib/auth-state';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = t('emailRequired');
    if (!password) nextErrors.password = t('passwordRequired');

    setFieldErrors(nextErrors);
    setFormError('');

    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);

    try {
      const authState = await login({email: trimmedEmail, password});
      saveAuthState(authState);
      router.replace(`/${locale}/app`);
    } catch (error) {
      if (error instanceof LoginError && error.code === 'invalidCredentials') {
        setFormError(t('invalidCredentials'));
      } else {
        setFormError(t('networkError'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">{t('loginTitle')}</h1>
        <p>{t('loginDescription')}</p>

        {formError ? (
          <div className="form-error" role="alert">
            {formError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">{t('emailLabel')}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
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
              autoComplete="current-password"
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
            {isLoading ? t('loading') : t('submit')}
          </button>
        </form>
      </section>
    </main>
  );
}
