/**
 * Module hooks so a harness can import the app's service `.ts` directly under plain Node.
 *
 * Two things stand in the way and both are incidental to the logic under test:
 *   • Node's `--experimental-strip-types` cannot parse constructor parameter properties, which the
 *     Groq services use, so the source is transpiled through the repo's own TypeScript instead.
 *   • `services/supabase.ts` pulls in `react-native` and `@supabase/supabase-js`, and `services/
 *     auth.ts` pulls in `expo-crypto` — none of which load outside the bundler (expo-crypto's
 *     `getRandomBytes`/`digestStringAsync` resolve to a native binding). Each is stubbed to the
 *     surface the app code actually uses; the `expo-crypto` stub backs it with Node's own `crypto`
 *     module so the harness exercises REAL randomness and REAL SHA-256, not a fake.
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
  'expo-crypto': `
import { randomBytes, createHash } from 'node:crypto';
export const CryptoDigestAlgorithm = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512', MD2: 'MD2', MD4: 'MD4', MD5: 'MD5' };
export const CryptoEncoding = { HEX: 'hex', BASE64: 'base64' };
export function getRandomBytes(byteCount) {
  return new Uint8Array(randomBytes(byteCount));
}
export async function getRandomBytesAsync(byteCount) {
  return getRandomBytes(byteCount);
}
export async function digestStringAsync(algorithm, data, options) {
  const nodeAlgByName = { 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-384': 'sha384', 'SHA-512': 'sha512', MD5: 'md5' };
  const digest = createHash(nodeAlgByName[algorithm] || 'sha256').update(data, 'utf8').digest();
  return digest.toString(options && options.encoding === 'base64' ? 'base64' : 'hex');
}
`,
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
