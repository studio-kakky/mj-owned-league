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
 *   `api.anthropic.com/v1/design/h/DKlPUg6Gcv6fEwzc2YSbOQ?open_file=Invite.html`
 *   は 404 (バンドル期限切れ) のため、視覚スタイルは S1 ログイン
 *   (`routes/login.tsx`) と PublicShell の既存トークンに揃える: zinc-950
 *   背景、emerald アクセント、rounded-full ピル型ボタン、JANROKU ワードマーク。
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
      className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100"
      data-testid="invite-accept-screen"
    >
      <header className="px-6 pt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-100">JANROKU</p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm space-y-8">
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
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-6 text-xs text-zinc-500">
          <p>JANROKU は招待制の麻雀リーグ記録サービスです。</p>
        </div>
      </footer>
    </main>
  );
};
