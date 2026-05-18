import type { InvitationUiStatus } from '../types';

const STATUS_LABEL: Record<InvitationUiStatus, string> = {
  PENDING: '未使用',
  EXPIRED: '期限切れ',
  CONSUMED: '使用済み',
  REVOKED: '取消済み',
};

/**
 * Tailwind の動的クラス参照は purge に弱いので、static map で全クラスを書き
 * 出しておく。
 */
const STATUS_CLASS: Record<InvitationUiStatus, string> = {
  PENDING: 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200',
  EXPIRED: 'border-amber-900/60 bg-amber-950/40 text-amber-200',
  CONSUMED: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  REVOKED: 'border-rose-900/60 bg-rose-950/40 text-rose-200',
};

export const StatusBadge = ({ status }: { status: InvitationUiStatus }) => {
  return (
    <span
      data-testid={`invitations-status-${status}`}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
};
