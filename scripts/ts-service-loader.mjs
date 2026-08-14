/**
 * Module hooks so a harness can import the app's service `.ts` directly under plain Node.
 *
 * Two things stand in the way and both are incidental to the logic under test:
 *   • Node's `--experimental-strip-types` cannot parse constructor parameter properties, which the
 *     Groq services use, so the source is transpiled through the repo's own TypeScript instead.
 *   • `services/supabase.ts` pulls in `react-native` and `@supabase/supabase-js`, neither of which
 *     loads outside the bundler. They are stubbed to the surface those modules actually use.
 *
 * Register it before the first import:
 *   import { register } from 'node:module';
 *   register('./ts-service-loader.mjs', import.meta.url);
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const STUBS = {
  'react-native': 'export const Platform = { OS: "web" };\n',
  '@supabase/supabase-js': 'export function createClient() { return { auth: {} }; }\n',
};

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: `stub:${specifier}`, shortCircuit: true };
  // The app's imports are extensionless; Node's ESM resolver is not.
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      /* fall through to the plain specifier */
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith('stub:')) {
    return { format: 'module', source: STUBS[url.slice('stub:'.length)], shortCircuit: true };
  }
  if (url.endsWith('.ts')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return next(url, context);
}
