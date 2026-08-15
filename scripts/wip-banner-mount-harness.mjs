/**
 * WIP-banner mount harness. `WipBanner.test.tsx` proves the component itself renders the right
 * copy; that alone can't prove it's actually WIRED into the root layout — a deleted render call
 * there would leave every other route quietly missing the preview notice while that test stays
 * green. Root `_layout.tsx` also loads local font assets and native-only modules that don't
 * resolve outside Metro/Expo, so this checks the wiring by reading its source rather than
 * rendering the whole tree.
 *
 * Run: node scripts/wip-banner-mount-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const layoutPath = fileURLToPath(new URL('../src/app/_layout.tsx', import.meta.url));
const source = readFileSync(layoutPath, 'utf8');

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

check(
  'root layout imports WipBanner',
  /import\s*\{\s*WipBanner\s*\}\s*from\s*['"]\.\.\/components\/WipBanner['"]/.test(source),
  'expected an import of WipBanner from ../components/WipBanner in src/app/_layout.tsx',
);
check(
  'root layout renders <WipBanner />',
  /<WipBanner\s*\/>/.test(source),
  'expected <WipBanner /> to be rendered in RootStack, so welcome/unlock/(app) all nest under it',
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
