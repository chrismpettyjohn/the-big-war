import { describe, expect, test } from 'bun:test';
import { hexShade, mixColor, parseCssColor, shadeColor } from '@the-big-war/client/render/theme';

describe('parseCssColor', () => {
  test('parses #rrggbb and #rgb', () => {
    expect(parseCssColor('#e0523c')).toBe(0xe0523c);
    expect(parseCssColor('#fff')).toBe(0xffffff);
    expect(parseCssColor('#000')).toBe(0x000000);
  });

  test('parses rgb()/rgba()', () => {
    expect(parseCssColor('rgb(31, 51, 66)')).toBe((31 << 16) | (51 << 8) | 66);
    expect(parseCssColor('rgba(255, 0, 0, 0.5)')).toBe(0xff0000);
  });

  test('returns null for junk', () => {
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('not-a-colour')).toBeNull();
    expect(parseCssColor('#zz')).toBeNull();
  });
});

describe('colour helpers', () => {
  test('mixColor is allocation-free and hits the endpoints', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    
    const mid = mixColor(0x000000, 0xffffff, 0.5);
    expect((mid >> 16) & 0xff).toBe(127);
    expect((mid >> 8) & 0xff).toBe(127);
    expect(mid & 0xff).toBe(127);
  });

  test('shadeColor clamps to the 0..255 range', () => {
    expect(shadeColor(0xffffff, 2)).toBe(0xffffff);
    expect(shadeColor(0x808080, 0)).toBe(0x000000);
    expect(shadeColor(0x808080, 1)).toBe(0x808080);
  });
});

describe('hexShade', () => {
  test('is deterministic and inside the declared band', () => {
    const first = hexShade(12, -7);
    const second = hexShade(12, -7);
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0.9);
    expect(first).toBeLessThan(1.1);
  });

  test('varies across neighbouring hexes', () => {
    const values = new Set([
      hexShade(0, 0),
      hexShade(1, 0),
      hexShade(0, 1),
      hexShade(5, -3),
      hexShade(-2, 4),
    ]);
    
    expect(values.size).toBeGreaterThanOrEqual(3);
  });
});
