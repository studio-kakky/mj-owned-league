import type { InvitationListItem } from '../types';
import { CopyButton } from './CopyButton';
import { StatusBadge } from './StatusBadge';

interface InvitationRowProps {
  invitation: InvitationListItem;
  inviteUrl: string;
  onRequestRevoke: () => void;
}

/**
 * ISO 文字列を `YYYY/MM/DD` に整形する。GroupsScreen / DashboardScreen と
 * 同じ実装で、ライブラリ化はまだしない (3 枚目の重複が出たら共通化する)。
 */
const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

export const InvitationRow = ({ invitation, inviteUrl, onRequestRevoke }: InvitationRowProps) => {
  return (
    <li
      data-testid={`invitations-list-item-${invitation.id}`}
      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="truncate text-sm font-semibold text-zinc-100"
              data-testid={`invitations-row-memo-${invitation.id}`}
            >
              {invitation.memo === null || invitation.memo === '' ? '(メモなし)' : invitation.memo}
            </p>
            <StatusBadge status={invitation.status} />
          </div>
          <p className="text-xs text-zinc-500">
            作成 {formatDate(invitation.createdAt)} / 有効期限{' '}
            <span data-testid={`invitations-row-expires-${invitation.id}`}>
              {formatDate(invitation.expiresAt)}
            </span>
          </p>
        </div>

        {invitation.status === 'PENDING' ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <CopyButton inviteUrl={inviteUrl} invitationId={invitation.id} />
            <button
              type="button"
              onClick={onRequestRevoke}
              data-testid={`invitations-revoke-trigger-${invitation.id}`}
              aria-label="この招待を取り消す"
              className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
            >
              取消
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
};
