import { scanComments } from '../scanner';
import type { Rule, Comment, Violation } from '../types';

const PRESERVED = [/^\/\/\/\s*<reference/, /^\/\/\s*@ts-/, /^\/\*\s*@vite-ignore/, /^\/\*[#@]__PURE__/];

function lineOf(source: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos; i++) if (source[i] === '\n') line++;
  return line;
}

function removeComment(source: string, comment: Comment): string {
  let { start, end } = comment;
  let before = start;
  while (before > 0 && (source[before - 1] === ' ' || source[before - 1] === '\t')) before--;
  const lineStart = before === 0 || source[before - 1] === '\n';

  let after = end;
  while (after < source.length && (source[after] === ' ' || source[after] === '\t')) after++;

  if (source[before - 1] === '{' && source[after] === '}') {
    let open = before - 1;
    while (open > 0 && (source[open - 1] === ' ' || source[open - 1] === '\t')) open--;
    const ownLine = open === 0 || source[open - 1] === '\n';
    let close = after + 1;
    if (ownLine && source[close] === '\n') return source.slice(0, open) + source.slice(close + 1);
    return source.slice(0, before - 1) + source.slice(after + 1);
  }

  if (lineStart && (after === source.length || source[after] === '\n')) {
    return source.slice(0, before) + source.slice(Math.min(after + 1, source.length));
  }
  if (after === source.length || source[after] === '\n') {
    return source.slice(0, before) + source.slice(after);
  }
  return source.slice(0, start) + source.slice(end);
}

function collapseBlankLines(source: string): string {
  return source.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

export const noComments: Rule = {
  name: 'no-comments',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
  apply(file, source) {
    const css = file.endsWith('.css');
    const comments = scanComments(source, css).filter((c) => !PRESERVED.some((re) => re.test(c.text)));
    const violations: Violation[] = comments.map((c) => ({
      rule: 'no-comments',
      file,
      line: lineOf(source, c.start),
      message: 'Comments are not allowed',
    }));
    if (!comments.length) return { output: source, violations };
    let output = source;
    for (let i = comments.length - 1; i >= 0; i--) output = removeComment(output, comments[i]!);
    return { output: collapseBlankLines(output), violations };
  },
};
