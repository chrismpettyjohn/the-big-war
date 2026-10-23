export type Agent<S, C> = (state: S, dt: number) => readonly C[];
