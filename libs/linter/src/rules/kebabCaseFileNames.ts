import type { Rule, Violation } from '../types';

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PASCAL_SEGMENT = /^[A-Z][a-zA-Z0-9]*$/;

function isClientFile(file: string): boolean {
  return /(?:^|\/)apps\/client\//.test(file.replaceAll('\\', '/'));
}

function isKebabCase(name: string): boolean {
  return name.split('.').every((segment) => KEBAB_SEGMENT.test(segment));
}

function isPascalCaseComponent(name: string): boolean {
  const [first, ...rest] = name.split('.');
  return first !== undefined && PASCAL_SEGMENT.test(first) && rest.every((segment) => KEBAB_SEGMENT.test(segment));
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

export const kebabCaseFileNames: Rule = {
  name: 'kebab-case-file-names',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json'],
  apply(file, source) {
    const violations: Violation[] = [];
    if (!isClientFile(file)) return { output: source, violations };

    const name = file.replaceAll('\\', '/').split('/').pop() ?? '';
    const base = baseName(name);
    if (isKebabCase(base) || isPascalCaseComponent(base)) return { output: source, violations };

    violations.push({
      rule: 'kebab-case-file-names',
      file,
      line: 1,
      message: `File name "${name}" must be kebab-case (e.g. map-generator.service.ts) or PascalCase for components (e.g. AboutView.tsx)`,
    });
    return { output: source, violations };
  },
};
