/**
 * S14 招待発行完了モーダル — 発行直後に「招待 URL を表示してコピーさせる」
 * 専用のビュー。
 *
 * なぜ発行モーダルと分けるか:
 *   - 発行モーダルは「入力 → 送信」のフォーム責務。完了後は URL の可視化が
 *     主目的になり、入力フィールドを残しておくと再送信の余地が生まれる。
 *   - URL コピー UI は意外と組み合わせ要素が多い (input + ボタン + 成功フィー
 *     ドバック + フォールバック)。発行モーダルと同居させると分岐が増える。
 *
 * クリップボード API のフォールバック:
 *   `navigator.clipboard.writeText` は HTTPS / localhost でしか動かない。
 *   開発時の localhost では動くので MVP としては十分だが、書き込みに失敗
 *   した場合 (例: ブラウザが unsupported) は `document.execCommand('copy')`
 *   をフォールバックとして試し、それも駄目なら URL を表示するだけにする。
 *   失敗時はトーストではなく、コピーボタン下のテキストで「コピーできません
 *   でした」と表示する (Owner は手動で選択コピーできる)。
 */

import { useId, useRef, useState } from 'react';
import { Modal } from '../groups/Modal';

export interface InvitationCreatedModalProps {
  open: boolean;
  /** 表示する招待 URL。発行レスポンスの token から呼び出し元で組み立てる。 */
  inviteUrl: string;
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function InvitationCreatedModal({ open, inviteUrl, onClose }: InvitationCreatedModalProps) {
  const titleId = useId();
  const urlId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = async () => {
    // 1) Async Clipboard API を最優先で試す。最近のブラウザは皆これで動く。
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopyState('copied');
        return;
      } catch {
        // フォールバックに進む。
      }
    }

    // 2) 古い execCommand('copy') にフォールバック。input を一旦選択する。
    //    `document.execCommand` は非推奨だが、HTTP の dev 環境などで唯一の
    //    手段になる場面がある。
    try {
      inputRef.current?.select();
      const ok = typeof document !== 'undefined' && document.execCommand('copy');
      setCopyState(ok ? 'copied' : 'failed');
    } catch {
      setCopyState('failed');
    }
  };

  // 開き直すたびに copyState を idle に戻したいが、`open === false` のとき
  // はそもそも DOM が無く、次回 open 時に state は前のままになる。`open` を
  // key にする方法もあるが、Modal の中身を毎回再マウントするほどの実害は
  // 無いので、明示的なリセットは Owner が閉じるたびに親側で行ってよい。
  // 簡単のためここでは「閉じる時に reset」をオンクリックで挟む。
  const handleClose = () => {
    setCopyState('idle');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} labelledBy={titleId} testId="invitation-created-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            招待 URL を発行しました
          </h2>
          <p className="text-xs text-zinc-500">
            この URL を相手に送ってください。URL
            はこのモーダルを閉じた後でも招待一覧から再取得できます。
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={urlId} className="block text-xs font-medium text-zinc-300">
            招待 URL
          </label>
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              id={urlId}
              type="text"
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              data-testid="invitation-created-url"
              className="block w-full flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              data-testid="invitation-created-copy"
              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              {copyState === 'copied' ? 'コピー済み' : 'コピー'}
            </button>
          </div>
          {copyState === 'failed' ? (
            <p data-testid="invitation-created-copy-failed" className="text-[11px] text-rose-300">
              コピーに失敗しました。URL を選択して手動でコピーしてください。
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            data-testid="invitation-created-close"
            className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}
