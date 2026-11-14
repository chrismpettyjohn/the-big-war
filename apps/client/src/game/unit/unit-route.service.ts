import type { Unit } from './unit.types';
import type { GameState } from '../state/state.types';
import { cellAtPixel, isWalkable } from './unit.service';
import { aStar } from '@the-big-war/game-engine/pathfinding/a-star.service';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Route {
  readonly goal: number;
  readonly points: readonly Point[];
  next: number;
}

const ROUTE_REACH = 0.35;
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const routes = new WeakMap<Unit, Route>();

export function clearWalk(state: GameState, x0: number, y0: number, x1: number, y1: number): boolean {
  const stride = state.config.map.hexSize / 2;
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stride);
  for (let at = 1; at < steps; at++) {
    const t = at / steps;
    if (!isWalkable(cellAtPixel(state, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))) return false;
  }
  return true;
}

export function routeStep(state: GameState, unit: Unit, goalX: number, goalY: number): Point {
  const goal = tileAt(state, goalX, goalY);
  if (goal < 0) return { x: goalX, y: goalY };
  let route = routes.get(unit);
  if (!route || route.goal !== goal) {
    route = { goal, points: plan(state, unit, goal, goalX, goalY), next: 0 };
    routes.set(unit, route);
  }
  const reach = state.config.map.hexSize * ROUTE_REACH;
  while (route.next < route.points.length) {
    const point = route.points[route.next]!;
    if (Math.hypot(point.x - unit.x, point.y - unit.y) > reach) return point;
    route.next += 1;
  }
  return { x: goalX, y: goalY };
}

function tileAt(state: GameState, x: number, y: number): number {
  const size = state.config.map.hexSize;
  const q = Math.floor(x / size);
  const r = Math.floor(y / size);
  if (q < 0 || r < 0 || q >= state.grid.width || r >= state.grid.height) return -1;
  return r * state.grid.width + q;
}

function centre(state: GameState, tile: number): Point {
  const size = state.config.map.hexSize;
  return { x: ((tile % state.grid.width) + 0.5) * size, y: (Math.floor(tile / state.grid.width) + 0.5) * size };
}

function plan(state: GameState, unit: Unit, goal: number, goalX: number, goalY: number): Point[] {
  if (clearWalk(state, unit.x, unit.y, goalX, goalY)) return [];
  const start = tileAt(state, unit.x, unit.y);
  if (start < 0 || !isWalkable(state.grid.cells[goal])) return [];
  const tiles = findPath(state, start, goal);
  return tiles ? smooth(state, unit, tiles, goalX, goalY) : [];
}

function findPath(state: GameState, start: number, goal: number): number[] | null {
  const { width, height, cells } = state.grid;
  const open = (q: number, r: number): boolean => q >= 0 && r >= 0 && q < width && r < height && isWalkable(cells[r * width + q]);
  const gq = goal % width;
  const gr = Math.floor(goal / width);
  return aStar({
    start,
    goal,
    heuristic(node) {
      const dq = Math.abs((node % width) - gq);
      const dr = Math.abs(Math.floor(node / width) - gr);
      return Math.max(dq, dr) + (Math.SQRT2 - 1) * Math.min(dq, dr);
    },
    neighbors(node, visit) {
      const q = node % width;
      const r = Math.floor(node / width);
      for (const [dq, dr] of DIRECTIONS) {
        if (!open(q + dq, r + dr)) continue;
        if (dq !== 0 && dr !== 0 && (!open(q + dq, r) || !open(q, r + dr))) continue;
        visit((r + dr) * width + q + dq, dq !== 0 && dr !== 0 ? Math.SQRT2 : 1);
      }
    },
  });
}

function smooth(state: GameState, unit: Unit, tiles: readonly number[], goalX: number, goalY: number): Point[] {
  const points: Point[] = [];
  let from: Point = { x: unit.x, y: unit.y };
  let at = 0;
  const target = (index: number): Point => (index === tiles.length - 1 ? { x: goalX, y: goalY } : centre(state, tiles[index]!));
  while (at < tiles.length - 1) {
    let reach = at + 1;
    while (reach + 1 < tiles.length) {
      const next = target(reach + 1);
      if (!clearWalk(state, from.x, from.y, next.x, next.y)) break;
      reach += 1;
    }
    if (reach === tiles.length - 1) break;
    from = target(reach);
    points.push(from);
    at = reach;
  }
  return points;
}
