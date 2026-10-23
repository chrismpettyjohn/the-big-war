import type { CommandHandler, CommandHandlers, CommandLike, Dispatcher } from './command.types';

export function createDispatcher<S, C extends CommandLike, R>(handlers: CommandHandlers<S, C, R>): Dispatcher<S, C, R> {
  return (state: S, command: C): R => {
    const handler = handlers[command.type as C['type']] as CommandHandler<S, C, R>;
    return handler(state, command);
  };
}

export function ok<T extends string>(type: T): { readonly ok: true; readonly type: T } {
  return { ok: true, type };
}

export function fail<T extends string, E extends string>(
  type: T,
  reason: E,
): { readonly ok: false; readonly type: T; readonly reason: E } {
  return { ok: false, type, reason };
}
