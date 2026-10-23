declare module '*.css';

interface ImportMeta {
  glob<T = unknown>(
    pattern: string | readonly string[],
    options?: Record<string, unknown>,
  ): Record<string, T>;
}
