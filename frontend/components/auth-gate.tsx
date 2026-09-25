'use client';

import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {isAuthenticated} from '@/lib/auth-state';

export function AuthGate({children}: {children: ReactNode}) {
  const locale = useLocale();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/${locale}/login`);
      return;
    }

    setCanRender(true);
  }, [locale, router]);

  if (!canRender) return null;

  return <>{children}</>;
}
