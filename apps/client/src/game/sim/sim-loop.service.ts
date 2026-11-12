import type { SimHost } from './sim.types';
import { LOOP_MS, MAX_FRAME_SECONDS, PUBLISH_MS } from './sim-loop.constants';

export function startSimLoop(host: SimHost): () => void {
  let last = performance.now();
  let lastPublish = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    host.advance(Math.min(MAX_FRAME_SECONDS, (now - last) / 1000));
    last = now;
    if (now - lastPublish < PUBLISH_MS) return;
    lastPublish = now;
    host.publish();
  }, LOOP_MS);
  return () => clearInterval(timer);
}
