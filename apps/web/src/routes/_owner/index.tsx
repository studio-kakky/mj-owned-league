/**
 * `/` — landing redirect to the group-selection screen (Issue #58).
 *
 * Before Issue #58 this route rendered the cross-group S3 dashboard
 * (`DashboardScreen` + `getDashboardServerFn`). The post-login flow has since
 * changed to "ログイン → グループ選択 (`/groups`) → 選択グループの S6 ホーム",
 * so `/` no longer has a screen of its own — it is purely a redirect to
 * `/groups`.
 *
 * Why a redirect (not a render):
 *   `/groups` is the single landing surface. Funnelling `/` into it means there
 *   is one place that handles "Owner just arrived" — including the brand-new
 *   Owner with zero groups, whom `/groups` receives safely with its empty
 *   state. A new dashboard is intentionally *not* built; the per-group S6
 *   ホーム (`/groups/$groupId`) is the dashboard once a Group is selected.
 *
 * Why `beforeLoad` (not the `loader`):
 *   The redirect must fire before any data fetch. `_owner`'s `beforeLoad`
 *   (the parent layout) has already gated authentication, so by the time this
 *   runs the caller is a signed-in Owner; we just forward them on.
 *
 * The previous dashboard plumbing (`DashboardScreen` / `getDashboardServerFn`)
 * is intentionally left in the tree but unreferenced — deleting it is out of
 * scope for this issue.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_owner/')({
  beforeLoad: () => {
    throw redirect({ to: '/groups' });
  },
});
