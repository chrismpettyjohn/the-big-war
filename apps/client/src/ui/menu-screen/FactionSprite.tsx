import { For } from 'solid-js';

interface Sprite {
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

const SPRITES: Readonly<Record<string, Sprite>> = {
  ironclad: {
    rows: [
      '.........obo',
      '........obso',
      '.......obso.',
      '......obso..',
      '.....obso...',
      '.o..obso....',
      'ogoobso.....',
      '.ogbso......',
      '..ogo.......',
      '.ohogo......',
      'oho.ogo.....',
      'po...o......',
    ],
    palette: { o: '#1a1020', b: '#f4f7ff', s: '#9aa6c0', g: '#ffd447', h: '#8a5a32', p: '#ffd447' },
  },
  league: {
    rows: [
      '....oooo....',
      '..oolllloo..',
      '.oolddddyoo.',
      '.oldyyyydyo.',
      'oldyylyyydyo',
      'oldyylyyydyo',
      'oldyylyyydyo',
      'oldyylyyydyo',
      '.oydyyyydyo.',
      '.ooyddddyoo.',
      '..ooyyyyoo..',
      '....oooo....',
    ],
    palette: { o: '#7a4a10', y: '#ffc93c', l: '#fff0a8', d: '#d9921c' },
  },
  verdant: {
    rows: [
      '............',
      '.oooooooo...',
      '.ommmmmmlo..',
      '.ommmmmmlo..',
      '.oooooooo...',
      '....owwo....',
      '....owwo....',
      '....owwo....',
      '....owwo....',
      '....owwo....',
      '....owwo....',
      '....oooo....',
    ],
    palette: { o: '#2a1d12', m: '#8f9bb3', l: '#d6deeb', w: '#b5743f' },
  },
  academy: {
    rows: [
      '....kkkk....',
      '....kkkk....',
      '...oooooo...',
      '...olgggo...',
      '...olgggo...',
      '...olgggo...',
      '...olccco...',
      '...olccco...',
      '...occcco...',
      '...occcco...',
      '....occo....',
      '.....oo.....',
    ],
    palette: { o: '#1d1a3a', k: '#a8703f', g: '#cfe7ff', l: '#ffffff', c: '#e8424f' },
  },
};

export const FactionSprite = (props: { factionId: string; class?: string }) => {
  const sprite = () => SPRITES[props.factionId] ?? SPRITES.ironclad!;
  const pixels = () =>
    sprite().rows.flatMap((row, y) =>
      [...row].flatMap((key, x) => (key === '.' ? [] : [{ x, y, fill: sprite().palette[key] ?? '#000' }])),
    );
  return (
    <svg class={props.class} viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
      <For each={pixels()}>{pixel => <rect x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.fill} />}</For>
    </svg>
  );
};
