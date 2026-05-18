/**
 * S16 Settings (`04-screens.md` § S16, Issue #17).
 *
 * Layout decision — independent screen vs. tab-on-S6:
 *   `04-screens.md` § S6 describes Ruleset / Player management as tabs on the
 *   Group home, and § S16 records that the design treats Settings as an
 *   independent screen mounted at `/settings`. Issue #17 calls out the design
 *   as the source of truth. We mount at `/settings` (already the bottom-nav
 *   target from Issue #11) and present the two collections as in-page tabs,
 *   so the bottom-nav destination matches user expectations while the
 *   sub-structure mirrors S6's spec.
 *
 * Active group:
 *   Settings is scoped to a single Group's roster of Players / Rulesets. The
 *   route loader resolves the active group (first owned Group today; the
 *   GroupSwitcher-selected one once that wiring lands) and hands it down as
 *   `data.group`. When the Owner has zero Groups we render an inline empty
 *   state with a link to `/groups` (the only place to create one).
 */

import { useState } from 'react';
import { PlayerSection } from '../PlayerSection';
import { RulesetSection } from '../RulesetSection';
import type { RulesetFormInput, SettingsData } from '../types';
import { TabButton } from './TabButton';

export interface SettingsScreenProps {
  data: SettingsData;
  onCreateRuleset: (input: RulesetFormInput) => void | Promise<void>;
  onUpdateRuleset: (rulesetId: string, input: RulesetFormInput) => void | Promise<void>;
  onDeleteRuleset: (rulesetId: string) => void | Promise<void>;
  onSetDefaultRuleset: (rulesetId: string) => void | Promise<void>;
  onCreatePlayer: (name: string) => void | Promise<void>;
  onRenamePlayer: (playerId: string, name: string) => void | Promise<void>;
  onDeletePlayer: (playerId: string) => void | Promise<void>;
  onDeactivatePlayer: (playerId: string) => void | Promise<void>;
  onReactivatePlayer: (playerId: string) => void | Promise<void>;
}

type Tab = 'rulesets' | 'players';

export const SettingsScreen = ({
  data,
  onCreateRuleset,
  onUpdateRuleset,
  onDeleteRuleset,
  onSetDefaultRuleset,
  onCreatePlayer,
  onRenamePlayer,
  onDeletePlayer,
  onDeactivatePlayer,
  onReactivatePlayer,
}: SettingsScreenProps) => {
  const [tab, setTab] = useState<Tab>('rulesets');

  const hasGroup = data.group !== null;

  return (
    <section className="space-y-5" data-testid="settings-screen">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Settings</p>
        <h1 className="text-2xl font-bold text-zinc-50">設定</h1>
        {hasGroup ? (
          <p className="text-xs text-zinc-400">
            アクティブグループ:{' '}
            <span className="text-zinc-200" data-testid="settings-active-group-name">
              {data.group?.name}
            </span>
          </p>
        ) : null}
      </header>

      {!hasGroup ? (
        <div
          data-testid="settings-no-group-state"
          className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400"
        >
          <p className="font-medium text-zinc-200">アクティブなグループがありません</p>
          <p className="mt-1 text-xs text-zinc-500">
            先に「グループ」タブからグループを作成してください。
          </p>
        </div>
      ) : (
        <>
          <nav
            aria-label="設定セクション"
            data-testid="settings-tabs"
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 p-1 text-xs"
          >
            <TabButton
              label="ルールセット"
              testId="settings-tab-rulesets"
              active={tab === 'rulesets'}
              onClick={() => setTab('rulesets')}
            />
            <TabButton
              label="プレイヤー"
              testId="settings-tab-players"
              active={tab === 'players'}
              onClick={() => setTab('players')}
            />
          </nav>

          {tab === 'rulesets' ? (
            <RulesetSection
              rulesets={data.rulesets}
              onCreate={onCreateRuleset}
              onUpdate={onUpdateRuleset}
              onDelete={onDeleteRuleset}
              onSetDefault={onSetDefaultRuleset}
            />
          ) : (
            <PlayerSection
              players={data.players}
              onCreate={onCreatePlayer}
              onRename={onRenamePlayer}
              onDelete={onDeletePlayer}
              onDeactivate={onDeactivatePlayer}
              onReactivate={onReactivatePlayer}
            />
          )}
        </>
      )}
    </section>
  );
};
