export const ENGINE_TUNING = {
  frontAttackShare: 0.5,
  frontDefenceShare: 0.5,
  barracksAttackBonusPer: 0.08,
  fortDefenceBonusPer: 0.12,
  cityDefenceBonusPer: 0.15,
  cityAttackBonusPer: 0.1,
  defaultTerrainDefence: 1.0,
  capturePressureRatio: 1.5,
  holdingFireShare: 0.5,
  workersPerBuilding: 1,
  progressEpsilon: 1e-9,

  cityPopGrowthPerLevel: 0.5,
  barracksRecruitBonusPer: 0.5,
  fortRecruitBonusPer: 0.1,

  claimSoldiersPerHex: 1,
  claimPerStructures: 2,
  claimHexesPerSize: 6,
  maxClaimsPerTick: 24,
} as const;
