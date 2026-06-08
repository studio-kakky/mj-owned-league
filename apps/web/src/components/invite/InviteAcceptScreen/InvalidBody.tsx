import type { InvitationInvalidReason } from '../../../services';

const INVALID_TITLE: Record<InvitationInvalidReason, string> = {
  NOT_FOUND: '招待が見つかりません',
  EXPIRED: '招待の有効期限が切れています',
  CONSUMED: 'この招待は既に使用されています',
  REVOKED: 'この招待は取り消されています',
};

const INVALID_DESCRIPTION: Record<InvitationInvalidReason, string> = {
  NOT_FOUND:
    'URL を確認してください。リンクが古い場合は、発行者に新しい招待 URL を依頼してください。',
  EXPIRED: '発行者に新しい招待 URL を依頼してください。招待は発行から 7 日間有効です。',
  CONSUMED:
    'この招待 URL は既に他の方が使用しました。心当たりがない場合は発行者に確認してください。',
  REVOKED:
    '招待の発行者がこの URL を取り消しました。新しい招待が必要な場合は発行者に依頼してください。',
};

export const InvalidBody = ({ reason }: { reason: InvitationInvalidReason }) => {
  return (
    <>
      {/* Invalid state is not in the S2 design canvas (which only mocks the
          valid path); it reuses the same dark tokens so the surface stays
          coherent with `ValidBody`. */}
      <p className="mt-7 text-[22px] font-medium leading-[1.35] tracking-[-0.01em] text-[#FAFAF8]">
        招待を受け入れられません
      </p>

      <div
        data-testid={`invite-accept-invalid-${reason}`}
        role="alert"
        className="mt-6 space-y-2 rounded-md border border-rose-900/60 bg-rose-950/30 p-4"
      >
        <p className="text-sm font-semibold text-rose-200">{INVALID_TITLE[reason]}</p>
        <p className="text-xs leading-[1.55] text-rose-300/80">{INVALID_DESCRIPTION[reason]}</p>
      </div>

      <p className="mt-5 px-1 text-xs leading-[1.55] text-[#888888]">
        既に Owner アカウントをお持ちの場合は{' '}
        <a
          href="/login"
          className="text-[#AAAAAA] underline-offset-2 hover:underline"
          data-testid="invite-accept-login-link"
        >
          サインイン
        </a>{' '}
        してください。
      </p>
    </>
  );
};
