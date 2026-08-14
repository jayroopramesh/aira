import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { lightColors } from '../theme/tokens';

/**
 * Web-only root HTML document, wrapping every statically-rendered page.
 *
 * Home of the product name in web metadata: the PWA manifest name reads "Airava", as does the
 * page `<title>` — but the title is set through expo-router's managed `<Head>` in the root layout
 * (see `_layout.tsx`), not here, so there's exactly one (managed) title element rather than a
 * duplicate that the empty react-helmet placeholder would shadow. Expo's static web export emits
 * no manifest of its own, so it's declared here. The `aira` slug/scheme and storage namespace are
 * deliberately untouched.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={lightColors.brand} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Airava" />

        {/* Disable body scrolling on web so ScrollView components work as expected. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
