'use client';

import {useTranslations} from 'next-intl';
import {useSelectedLayoutSegment} from 'next/navigation';
import type {ReactNode} from 'react';
import type {MindSpace} from '@/lib/api/mindspaces';
import {Avatar, AvatarFallback} from '@/components/ui/avatar';
import {Button} from '@/components/ui/button';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip';

const titleKeys: Record<string, string> = {
  chat: 'sectionChat',
  documents: 'sectionDocuments',
  tasks: 'sectionTasks',
  notes: 'sectionNotes',
  memories: 'sectionMemories',
  settings: 'sectionSettings',
};

function emailInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || '?';
}

export function WorkspaceHeader({
  userEmail,
  mindSpaces,
  selectedId,
  onSelectMindSpace,
  onCreateMindSpace,
  onLogout,
  menu,
}: {
  userEmail?: string;
  mindSpaces: MindSpace[];
  selectedId: string | null;
  onSelectMindSpace: (mindSpaceId: string) => void;
  onCreateMindSpace: () => void;
  onLogout: () => void;
  menu: ReactNode;
}) {
  const t = useTranslations('appShell');
  const onboarding = useTranslations('onboarding');
  const segment = useSelectedLayoutSegment();
  const title = segment && titleKeys[segment] ? t(titleKeys[segment]) : t('title');

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {menu}
        <div className="min-w-0">
          <p className="app-eyebrow">{t('eyebrow')}</p>
          <h1 className="truncate text-xl font-extrabold lg:text-2xl">{title}</h1>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {selectedId ? (
          <div className="min-w-44 max-w-64">
            <label className="sr-only" htmlFor="workspace-mindspace-select">{t('selectorLabel')}</label>
            <Select value={selectedId} onValueChange={onSelectMindSpace}>
              <SelectTrigger id="workspace-mindspace-select" aria-label={t('selectorLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mindSpaces.map((mindSpace) => (
                  <SelectItem key={mindSpace.id} value={mindSpace.id}>{mindSpace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {selectedId ? (
          <Button type="button" variant="outline" onClick={onCreateMindSpace}>{onboarding('create')}</Button>
        ) : null}

        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={t('accountLabel')}>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{emailInitial(userEmail)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{userEmail}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {userEmail ? <DropdownMenuLabel className="max-w-64 truncate">{userEmail}</DropdownMenuLabel> : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout}>{t('logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </header>
  );
}
