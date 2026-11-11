import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { HitlApproval, HitlDecision } from '@/lib/api/conversations';

export function ApprovalCard({ approval, disabled, onDecision }: {
  approval: HitlApproval;
  disabled: boolean;
  onDecision: (decision: HitlDecision) => void;
}) {
  const t = useTranslations('chat');
  const status = approval.status ?? 'pending';
  const statusLabel = approval.submitting ? t('approvalSubmitting')
    : status === 'approved' ? t('approvalApproved')
    : status === 'expired' ? t('approvalExpired')
    : status === 'rejected' ? t('approvalRejected') : t('pendingApproval');
  const buttonsDisabled = disabled || approval.submitting || status !== 'pending';
  return (
    <section aria-label={t('pendingApproval')} className="mt-3 min-w-0 space-y-3 rounded-lg border border-border bg-background p-4">
      <p className="font-semibold" role="status">{statusLabel}</p>
      {approval.actions.map((action, index) => (
        <div key={index} className="min-w-0 space-y-2">
          <p className="font-medium break-words" dir="auto">{action.name}</p>
          {action.description ? <p className="text-sm text-muted-foreground" dir="auto">{action.description}</p> : null}
          <dl className="space-y-2 text-sm">
            {Object.entries(action.args).map(([name, value]) => (
              <div key={name} className="min-w-0">
                <dt className="font-medium" dir="auto">{name}</dt>
                <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]" dir="auto">
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {approval.error ? <p className="chat-error" role="alert">{approval.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={buttonsDisabled} onClick={() => onDecision('approve')}>{t('approve')}</Button>
        <Button type="button" variant="outline" disabled={buttonsDisabled} onClick={() => onDecision('reject')}>{t('reject')}</Button>
      </div>
    </section>
  );
}
