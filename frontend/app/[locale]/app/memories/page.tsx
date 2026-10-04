'use client';

import {useTranslations} from 'next-intl';

export default function MemoriesPage() {
  const t = useTranslations('memories');

  return (
    <section className="rounded-[24px] border border-border bg-card p-8 text-card-foreground shadow-[0_24px_60px_rgba(31,41,51,0.10)]" aria-labelledby="memories-title">
      <p className="app-eyebrow">{t('eyebrow')}</p>
      <h2 id="memories-title" className="mt-2 text-3xl font-bold">{t('title')}</h2>
      <p className="mt-3 max-w-xl text-muted-foreground">{t('description')}</p>
    </section>
  );
}
