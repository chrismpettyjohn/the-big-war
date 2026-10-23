import type { MatchRuntime } from '../../session/runtime';

export type PanelId = 'build' | 'army' | 'research' | 'diplomacy' | 'wiki' | null;

export interface NoticesProps {
  readonly controllers: MatchRuntime['controllers'];
}
