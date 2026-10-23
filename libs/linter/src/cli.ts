#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import { rules } from './index';
import type { Violation } from './types';

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git']);

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const roots = args.filter((a) => !a.startsWith('--'));

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

const files: string[] = [];
for (const root of roots.length ? roots : ['.']) {
  if (fs.statSync(root).isDirectory()) walk(root, files);
  else files.push(root);
}

const violations: Violation[] = [];
let fixedCount = 0;

for (const file of files) {
  const applicable = rules.filter((r) => r.extensions.some((ext) => file.endsWith(ext)));
  if (!applicable.length) continue;
  const original = fs.readFileSync(file, 'utf8');
  let source = original;
  for (const rule of applicable) {
    const result = rule.apply(file, source);
    violations.push(...result.violations);
    if (fix) source = result.output;
  }
  if (fix && source !== original) {
    fs.writeFileSync(file, source, 'utf8');
    fixedCount++;
  }
}

if (fix) {
  console.log(`Fixed ${violations.length} problems in ${fixedCount} files.`);
} else if (violations.length) {
  for (const v of violations) console.error(`${v.file}:${v.line}  ${v.rule}  ${v.message}`);
  console.error(`\n${violations.length} problems. Run \`bun run lint:fix\` to fix.`);
  process.exit(1);
} else {
  console.log('No lint problems found.');
}
