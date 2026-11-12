import type { Rule, Violation } from '../types';

const LARGE_SLICE_READ = /store\.state\.(grid|units|ships|walkers|production|index|shipHash|unitEvents)\b/g;

function isUiFile(file: string): boolean {
  return /(?:^|\/)apps\/client\/src\/(?:ui|session)\//.test(file.replaceAll('\\', '/'));
}

function lineOf(source: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos; i++) if (source[i] === '\n') line++;
  return line;
}

export const liveMirrorReads: Rule = {
  name: 'live-mirror-reads',
  extensions: ['.ts', '.tsx'],
  apply(file, source) {
    const violations: Violation[] = [];
    if (!isUiFile(file)) return { output: source, violations };
    for (const match of source.matchAll(LARGE_SLICE_READ)) {
      violations.push({
        rule: 'live-mirror-reads',
        file,
        line: lineOf(source, match.index ?? 0),
        message: `store.state.${match[1]} hands out mutable mirror objects; read through store.live for tracked per-key data or store.raw for untracked scans`,
      });
    }
    return { output: source, violations };
  },
};
