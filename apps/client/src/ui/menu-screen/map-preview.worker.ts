import { previewPixels } from './map-preview-pixels';
import type { MatchSettings } from '../../session/flow';
import { workerScope } from '@the-big-war/frontend/session/worker-scope';

const scope = workerScope<{ key: string; settings: MatchSettings }>();

scope.onmessage = ({ data }) => {
  const preview = previewPixels(data.settings);
  scope.postMessage({ key: data.key, ...preview }, [preview.pixels.buffer]);
};
