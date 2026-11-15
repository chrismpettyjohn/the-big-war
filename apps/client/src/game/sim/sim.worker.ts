import type { SimRequest } from './sim.types';
import { startSimLoop } from './sim-loop.service';
import { createSimHost } from './sim-host.service';
import { workerScope } from '@the-big-war/frontend/session/worker-scope';

const scope = workerScope<SimRequest>();

const host = createSimHost((reply, transfer) => scope.postMessage(reply, transfer));

scope.onmessage = event => host.handle(event.data);

startSimLoop(host);
