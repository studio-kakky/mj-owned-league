/**
 * S14 招待管理 screen (`04-screens.md` § S14, Issue #21).
 *
 * 表示するもの:
 *   - 自分が発行した招待一覧 (送付先メモ / 状態 / 有効期限 / 作成日)
 *   - 新規招待発行 (`+` ボタン → InvitationFormModal → InvitationCreatedModal)
 *   - 取消確認モーダル (PENDING 状態のみ取消ボタンが有効)
 *   - 期限切れ / 使用済みのステータス表示
 *
 * 設計方針 (S4 GroupsScreen と同じ):
 *   - presentational. データ取得 / 永続化は親 (ルートファイル) に委譲。
 *   - 各モーダルは別ファイル。本ファイルはモーダル states (`ModalState`)
 *     を持って `open` を切り替えるだけ。
 *   - リンク URL は `onIssue` の戻り値 (issued token) をそのまま `inviteUrl`
 *     に変換して `InvitationCreatedModal` に渡す。`origin` は親で組み立てる
 *     (server / client で安全に origin が取れる場所が違うため)。
 *
 * ステータス表示:
 *   `InvitationListItem.status` に既に UI 用ステータス (PENDING / EXPIRED /
 *   CONSUMED / REVOKED) が入っているので、ここでは色とラベルのマッピング
 *   だけを行う。
 *
 * モバイル 375pt 基準:
 *   各行は縦並び (メモ → ステータス + 期限) で、右端に操作ボタン (コピー /
 *   取消)。ボタンは shrink-0 でテキストの折り返しに耐える。
 */

import { useState } from 'react';
import { InvitationCreatedModal } from './InvitationCreatedModal';
import { InvitationFormModal } from './InvitationFormModal';
import { InvitationRevokeConfirmModal } from './InvitationRevokeConfirmModal';
import type { InvitationListItem, InvitationUiStatus } from './types';

export interface InvitationsScreenProps {
  invitations: ReadonlyArray<InvitationListItem>;
  /**
   * `origin` (例: `https://janroku.example.com`) — 招待 URL を組み立てる際
   * のプレフィックス。サーバ / クライアント共に `window.location.origin` 等
   * から渡す責務は親ルートにある。
   */
  origin: string;
  /**
   * 招待発行アクション。メモ (空文字許容) を受け取り、`token` を返す。
   * `InvitationsScreen` は token を URL に組み立てて発行完了モーダルに渡す。
   */
  onIssue: (memo: string) => Promise<{ token: string }>;
  /** 取消アクション。対象の id を渡す。 */
  onRevoke: (invitationId: string) => Promise<void> | void;
}

/**
 * モーダル状態。発行モーダル → 発行完了モーダル の遷移を表現するため
 * `created` を別 kind として持つ。
 */
type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'created'; inviteUrl: string }
  | { kind: 'revoke'; invitation: InvitationListItem };

export function InvitationsScreen({
  invitations,
  origin,
  onIssue,
  onRevoke,
}: InvitationsScreenProps) {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  return (
    <section className="space-y-5" data-testid="invitations-screen">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Invitations</p>
          <h1 className="text-2xl font-bold text-zinc-50">招待管理</h1>
          <p className="mt-1 text-sm text-zinc-400">
            新しい Owner を招くための招待 URL を発行・管理します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: 'create' })}
          data-testid="invitations-create-trigger"
          aria-label="招待を発行"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          ＋
        </button>
      </header>

      {invitations.length === 0 ? (
        <div
          data-testid="invitations-empty-state"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
        >
          <p className="font-medium text-zinc-200">招待はまだありません</p>
          <p className="mt-1 text-xs text-zinc-500">
            「＋」ボタンから招待 URL を発行できます。発行した URL
            はメールやチャットで手動で共有してください。
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="invitations-list">
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              inviteUrl={buildInviteUrl(origin, invitation.token)}
              onRequestRevoke={() => setModal({ kind: 'revoke', invitation })}
            />
          ))}
        </ul>
      )}

      <InvitationFormModal
        open={modal.kind === 'create'}
        onClose={closeModal}
        onSubmit={async (memo) => {
          // 発行成功後は、入力モーダルを閉じてリンク表示モーダルに切り替える。
          const { token } = await onIssue(memo);
          setModal({ kind: 'created', inviteUrl: buildInviteUrl(origin, token) });
        }}
      />

      <InvitationCreatedModal
        open={modal.kind === 'created'}
        inviteUrl={modal.kind === 'created' ? modal.inviteUrl : ''}
        onClose={closeModal}
      />

      <InvitationRevokeConfirmModal
        open={modal.kind === 'revoke'}
        memo={modal.kind === 'revoke' ? modal.invitation.memo : null}
        onClose={closeModal}
        onConfirm={async () => {
          if (modal.kind !== 'revoke') return;
          await onRevoke(modal.invitation.id);
          closeModal();
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 行コンポーネント
// ---------------------------------------------------------------------------
// 1 行に「メモ + ステータスバッジ + 作成日 / 期限」+ 右端に操作ボタン (コピー
// / 取消)。PENDING のみ取消ボタンを表示する。CONSUMED / REVOKED / EXPIRED
// は read-only。

interface InvitationRowProps {
  invitation: InvitationListItem;
  inviteUrl: string;
  onRequestRevoke: () => void;
}

function InvitationRow({ invitation, inviteUrl, onRequestRevoke }: InvitationRowProps) {
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
}

// ---------------------------------------------------------------------------
// ステータスバッジ
// ---------------------------------------------------------------------------

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

function StatusBadge({ status }: { status: InvitationUiStatus }) {
  return (
    <span
      data-testid={`invitations-status-${status}`}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 行内コピーボタン (発行完了モーダルとは別物 — 一覧から後追いコピー用)
// ---------------------------------------------------------------------------

function CopyButton({ inviteUrl, invitationId }: { inviteUrl: string; invitationId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        // コピー表示は短時間で戻す。連打しても直近の "コピー済み" が残るだけ。
        window.setTimeout(() => setCopied(false), 1500);
        return;
      } catch {
        // 静かに失敗 — モーダル時とは異なり、行内ボタンはエラー表示の場所が
        // 無いので state を変えずに諦める。Owner は発行完了モーダルや URL を
        // 直接選択してコピーできる。
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={`invitations-copy-${invitationId}`}
      aria-label="招待 URL をコピー"
      className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
    >
      {copied ? 'コピー済み' : 'リンクをコピー'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInviteUrl(origin: string, token: string): string {
  // origin は末尾スラッシュ無しを前提とする。`window.location.origin` も
  // `https://janroku.example.com` の形で返るので、ここでは特別な正規化を
  // しない。
  return `${origin}/invitations/accept/${token}`;
}

/**
 * ISO 文字列を `YYYY/MM/DD` に整形する。GroupsScreen / DashboardScreen と
 * 同じ実装で、ライブラリ化はまだしない (3 枚目の重複が出たら共通化する)。
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
