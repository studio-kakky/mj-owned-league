import { createRootRoute, Outlet } from '@tanstack/react-router';
import { RootDocument } from '../components/layout/RootDocument';
import appCss from '../styles/app.css?url';

const RootComponent = () => {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'JANROKU' },
    ],
    links: [
      // Geist (body) + JetBrains Mono (wordmark/labels) per the Claude
      // Design handoff. `preconnect` warms the font-CDN connection before
      // the CSS request fires.
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
});
