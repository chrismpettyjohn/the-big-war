export interface Modifier<K extends string = string> {
  readonly key: K;
  readonly add?: number;
  readonly mul?: number;

  readonly label?: string;
}

export interface ModifierTotal {
  add: number;
  mul: number;
}

export type ModifierTotals<K extends string = string> = { readonly [P in K]: ModifierTotal };
