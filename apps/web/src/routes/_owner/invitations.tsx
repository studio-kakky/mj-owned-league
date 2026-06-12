/**
 * `/invitations` — S14 招待管理 (`04-screens.md` § S14, Issue #21).
 *
 * Wiring strategy mirrors `/groups` (#15) and `/` dashboard (#14):
 *   - The route loader is the only place that crosses the TanStack Start
 *     RPC boundary. The presentational `InvitationsScreen` takes the
 *     projected payload + a small set of action callbacks.
 *   - Mutations (`issueInvitation`, `revokeInvitation`) call the server
 *     function, then `router.invalidate()` so the loader re-fetches and
 *     the list reflects the new state.
 *
 * Owner identity (`ownerId`) comes from the parent `_owner` layout's
 * `beforeLoad`, surfaced via `Route.useRouteContext()` for client
 * mutations and via `loaderDeps` for the loader.
 *
 * `origin` resolution:
 *   The invitation URL is `<origin>/invitations/accept/<token>`. We need a
 *   reasonable string for both server-rendered (SSR) and client paint:
 *     - Client: `window.location.origin` (always correct).
 *     - SSR: we don't have a request-aware origin in the screen layer yet,
 *       so we fall back to an empty string. The screen will render the
 *       trailing `/invitations/accept/...` portion only — the user only
 *       sees the URL after they click "発行" (post-hydration), so SSR
 *       fidelity here is not user-visible.
 *
 *   When TanStack Start's `getRequestHost` is wired in (out-of-scope for
 *   this issue) we'll pass that through the loader. The screen contract
 *   already accepts `origin` for that exact reason.
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { InvitationsScreen } from '../../components/invitations';
import {
  issueInvitationServerFn,
  listInvitationsServerFn,
  revokeInvitationServerFn,
} from '../../server/invitations';

const InvitationsPage = () => {
  const router = useRouter();
  const { invitations } = Route.useLoaderData();

  // Browser-only resolution. Empty string during SSR; see route docstring.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const handleIssue = useCallback(
    async (memo: string) => {
      const result = await issueInvitationServerFn({ data: { memo } });
      // 一覧を最新化する。発行完了モーダルの URL 表示は呼び出し元が結果を
      // そのまま使うので、invalidate を await しなくても URL は出る — が、
      // 完了モーダル裏で一覧が古いままだと「コピーボタンを後追いで使う」
      // 動線がズレるので待ってから呼び出し元に返す。
      await router.invalidate();
      return { token: result.token };
    },
    [router],
  );

  const handleRevoke = useCallback(
    async (invitationId: string) => {
      await revokeInvitationServerFn({ data: { invitationId } });
      await router.invalidate();
    },
    [router],
  );

  return (
    <InvitationsScreen
      invitations={invitations}
      origin={origin}
      onIssue={handleIssue}
      onRevoke={handleRevoke}
    />
  );
};

export const Route = createFileRoute('/_owner/invitations')({
  loader: async () => {
    const invitations = await listInvitationsServerFn();
    return { invitations };
  },
  component: InvitationsPage,
});
