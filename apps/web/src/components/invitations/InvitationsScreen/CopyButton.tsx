import { useState } from 'react';

export const CopyButton = ({
  inviteUrl,
  invitationId,
}: {
  inviteUrl: string;
  invitationId: string;
}) => {
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
};
