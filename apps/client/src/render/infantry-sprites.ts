import type { UnitKind } from '../game/unit/unit.types';

export type InfantryKind = Exclude<UnitKind, 'mrap' | 'tank'>;

export type InfantryPose = 'stand' | 'walkA' | 'walkB' | 'aim' | 'fire' | 'prone' | 'proneFire' | 'dead';

export const INFANTRY_POSES: readonly InfantryPose[] = ['stand', 'walkA', 'walkB', 'aim', 'fire', 'prone', 'proneFire', 'dead'];

export const INFANTRY_WIDTH = 20;
export const INFANTRY_HEIGHT = 12;
export const INFANTRY_ANCHOR_X = 5.5;

export const INFANTRY_PALETTE: Readonly<Record<string, number | 'nation' | 'nationDark'>> = {
  k: 0x1b1330,
  f: 0xe8b48a,
  F: 0xb98058,
  d: 0x3a2618,
  b: 0x8a5a2b,
  n: 0x3c3c46,
  m: 0x6e6e7e,
  y: 0xfff3b0,
  o: 0xffb347,
  g: 0x55703a,
  c: 'nation',
  C: 'nationDark',
};

const HEAD_HELMET = [
  '....kkkk............',
  '...kCCCCk...........',
  '...kkffFk...........',
  '....kffk............',
];

const HEAD_BOONIE = [
  '....kkkk............',
  '..kkccccck..........',
  '...kkffFk...........',
  '....kffk............',
];

const HEAD_BERET = [
  '...kkkk.............',
  '...kccCCk...........',
  '...kkffFk...........',
  '....kffk............',
];

const TORSO = [
  '...kcccck...........',
  '...kccccck..........',
  '...kcccck...........',
  '...kddddk...........',
];

const LEGS: Readonly<Record<'stand' | 'walkA' | 'walkB', readonly string[]>> = {
  stand: [
    '....kCkCk...........',
    '....kCkCk...........',
    '....kCkCk...........',
    '...kddkddk..........',
  ],
  walkA: [
    '....kCCCk...........',
    '...kCk.kCk..........',
    '..kCk...kCk.........',
    '..kdk....kdk........',
  ],
  walkB: [
    '....kCCk............',
    '....kCCk............',
    '....kCkk............',
    '....kddk............',
  ],
};

const PRONE_BODY = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '...........kkkk.....',
  '.kkkkkkkkkkCCCCk....',
  'kdkCCkcccccckffk....',
  '.kk.kkkkkkkkkkk.....',
];

const DEAD_BODY = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '..kkkkkkkkkkkk......',
  'kdkCCkcccccckkk.....',
  '.kk.kkkkkkkkkFk.....',
];

interface WeaponArt {
  readonly low: readonly string[];
  readonly aim: readonly string[];
  readonly prone: readonly string[];
  readonly muzzle: number;
  readonly proneMuzzle: number;
}

const WEAPONS: Readonly<Record<InfantryKind, WeaponArt>> = {
  infantry: {
    low: [
      '....................',
      '....bbnnnnnnn.......',
      '.....kcfk...........',
      '....................',
    ],
    aim: [
      '....kbbnnnnnnn......',
      '.....kcccf..........',
      '....................',
      '....................',
    ],
    prone: [
      '..............nnnnn.',
      '....................',
    ],
    muzzle: 14,
    proneMuzzle: 19,
  },
  assault: {
    low: [
      '....................',
      '....bnnnnn..........',
      '.....kfnk...........',
      '......n.............',
    ],
    aim: [
      '....knnnnnn.........',
      '.....kccfn..........',
      '.........n..........',
      '....................',
    ],
    prone: [
      '..............nnn...',
      '...............n....',
    ],
    muzzle: 11,
    proneMuzzle: 17,
  },
  mg: {
    low: [
      '...m................',
      '...mnnnnnnnnnn......',
      '...mnnfnk...........',
      '...mmm..............',
    ],
    aim: [
      '...knnnnnnnnnnn.....',
      '...mnnnfccf.........',
      '...mmm..............',
      '....................',
    ],
    prone: [
      '..............nnnnnn',
      '..............mn.n..',
    ],
    muzzle: 15,
    proneMuzzle: 20,
  },
  sniper: {
    low: [
      '.....nnn............',
      '...bbbnnnnnnnnnn....',
      '.....kcfk...........',
      '....................',
    ],
    aim: [
      '......nnn...........',
      '...kbbbnnnnnnnnnnn..',
      '.....kcccf..........',
      '....................',
    ],
    prone: [
      '..............nnnnnn',
      '...............n..n.',
    ],
    muzzle: 18,
    proneMuzzle: 20,
  },
};

const HEADS: Readonly<Record<InfantryKind, readonly string[]>> = {
  infantry: HEAD_HELMET,
  assault: HEAD_BERET,
  mg: HEAD_HELMET,
  sniper: HEAD_BOONIE,
};

export function infantryRows(kind: InfantryKind, pose: InfantryPose): string[] {
  const weapon = WEAPONS[kind];
  if (pose === 'dead') return [...DEAD_BODY];
  if (pose === 'prone' || pose === 'proneFire') {
    const rows = overlay([...PRONE_BODY], weapon.prone, 9);
    if (kind === 'sniper') rows[8] = '..........kkkkk.....';
    if (pose === 'proneFire') flash(rows, 9, weapon.proneMuzzle);
    return rows;
  }
  const legs = pose === 'walkA' || pose === 'walkB' ? LEGS[pose] : LEGS.stand;
  let rows = [...HEADS[kind], ...TORSO, ...legs];
  if (pose === 'aim' || pose === 'fire') {
    const top = kind === 'sniper' ? 2 : 3;
    rows = overlay(rows, weapon.aim, top);
    if (pose === 'fire') flash(rows, kind === 'sniper' ? top + 1 : top, weapon.muzzle);
  } else rows = overlay(rows, weapon.low, 4);
  return rows;
}

function overlay(base: string[], art: readonly string[], top: number): string[] {
  art.forEach((line, i) => {
    const row = base[top + i];
    if (row === undefined) return;
    let out = '';
    for (let x = 0; x < INFANTRY_WIDTH; x++) out += line[x] && line[x] !== '.' ? line[x] : (row[x] ?? '.');
    base[top + i] = out;
  });
  return base;
}

function flash(rows: string[], y: number, x: number): void {
  const put = (py: number, px: number, ch: string) => {
    const row = rows[py];
    if (!row || px < 0 || px >= INFANTRY_WIDTH) return;
    rows[py] = row.slice(0, px) + ch + row.slice(px + 1);
  };
  put(y, x, 'y');
  put(y, x + 1, 'o');
  put(y - 1, x, 'o');
  put(y + 1, x, 'o');
}
