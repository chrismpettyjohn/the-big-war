import type { Rule } from './types';
import { noComments } from './rules/noComments';
import { sortImports } from './rules/sortImports';
import { kebabCaseFileNames } from './rules/kebabCaseFileNames';

export type { Rule, RuleResult, Violation } from './types';
export { scanComments } from './scanner';
export { kebabCaseFileNames, noComments, sortImports };

export const rules: Rule[] = [kebabCaseFileNames, noComments, sortImports];
