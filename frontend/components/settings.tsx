'use client';

import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {type ThemePreference, useTheme} from '@/components/theme-provider';

const options: ThemePreference[] = ['light', 'dark', 'system'];

export function Settings() {
  const t = useTranslations('settings');
  const {preference, setPreference} = useTheme();

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <p className="app-eyebrow">{t('eyebrow')}</p>
        <h2 id="settings-title">{t('title')}</h2>
        <p>{t('description')}</p>
      </div>

      <fieldset className="settings-card">
        <legend>{t('appearance')}</legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('appearance')}>
          {options.map((option) => {
            const selected = preference === option;
            return (
              <Button
                key={option}
                type="button"
                variant={selected ? 'default' : 'outline'}
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(option)}
                className={cn('h-auto justify-start rounded-2xl px-4 py-4 text-start', selected ? '' : 'bg-card')}
              >
                <span className="grid gap-1">
                  <span>{t(option)}</span>
                  <span className="text-xs font-medium opacity-75">{t(`${option}Description`)}</span>
                </span>
              </Button>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
