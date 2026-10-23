export interface CommandLike {
  readonly type: string;
}

export type CommandOutcome<C extends CommandLike, E extends string> =
  | { readonly ok: true; readonly type: C['type'] }
  | { readonly ok: false; readonly type: C['type']; readonly reason: E };

export type CommandHandler<S, C extends CommandLike, R> = (state: S, command: C) => R;

export type CommandHandlers<S, C extends CommandLike, R> = {
  readonly [K in C['type']]: CommandHandler<S, Extract<C, { type: K }>, R>;
};

export type Dispatcher<S, C extends CommandLike, R> = (state: S, command: C) => R;

export interface CommandLogEntry<C extends CommandLike, R> {
  readonly tick: number;
  readonly command: C;
  readonly result: R;
}
