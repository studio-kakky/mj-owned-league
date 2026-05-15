/**
 * S4 Group 一覧 + S5 Group 作成 screen (`04-screens.md` § S4 / S5).
 *
 * The screen is presentational — it takes the list of Groups + a small set
 * of action callbacks as props and emits no service calls of its own. That
 * boundary keeps it trivially testable (just render with a fixture; click;
 * assert callbacks were invoked) and lets the route file decide whether
 * actions go through a server function, a Drizzle repo on the Worker, or
 * an in-memory dev fixture.
 *
 * The visual language mirrors the existing surfaces (Login, OwnerShell):
 *   - zinc-950 background, zinc-800/900 borders, emerald-500 accent.
 *   - Mobile 375pt baseline; the list is a single column.
 *   - The "+" affordance lives in the section header (matches the
 *     `04-screens.md` § S5 description: "デザイン上は S4 一覧画面の右上
 *     『+』から開くモーダル").
 *
 * Empty / loading states:
 *   - `groups` is the source of truth and may be empty; we render an empty
 *     state inline rather than hiding the page.
 *   - This component does not have a loading state of its own; the route
 *     loader is expected to render a Suspense fallback if data is async.
 */

import { useState } from 'react';
import { GroupDeleteConfirmModal } from './GroupDeleteConfirmModal';
import { GroupFormModal } from './GroupFormModal';
import type { GroupListItem } from './types';

export interface GroupsScreenProps {
  groups: ReadonlyArray<GroupListItem>;
  /**
   * Called when the user submits the create modal. Receives the trimmed
   * Group name; the screen does not pre-generate ids. Should resolve once
   * the new Group is persisted (the modal stays open until it does).
   */
  onCreateGroup: (name: string) => void | Promise<void>;
  /**
   * Called when the user saves the edit modal. Receives the target Group's
   * id plus the trimmed new name.
   */
  onRenameGroup: (groupId: string, name: string) => void | Promise<void>;
  /**
   * Called when the user confirms a no-history deletion. Only fires for
   * Groups where `hasHistory === false`. The screen guards the modal as
   * well, so an out-of-date `hasHistory` value won't slip through.
   */
  onDeleteGroup: (groupId: string) => void | Promise<void>;
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; group: GroupListItem }
  | { kind: 'delete'; group: GroupListItem };

export function GroupsScreen({
  groups,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
}: GroupsScreenProps) {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  return (
    <section className="space-y-5" data-testid="groups-screen">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Groups</p>
          <h1 className="text-2xl font-bold text-zinc-50">グループ</h1>
          <p className="mt-1 text-sm text-zinc-400">参加メンバーやリーグを束ねる最小単位です。</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: 'create' })}
          data-testid="groups-create-trigger"
          aria-label="グループを作成"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          ＋
        </button>
      </header>

      {groups.length === 0 ? (
        <div
          data-testid="groups-empty-state"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
        >
          <p className="font-medium text-zinc-200">グループはまだありません</p>
          <p className="mt-1 text-xs text-zinc-500">
            「＋」ボタンから最初のグループを作成してください。作成と同時に標準ルールのルールセットが自動で用意されます。
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="groups-list">
          {groups.map((group) => (
            <li
              key={group.id}
              data-testid={`groups-list-item-${group.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{group.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    プレイヤー {group.playerCount} 人 / リーグ {group.leagueCount} / 最終対局{' '}
                    {group.lastPlayedAt === null ? '未対局' : formatDate(group.lastPlayedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: 'edit', group })}
                    data-testid={`groups-edit-trigger-${group.id}`}
                    aria-label={`${group.name} を編集`}
                    className="rounded-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: 'delete', group })}
                    data-testid={`groups-delete-trigger-${group.id}`}
                    aria-label={`${group.name} を削除`}
                    className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <GroupFormModal
        open={modal.kind === 'create'}
        mode="create"
        onClose={closeModal}
        onSubmit={async (name) => {
          await onCreateGroup(name);
          closeModal();
        }}
      />

      <GroupFormModal
        open={modal.kind === 'edit'}
        mode="edit"
        initialName={modal.kind === 'edit' ? modal.group.name : ''}
        onClose={closeModal}
        onSubmit={async (name) => {
          if (modal.kind !== 'edit') return;
          await onRenameGroup(modal.group.id, name);
          closeModal();
        }}
      />

      <GroupDeleteConfirmModal
        open={modal.kind === 'delete'}
        groupName={modal.kind === 'delete' ? modal.group.name : ''}
        hasHistory={modal.kind === 'delete' ? modal.group.hasHistory : false}
        onClose={closeModal}
        onConfirm={async () => {
          if (modal.kind !== 'delete') return;
          await onDeleteGroup(modal.group.id);
          closeModal();
        }}
      />
    </section>
  );
}

/**
 * Renders an ISO date / datetime string as the local-style `YYYY/MM/DD`
 * label used in the list card subtitle. Invalid dates fall through as the
 * original string so we don't silently swallow data issues during
 * development.
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
