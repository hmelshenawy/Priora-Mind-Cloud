'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {useSelectedLayoutSegment} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from '@/components/ui/sheet';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';

const sections = [
  {segment: 'chat', key: 'sectionChat', icon: 'C'},
  {segment: 'documents', key: 'sectionDocuments', icon: 'D'},
  {segment: 'tasks', key: 'sectionTasks', icon: 'T'},
  {segment: 'notes', key: 'sectionNotes', icon: 'N'},
  {segment: 'memories', key: 'sectionMemories', icon: 'M'},
] as const;

const settingsSection = {segment: 'settings', key: 'sectionSettings', icon: 'S'} as const;

function NavLink({section, collapsed, onNavigate}: {
  section: typeof sections[number] | typeof settingsSection;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('appShell');
  const locale = useLocale();
  const active = useSelectedLayoutSegment();
  const tooltipSide = locale === 'ar' ? 'left' : 'right';
  const isActive = active === section.segment;
  const label = t(section.key);
  const link = (
    <Link
      href={`/${locale}/app/${section.segment}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-ring',
        collapsed ? 'justify-center px-2' : '',
        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted',
      )}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-black" aria-hidden="true">{section.icon}</span>
      <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

function NavLinks({collapsed = false, onNavigate}: {collapsed?: boolean; onNavigate?: () => void}) {
  const t = useTranslations('appShell');

  return (
    <nav aria-label={t('navLabel')} className="grid gap-2">
      {sections.map((section) => <NavLink key={section.segment} section={section} collapsed={collapsed} onNavigate={onNavigate} />)}
    </nav>
  );
}

export function WorkspaceSidebar({open, onOpenChange, showDesktop = true, collapsed = false, onCollapsedChange}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showDesktop?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const t = useTranslations('appShell');
  const locale = useLocale();
  const side = locale === 'ar' ? 'right' : 'left';
  const tooltipSide = locale === 'ar' ? 'left' : 'right';
  const collapseLabel = collapsed ? t('expandSidebar') : t('collapseSidebar');

  return (
    <>
      {showDesktop ? (
        <TooltipProvider delayDuration={120}>
          <aside
            data-sidebar-collapsed={collapsed ? 'true' : 'false'}
            className={cn(
              'hidden min-h-0 shrink-0 flex-col border-r border-border bg-card/90 p-5 transition-[width,padding] duration-200 ease-out lg:flex rtl:border-l rtl:border-r-0',
              collapsed ? 'w-20 px-3' : 'w-64',
            )}
          >
            <div className={cn('mb-8 min-w-0', collapsed ? 'text-center' : '')}>
              <p className={cn('app-eyebrow', collapsed ? 'sr-only' : '')}>{t('eyebrow')}</p>
              <p className={cn('mt-2 truncate text-xl font-extrabold', collapsed ? 'text-center text-base' : '')}>{collapsed ? 'PMC' : t('brand')}</p>
            </div>
            <NavLinks collapsed={collapsed} />
            <div className="mt-auto grid gap-2 border-t border-border pt-4">
              <NavLink section={settingsSection} collapsed={collapsed} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size={collapsed ? 'icon' : 'default'}
                    aria-label={collapseLabel}
                    aria-expanded={!collapsed}
                    onClick={() => onCollapsedChange?.(!collapsed)}
                    className={cn(collapsed ? 'mx-auto' : 'w-full justify-start')}
                  >
                    <span aria-hidden="true">{collapsed ? '>' : '<'}</span>
                    <span className={collapsed ? 'sr-only' : ''}>{collapseLabel}</span>
                  </Button>
                </TooltipTrigger>
                {collapsed ? <TooltipContent side={tooltipSide}>{collapseLabel}</TooltipContent> : null}
              </Tooltip>
            </div>
          </aside>
        </TooltipProvider>
      ) : null}

      {!showDesktop ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>
            <Button className="lg:hidden" variant="outline" type="button" aria-label={t('menuOpen')} aria-expanded={open}>
              ☰
            </Button>
          </SheetTrigger>
          <SheetContent side={side} className="grid grid-rows-[auto_minmax(0,1fr)_auto] gap-6 bg-card pt-10">
            <SheetHeader>
              <SheetTitle>{t('brand')}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto">
              <NavLinks onNavigate={() => onOpenChange(false)} />
            </div>
            <div className="border-t border-border pt-4">
              <NavLink section={settingsSection} collapsed={false} onNavigate={() => onOpenChange(false)} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
