import type { Rule, Violation } from '../types';

type ImportGroup = { start: number; end: number; statements: string[] };

function parseImports(content: string): ImportGroup[] {
  const lines = content.split('\n');
  const groups: ImportGroup[] = [];
  let inGroup = false;
  let groupStart = -1;
  let currentStmt = '';
  let statements: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!inGroup) {
      if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
        inGroup = true;
        groupStart = i;
        currentStmt = line;
        if (line.includes(';') || line.includes(" from '") || line.includes(' from "')) {
          statements.push(currentStmt);
          currentStmt = '';
        }
      }
    } else {
      if (currentStmt !== '') {
        currentStmt += '\n' + line;
        if (line.includes(';') || line.includes(" from '") || line.includes(' from "')) {
          statements.push(currentStmt);
          currentStmt = '';
        }
      } else if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
        currentStmt = line;
        if (line.includes(';') || line.includes(" from '") || line.includes(' from "')) {
          statements.push(currentStmt);
          currentStmt = '';
        }
      } else if (trimmed === '') {
        if (statements.length > 0) {
          groups.push({ start: groupStart, end: i - 1, statements: [...statements] });
          statements = [];
        }
        inGroup = false;
      } else {
        if (statements.length > 0) {
          groups.push({ start: groupStart, end: i - 1, statements: [...statements] });
          statements = [];
        }
        inGroup = false;
      }
    }
    i++;
  }

  if (inGroup && statements.length > 0) {
    groups.push({ start: groupStart, end: lines.length - 1, statements: [...statements] });
  }

  return groups;
}

function sortStatements(statements: string[]): string[] {
  return [...statements].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
}

export const sortImports: Rule = {
  name: 'sort-imports',
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  apply(file, source) {
    const lines = source.split('\n');
    const violations: Violation[] = [];
    const groups = parseImports(source);
    for (let g = groups.length - 1; g >= 0; g--) {
      const group = groups[g]!;
      const sorted = sortStatements(group.statements);
      if (group.statements.every((stmt, idx) => stmt === sorted[idx])) continue;
      violations.push({
        rule: 'sort-imports',
        file,
        line: group.start + 1,
        message: 'Imports must be sorted by ascending character length',
      });
      lines.splice(group.start, group.end - group.start + 1, ...sorted);
    }
    return { output: lines.join('\n'), violations };
  },
};
