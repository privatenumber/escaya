import { parseScript } from '../dist/escaya.mjs';

export function parse(code, options = {}) {
  const ast = parseScript(code, {
    goalMode: options.module ? 'module' : 'script',
    webCompat: !options.disableWebCompat,
    strictMode: !!options.impliedStrict
  });
  return { ast };
}
