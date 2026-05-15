/**
 * Ruleset 管理 サブセクション on the S16 Settings screen (Issue #17).
 *
 * Stays presentational — receives the list and a small set of callbacks; the
 * route owns the data layer. The "デフォルトにする" affordance is rendered
 * inline per row instead of in the form modal so it is reachable without
 * opening any dialog (matches the S6 タブ仕様 in `04-screens.md` § S6:
 * "Ruleset 一覧（追加・編集・デフォルト切替）").
 *
 * Empty state: when the active group has no Rulesets we render an inline
 * help block. In practice this should not happen — `GroupService.create
 * WithDefaultRuleset` (Issue #15) ensures every Group ships with one — but
 * the screen needs to tolerate it (e.g. after a manual delete sequence).
 */

import { useState } from 'react';
import { RulesetDeleteConfirmModal } from './RulesetDeleteConfirmModal';
import { RulesetFormModal } from './RulesetFormModal';
import type { RulesetFormInput, SettingsRulesetItem } from './types';

export interface RulesetSectionProps {
  rulesets: ReadonlyArray<SettingsRulesetItem>;
  /** Disables every write affordance — used when there is no active group. */
  disabled?: boolean;
  onCreate: (input: RulesetFormInput) => void | Promise<void>;
  onUpdate: (rulesetId: string, input: RulesetFormInput) => void | Promise<void>;
  onDelete: (rulesetId: string) => void | Promise<void>;
  onSetDefault: (rulesetId: string) => void | Promise<void>;
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; ruleset: SettingsRulesetItem }
  | { kind: 'delete'; ruleset: SettingsRulesetItem };

export function RulesetSection({
  rulesets,
  disabled = false,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: RulesetSectionProps) {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  return (
    <section className="space-y-4" data-testid="settings-ruleset-section">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Rulesets</p>
          <h2 className="text-base font-semibold text-zinc-100">ルールセット</h2>
          <p className="mt-1 text-xs text-zinc-500">
            配給原点・返し点・ウマ・飛び賞の組み合わせを管理します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: 'create' })}
          disabled={disabled}
          data-testid="ruleset-create-trigger"
          aria-label="ルールセットを追加"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ＋
        </button>
      </header>

      {rulesets.length === 0 ? (
        <div
          data-testid="ruleset-empty-state"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-center text-xs text-zinc-400"
        >
          ルールセットがまだありません。「＋」から追加してください。
        </div>
      ) : (
        <ul className="space-y-3" data-testid="ruleset-list">
          {rulesets.map((ruleset) => (
            <li
              key={ruleset.id}
              data-testid={`ruleset-list-item-${ruleset.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-100">{ruleset.name}</p>
                    {ruleset.isDefault ? (
                      <span
                        data-testid={`ruleset-default-badge-${ruleset.id}`}
                        className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200"
                      >
                        既定
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {ruleset.startingScore} 持ち / {ruleset.returnScore} 返し / {ruleset.umaPattern}
                    {ruleset.tobiEnabled && ruleset.tobiPoint !== null
                      ? ` / 飛び賞 ${ruleset.tobiPoint}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setModal({ kind: 'edit', ruleset })}
                      disabled={disabled}
                      data-testid={`ruleset-edit-trigger-${ruleset.id}`}
                      aria-label={`${ruleset.name} を編集`}
                      className="rounded-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ kind: 'delete', ruleset })}
                      disabled={disabled || ruleset.isDefault}
                      data-testid={`ruleset-delete-trigger-${ruleset.id}`}
                      aria-label={`${ruleset.name} を削除`}
                      className="rounded-full px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      削除
                    </button>
                  </div>
                  {!ruleset.isDefault ? (
                    <button
                      type="button"
                      onClick={() => onSetDefault(ruleset.id)}
                      disabled={disabled}
                      data-testid={`ruleset-set-default-${ruleset.id}`}
                      className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      既定にする
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RulesetFormModal
        open={modal.kind === 'create'}
        mode="create"
        onClose={closeModal}
        onSubmit={async (input) => {
          await onCreate(input);
          closeModal();
        }}
      />

      <RulesetFormModal
        open={modal.kind === 'edit'}
        mode="edit"
        initialValues={
          modal.kind === 'edit'
            ? {
                name: modal.ruleset.name,
                startingScore: modal.ruleset.startingScore,
                returnScore: modal.ruleset.returnScore,
                umaPattern: modal.ruleset.umaPattern,
                tobiEnabled: modal.ruleset.tobiEnabled,
                tobiPoint: modal.ruleset.tobiPoint,
              }
            : undefined
        }
        onClose={closeModal}
        onSubmit={async (input) => {
          if (modal.kind !== 'edit') return;
          await onUpdate(modal.ruleset.id, input);
          closeModal();
        }}
      />

      <RulesetDeleteConfirmModal
        open={modal.kind === 'delete'}
        rulesetName={modal.kind === 'delete' ? modal.ruleset.name : ''}
        isDefault={modal.kind === 'delete' ? modal.ruleset.isDefault : false}
        onClose={closeModal}
        onConfirm={async () => {
          if (modal.kind !== 'delete') return;
          await onDelete(modal.ruleset.id);
          closeModal();
        }}
      />
    </section>
  );
}
