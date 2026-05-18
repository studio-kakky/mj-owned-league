/**
 * Pathless layout route for the public (viewer) section.
 *
 * Anything under `routes/_public/*` renders inside `PublicShell` — the
 * simplified header + footer that omits Owner navigation, the group
 * switcher, and any editing affordance (Issue #11 acceptance criterion
 * "公開閲覧側では簡略版を提供").
 *
 * The actual public pages (P1-P4 in `04-screens.md`) are implemented in
 * follow-up issues. This file is independent of those — the layout shell
 * is the entire scope of Issue #11.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { PublicShell } from '../components/layout';

const PublicLayout = () => {
  return (
    <PublicShell>
      <Outlet />
    </PublicShell>
  );
};

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});
