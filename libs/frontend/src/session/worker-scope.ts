export interface WorkerScope<In> {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<In>) => void) | null;
}

export function workerScope<In>(): WorkerScope<In> {
  return globalThis as unknown as WorkerScope<In>;
}
