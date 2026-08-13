/**
 * Passport-aware scoring utilities
 *
 * Handles SoH reconciliation between EU Battery Passport data and telemetry,
 * and computes a confidence-weighted score adjustment when passport data is present.
 */

import type { PassportContext, ReconciledSoH, SoHSource } from '@voltledger/types';
import { DATALESS_SOH_ASSUMPTION } from './constants';

// ── SoH reconciliation ────────────────────────────────────────────────────────

/**
 * Reconcile SoH from passport and/or telemetry into a single authoritative value.
 *
 * Blending weights when both sources present:
 *   - Passport verified + identity chain valid: 65% passport / 35% telemetry
 *   - Passport present but unverified:          45% passport / 55% telemetry
 *   - Passport public tier only (no unitSoH):   telemetry only
 *
 * When sources disagree by >8pp, we lower overall confidence and flag it —
 * that delta is itself a risk signal (potential odometer-style fraud).
 */
export function reconcileSoH(
  telemetrySoH: number | undefined,
  passport: PassportContext | undefined,
): ReconciledSoH {
  const hasTelemetry   = telemetrySoH != null && telemetrySoH > 0;
  const hasPassportSoH = passport?.unitSoH != null && passport.tierAccess !== 'PUBLIC';

  // No data at all
  if (!hasTelemetry && !hasPassportSoH) {
    return { value: DATALESS_SOH_ASSUMPTION, source: 'NONE', confidence: 0.1 };
  }

  // Telemetry only
  if (!hasPassportSoH) {
    return {
      value:       telemetrySoH!,
      source:      'TELEMETRY',
      confidence:  0.70,
      telemetrySoH: telemetrySoH!,
    };
  }

  const passportSoH = passport!.unitSoH!;

  // Passport restricted tier only (no telemetry)
  if (!hasTelemetry) {
    const conf = passport!.isVerified && passport!.identityChainValid ? 0.80 : 0.60;
    return {
      value:       passportSoH,
      source:      'PASSPORT',
      confidence:  conf,
      passportSoH,
    };
  }

  // Both available — blend
  const verified = passport!.isVerified && passport!.identityChainValid;
  const pWeight  = verified ? 0.65 : 0.45;
  const tWeight  = 1 - pWeight;

  const blended = Math.round((passportSoH * pWeight + telemetrySoH! * tWeight) * 10) / 10;
  const delta   = Math.round((passportSoH - telemetrySoH!) * 10) / 10;

  // Large delta → sources disagree → reduced confidence
  const absDelta   = Math.abs(delta);
  const baseConf   = verified ? 0.92 : 0.78;
  const confidence = absDelta > 8 ? Math.max(0.40, baseConf - absDelta * 0.02) : baseConf;

  return {
    value:       blended,
    source:      'BLENDED',
    confidence:  Math.round(confidence * 100) / 100,
    passportSoH,
    telemetrySoH: telemetrySoH!,
    delta,
  };
}

// ── Passport score bonus / penalty ────────────────────────────────────────────

export interface PassportScoreAdjustment {
  /** Additive points to apply to the 0–100 composite before scaling to 0–1000 */
  adjustment:  number;
  rationale:   string[];
}

/**
 * Compute score adjustments derived purely from passport signals.
 *
 * Positive adjustments: verified identity, good lifecycle data, low carbon.
 * Negative adjustments: negative events (faults/accidents), FAULTY status,
 *   high temp history, or a suspicious passport↔telemetry SoH delta.
 */
export function computePassportAdjustment(
  passport: PassportContext,
  reconciledSoH: ReconciledSoH,
): PassportScoreAdjustment {
  const rationale: string[] = [];
  let adj = 0;

  if (passport.isVerified && passport.identityChainValid) {
    adj += 3;
    rationale.push('+3 passport identity verified');
  } else if (passport.isVerified) {
    adj += 1;
    rationale.push('+1 passport present but identity chain not fully confirmed');
  }

  // Faulty status
  if (passport.batteryStatusCode === 'FAULTY') {
    adj -= 15;
    rationale.push('-15 passport reports FAULTY battery status');
  } else if (passport.batteryStatusCode === 'DEGRADED') {
    adj -= 5;
    rationale.push('-5 passport reports DEGRADED battery status');
  }

  // Lifetime temperature overexposure
  if (passport.tempHistoryMax != null) {
    if (passport.tempHistoryMax > 65) {
      adj -= 8;
      rationale.push(`-8 lifetime max temp ${passport.tempHistoryMax}°C exceeds safe threshold`);
    } else if (passport.tempHistoryMax > 55) {
      adj -= 3;
      rationale.push(`-3 elevated lifetime max temp ${passport.tempHistoryMax}°C`);
    }
  }

  // Passport ↔ telemetry discrepancy (fraud signal)
  if (reconciledSoH.delta != null) {
    const absDelta = Math.abs(reconciledSoH.delta);
    if (absDelta > 15) {
      adj -= 12;
      rationale.push(`-12 large SoH discrepancy: passport ${reconciledSoH.passportSoH}% vs telemetry ${reconciledSoH.telemetrySoH}% (Δ${reconciledSoH.delta > 0 ? '+' : ''}${reconciledSoH.delta}pp)`);
    } else if (absDelta > 8) {
      adj -= 5;
      rationale.push(`-5 notable SoH discrepancy passport vs telemetry (Δ${reconciledSoH.delta > 0 ? '+' : ''}${reconciledSoH.delta}pp)`);
    }
  }

  return { adjustment: Math.max(-30, Math.min(10, adj)), rationale };
}
