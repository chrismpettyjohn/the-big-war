import type { SimRequest } from './sim.types';
import { startSimLoop } from './sim-loop.service';
import { createSimHost } from './sim-host.service';

const scope = globalThis as unknown as {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<SimRequest>) => void) | null;
};

const host = createSimHost((reply, transfer) => scope.postMessage(reply, transfer));

scope.onmessage = event => host.handle(event.data);

startSimLoop(host);
