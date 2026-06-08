import { HeadContent, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const RootDocument = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body className="bg-zinc-950 font-sans text-zinc-100 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
};
