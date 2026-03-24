/**
 * Scoring model constants — version 1.0
 * All thresholds and weights here are calibrated from real-world battery studies.
 */

export const MODEL_VERSION = '1.0';

// ── Risk score grade thresholds (0–1000) ─────────────────────────────────────
export const GRADE_THRESHOLDS = {
  A: 800,   // 800–1000: Excellent
  B: 650,   // 650–799:  Good
  C: 500,   // 500–649:  Fair
  D: 350,   // 350–499:  Poor
  // F:  0–349:  Critical
} as const;

// ── Sub-score weights (must sum to 1.0) ──────────────────────────────────────
export const SUB_SCORE_WEIGHTS = {
  degradation:       0.30,   // Most important — rate of SoH decline
  thermalScore:      0.20,   // Thermal management quality
  usagePattern:      0.20,   // DCFC ratio, charge depth behaviour
  capacityRetention: 0.20,   // Current vs nominal capacity
  ageAdjusted:       0.10,   // SoH relative to expected for age
} as const;

// ── Chemistry degradation benchmarks ─────────────────────────────────────────
// Expected SoH (%) after N years of normal use — used for age-adjusted scoring
export const EXPECTED_SOH_BY_CHEMISTRY: Record<string, number[]> = {
  //                    0yr  1yr  2yr  3yr  4yr  5yr  6yr  7yr  8yr
  LFP:  [100,  99,  97.5, 96,  94.5, 93,  91.5, 90,  88.5],
  NMC:  [100,  98,  95.5, 93,  90.5, 88,  85.5, 83,  80.5],
  NCA:  [100,  97,  93.5, 90,  86.5, 83,  79.5, 76,  73.0],
  LTO:  [100,  99.5, 99, 98.5, 98,  97.5, 97,  96.5, 96.0],
};

// ── Thermal thresholds (°C) ───────────────────────────────────────────────────
export const THERMAL_THRESHOLDS = {
  LFP: { optimal: 25, warn: 40, critical: 50 },
  NMC: { optimal: 20, warn: 38, critical: 48 },
  NCA: { optimal: 20, warn: 35, critical: 45 },
  LTO: { optimal: 25, warn: 45, critical: 55 },
};

// ── DCFC thresholds ───────────────────────────────────────────────────────────
export const DCFC_THRESHOLDS = {
  LOW:      0.10,   // ≤10% DCFC: excellent
  MODERATE: 0.30,   // 10–30%: acceptable
  HIGH:     0.50,   // 30–50%: concerning
  CRITICAL: 0.70,   // >50%: significant degradation accelerant
};

// ── Residual value model ──────────────────────────────────────────────────────
// Battery value as % of total vehicle value by chemistry
export const BATTERY_VALUE_PCT = {
  LFP: 0.42,
  NMC: 0.48,
  NCA: 0.52,
  LTO: 0.45,
};

// Annual depreciation multiplier on battery value (beyond SoH-driven decline)
export const MARKET_DEPRECIATION_RATE = {
  LFP: 0.06,   // 6%/yr — durable, slow market depreciation
  NMC: 0.09,
  NCA: 0.11,
  LTO: 0.05,
};

// ── LTV parameters ────────────────────────────────────────────────────────────
export const LTV_BASE = 0.75;          // 75% starting LTV
export const LTV_MAX  = 0.85;          // Never exceed 85% for EV batteries
export const LTV_MIN  = 0.40;          // Floor for high-risk batteries

// Risk premium: basis points added to loan rate per 100-point risk score drop
export const RISK_PREMIUM_BPS_PER_100_SCORE = 15;

// ── Second-life SoH thresholds ────────────────────────────────────────────────
export const SECOND_LIFE_THRESHOLDS = {
  EV_FLEET:              75,   // Can still power an EV with reduced range
  STATIONARY_GRID:       70,   // Grid storage (high cycle, stable draw)
  STATIONARY_COMMERCIAL: 65,
  STATIONARY_RESIDENTIAL: 60,
  REFURBISHMENT:         55,
  RECYCLING_ONLY:         0,   // Below all thresholds
};
