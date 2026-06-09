import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // `@cloudflare/vite-plugin` runs the SSR environment inside workerd (Miniflare)
  // so a single `vite dev` serves both the TanStack Start app and the Worker-side
  // server routes (`/api/auth/*`) from one origin, with the D1 binding available
  // via `cloudflare:workers`. This replaces the old standalone `worker/index.ts`.
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  // Pin the dev port so it matches `BETTER_AUTH_URL` and the Google OAuth
  // redirect URI (`http://localhost:8787/api/auth/callback/google`).
  // `strictPort` makes dev fail loudly if 8787 is taken instead of silently
  // falling back to another port (which would break the OAuth redirect).
  server: { port: 8787, strictPort: true },
});
