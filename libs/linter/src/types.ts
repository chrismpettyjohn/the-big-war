export type Comment = {
  start: number;
  end: number;
  text: string;
};

export type Violation = {
  rule: string;
  file: string;
  line: number;
  message: string;
};

export type RuleResult = {
  output: string;
  violations: Violation[];
};

export type Rule = {
  name: string;
  extensions: string[];
  apply: (file: string, source: string) => RuleResult;
};
