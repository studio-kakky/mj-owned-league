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
import { InvitationCreatedModal } from '../InvitationCreatedModal';
import { InvitationFormModal } from '../InvitationFormModal';
import { InvitationRevokeConfirmModal } from '../InvitationRevokeConfirmModal';
import type { InvitationListItem } from '../types';
import { InvitationRow } from './InvitationRow';

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

const buildInviteUrl = (origin: string, token: string): string => {
  // origin は末尾スラッシュ無しを前提とする。`window.location.origin` も
  // `https://janroku.example.com` の形で返るので、ここでは特別な正規化を
  // しない。
  return `${origin}/invitations/accept/${token}`;
};

export const InvitationsScreen = ({
  invitations,
  origin,
  onIssue,
  onRevoke,
}: InvitationsScreenProps) => {
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
};
