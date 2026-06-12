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
 * Visual language (design: `groups.jsx`):
 *   - Dark tokens (#0E0E0E / #FAFAF8 / #888 / #666 / #1F1F1F), full-bleed
 *     rows with hairline separators, Geist + JetBrains Mono.
 *   - Mobile 375pt baseline; the list is a single column.
 *   - A dashed "新しいグループを作成" button sits above the list; each card has
 *     an avatar (name initial) + pencil/trash icon actions. Trash is disabled
 *     for Groups with history (our deletion rule), mirroring the design's
 *     disabled-trash affordance.
 *   - The screen breaks out of the shell's horizontal padding (`-mx-4`) so the
 *     row separators span the full width.
 *
 * Data note: the design card shows メンバー数・説明・ACTIVE バッジ, but the
 * S4 projection (`GroupListItem`) carries none of those — there is no group
 * description, no membership concept, and the active group is not known on
 * this screen. We bind the metrics we actually have (player / league counts,
 * last-played date) and omit the rest.
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

const PencilIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <title>編集</title>
    <path
      d="M11.5 2.5 L13.5 4.5 L5.5 12.5 L3 13 L3.5 10.5 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <title>削除</title>
    <path
      d="M3 4.5 H13 M5.5 4.5 V3 H10.5 V4.5 M5 4.5 L5.5 13 H10.5 L11 4.5 M7 7 V11 M9 7 V11"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface GroupsScreenProps {
  groups: ReadonlyArray<GroupListItem>;
  /**
   * Called when the user picks a Group to enter (selects it as the active
   * group). Receives the target Group's id. The route handler persists the
   * selection and navigates to the Group's S6 ホーム. Optional so existing
   * call-sites / tests that only exercise CRUD keep working; when omitted the
   * card body is not an interactive "enter" target.
   */
  onSelectGroup?: (groupId: string) => void | Promise<void>;
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

export const GroupsScreen = ({
  groups,
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
}: GroupsScreenProps) => {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  return (
    <section className="-mx-4 -mt-4 font-sans" data-testid="groups-screen">
      <div className="px-5 pt-5 pb-3.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#FAFAF8]">グループ</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#666666]">
          使用するグループを切り替え・作成・編集できます
        </p>
      </div>

      <div className="px-5">
        <button
          type="button"
          onClick={() => setModal({ kind: 'create' })}
          data-testid="groups-create-trigger"
          aria-label="グループを作成"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#262626] text-[13px] font-medium text-[#888888] transition-colors hover:border-[#3a3a3a] hover:text-[#FAFAF8]"
        >
          <span aria-hidden="true" className="-mt-0.5 text-base leading-none">
            +
          </span>
          新しいグループを作成
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="px-5">
          <div
            data-testid="groups-empty-state"
            className="mt-3.5 rounded-lg border border-dashed border-[#262626] p-6 text-center text-sm text-[#888888]"
          >
            <p className="font-medium text-[#FAFAF8]">グループはまだありません</p>
            <p className="mt-1 text-xs leading-relaxed text-[#666666]">
              上のボタンから最初のグループを作成してください。作成と同時に標準ルールのルールセットが自動で用意されます。
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-3.5" data-testid="groups-list">
          {groups.map((group) => (
            <li
              key={group.id}
              data-testid={`groups-list-item-${group.id}`}
              className="flex items-center gap-3 border-t border-[#1F1F1F] px-5 py-3.5 [&:last-child]:border-b"
            >
              {/* "Enter group" target — selecting it as the active group and
                  navigating to its S6 ホーム. Rendered as a dedicated button
                  (a sibling of the edit/delete buttons, not their ancestor) so
                  there is no click-propagation competition between selecting
                  and the per-row icon actions. Falls back to a plain,
                  non-interactive block when `onSelectGroup` is not wired. */}
              {onSelectGroup ? (
                <button
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  data-testid={`groups-select-trigger-${group.id}`}
                  aria-label={`${group.name} に入る`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#262626] bg-[#1F1F1F] text-base font-semibold text-[#888888]">
                    {group.name.trim().charAt(0) || '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 block truncate text-[15px] font-medium text-[#FAFAF8]">
                      {group.name}
                    </span>
                    <span className="block truncate text-xs text-[#666666]">
                      プレイヤー {group.playerCount} 人 · リーグ {group.leagueCount} · 最終対局{' '}
                      {group.lastPlayedAt === null ? '未対局' : formatDate(group.lastPlayedAt)}
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#262626] bg-[#1F1F1F] text-base font-semibold text-[#888888]">
                    {group.name.trim().charAt(0) || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 truncate text-[15px] font-medium text-[#FAFAF8]">
                      {group.name}
                    </p>
                    <p className="truncate text-xs text-[#666666]">
                      プレイヤー {group.playerCount} 人 · リーグ {group.leagueCount} · 最終対局{' '}
                      {group.lastPlayedAt === null ? '未対局' : formatDate(group.lastPlayedAt)}
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setModal({ kind: 'edit', group })}
                data-testid={`groups-edit-trigger-${group.id}`}
                aria-label={`${group.name} を編集`}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#262626] text-[#888888] transition-colors hover:text-[#FAFAF8]"
              >
                <PencilIcon />
              </button>
              {/* Always clickable: history-bearing groups still open the modal,
                  which explains why deletion is blocked (a missing button would
                  read as a bug). The disabled state lives on the modal's confirm
                  button, not here. */}
              <button
                type="button"
                onClick={() => setModal({ kind: 'delete', group })}
                data-testid={`groups-delete-trigger-${group.id}`}
                aria-label={`${group.name} を削除`}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#262626] text-[#c87878] transition-colors hover:text-[#d88c8c]"
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="h-6" />

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
};

/**
 * Renders an ISO date / datetime string as the local-style `YYYY/MM/DD`
 * label used in the list card subtitle. Invalid dates fall through as the
 * original string so we don't silently swallow data issues during
 * development.
 */
const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};
