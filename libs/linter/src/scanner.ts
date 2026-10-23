import type { Comment } from './types';

const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

function isIdentChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\w$]/.test(ch);
}

function regexAllowed(source: string, pos: number): boolean {
  let i = pos - 1;
  while (i >= 0 && /\s/.test(source[i] ?? '')) i--;
  if (i < 0) return true;
  const ch = source[i];
  if (ch === ')' || ch === ']') return false;
  if (isIdentChar(ch)) {
    let j = i;
    while (j >= 0 && isIdentChar(source[j])) j--;
    return REGEX_KEYWORDS.has(source.slice(j + 1, i + 1));
  }
  return true;
}

function skipString(source: string, i: number, quote: string): number {
  i++;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i++;
    else if (source[i] === '\n') return i;
    i++;
  }
  return i + 1;
}

function skipRegex(source: string, i: number): number {
  i++;
  let inClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') i++;
    else if (ch === '\n') return i;
    else if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) break;
    i++;
  }
  i++;
  while (i < source.length && /[a-z]/i.test(source[i] ?? '')) i++;
  return i;
}

export function scanComments(source: string, css = false): Comment[] {
  const comments: Comment[] = [];
  const templateDepth: number[] = [];
  let braceDepth = 0;
  let i = 0;

  const scanTemplate = () => {
    i++;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { i++; return; }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        templateDepth.push(braceDepth);
        braceDepth++;
        return;
      }
      i++;
    }
  };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      const end = close === -1 ? source.length : close + 2;
      comments.push({ start: i, end, text: source.slice(i, end) });
      i = end;
    } else if (!css && ch === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      comments.push({ start: i, end, text: source.slice(i, end) });
      i = end;
    } else if (ch === '"' || ch === "'") {
      i = skipString(source, i, ch);
    } else if (css) {
      i++;
    } else if (ch === '`') {
      scanTemplate();
    } else if (ch === '/' && regexAllowed(source, i)) {
      i = skipRegex(source, i);
    } else if (ch === '{') {
      braceDepth++;
      i++;
    } else if (ch === '}') {
      braceDepth--;
      i++;
      if (templateDepth.length && templateDepth[templateDepth.length - 1] === braceDepth) {
        templateDepth.pop();
        i--;
        scanTemplate();
      }
    } else {
      i++;
    }
  }
  return comments;
}
