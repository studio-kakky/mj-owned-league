/**
 * S2 招待受け入れ — presentational screen
 * (`docs/docs/04-screens.md` § S2, `docs/docs/03-user-flow.md` § F1, Issue #13).
 *
 * 表示分岐:
 *   - `valid`   → 招待元情報 + 「Google で承諾」ボタン
 *   - `invalid` → エラーカード (理由別の文言)
 *
 * 設計方針:
 *   - presentational. 認証や consume の呼び出しは親ルートに委譲する
 *     (S1 ログインと同じ構造)。
 *   - `signIn.social` は親が呼ぶ責務にしている: S1 と機能としては似ているが、
 *     callbackURL の組み立て / token の sessionStorage 退避が必要なので、
 *     その判断を screen 内に閉じ込めるのは無理筋。
 *   - モバイル 375pt 基準。`max-w-sm` を保ち、ログイン画面と並びを揃える。
 *
 * デザイン source:
 *   Claude Design ハンドオフバンドル `Invite.html` → `invite.jsx` (S2)。
 *   確定形は S1 と同系のダーク (#0E0E0E / #FAFAF8, Geist + JetBrains Mono):
 *   左寄せ JANROKU mono ワードマーク → 「招待を受け取りました。」見出し →
 *   招待元カード (アバター + FROM + identity) → 白い 52px Google ボタン
 *   (角丸 6px・公式 4 色 G) → ドット注記 → mono フッター。
 *   デザインは 氏名 + メール + アバター "TK" を出すが、ドメインに Owner 表示名
 *   が無く `issuerEmail` しか手元に無いため (`server/invitation-accept.ts`)、
 *   identity 行に email を出し、アバターはメールから導出する。Phone の
 *   ステータスバー / ホームインジケータは端末クロームなので描画しない。
 */

import type { InvitationInvalidReason } from '../../../services';
import { InvalidBody } from './InvalidBody';
import { ValidBody } from './ValidBody';

/**
 * 親ルート (`/invitations/accept/$token`) が `verifyInvitationHandler` の戻り
 * 値をそのまま流し込む。screen は kind で分岐するだけ。
 */
export type InviteAcceptVerifyResult =
  | {
      kind: 'valid';
      memo: string | null;
      expiresAt: string;
      issuerEmail: string;
    }
  | {
      kind: 'invalid';
      reason: InvitationInvalidReason;
    };

export interface InviteAcceptScreenProps {
  verification: InviteAcceptVerifyResult;
  /**
   * 「Google で承諾」ボタン押下時の callback。親側で
   *   1. `sessionStorage` などに token を退避
   *   2. `signIn.social({ provider: 'google', callbackURL: '/invitations/accept/<token>/complete' })`
   * を行う。Promise を返してよく、resolve するまでボタンは disable される。
   */
  onAccept: () => void | Promise<void>;
}

export const InviteAcceptScreen = ({ verification, onAccept }: InviteAcceptScreenProps) => {
  return (
    <main
      className="flex min-h-screen justify-center bg-[#0E0E0E] font-sans text-[#FAFAF8]"
      data-testid="invite-accept-screen"
    >
      {/* Mobile column (375pt), centred so the phone proportions hold on wider
          viewports — same shell as S1 ログイン (`routes/login.tsx`). */}
      <div className="flex w-full max-w-sm flex-col">
        <section className="flex flex-1 flex-col justify-center px-8">
          {/* JANROKU mono wordmark — brand mark + the page's single h1. */}
          <h1 className="font-mono text-[22px] font-medium tracking-[0.24em] text-[#FAFAF8]">
            JANROKU
          </h1>

          {verification.kind === 'valid' ? (
            <ValidBody
              memo={verification.memo}
              expiresAt={verification.expiresAt}
              issuerEmail={verification.issuerEmail}
              onAccept={onAccept}
            />
          ) : (
            <InvalidBody reason={verification.reason} />
          )}
        </section>

        <footer className="flex items-center justify-between px-6 pt-6 pb-7 font-mono text-[10px] tracking-[0.08em] text-[#888888]">
          <div className="flex gap-3.5">
            <a href="/terms" className="text-[#AAAAAA] no-underline hover:underline">
              利用規約
            </a>
            <a href="/privacy" className="text-[#AAAAAA] no-underline hover:underline">
              プライバシー
            </a>
          </div>
          <span>© 2026</span>
        </footer>
      </div>
    </main>
  );
};
