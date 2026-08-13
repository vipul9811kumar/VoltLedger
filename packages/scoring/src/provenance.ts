/**
 * WS-G: derives a Provenance tag from a battery's DataSource, rather than hand-setting it
 * independently on every scoring/RV/LTV output. See build spec v2 §1.3.
 */
import type { DataSource } from '@voltledger/db';
import type { Provenance } from '@voltledger/types';

/**
 * SYNTHETIC is the only DataSource tools/synthetic-generator (the sole producer of demo
 * batteries today) ever writes — every other value implies a real ingestion path
 * (OEM_API, MQTT_TELEMATICS, MANUAL_UPLOAD, AUCTION_SCAN, EU_PASSPORT).
 *
 * ILLUSTRATIVE has no producer yet — nothing in this codebase creates data that isn't tied to
 * a real-or-synthetic Battery row. Reserved for a future case with no anchor at all (e.g. if
 * WS-F's forceScenario stubs are ever surfaced standalone, outside a persisted battery).
 */
export function deriveProvenance(dataSource: DataSource): Provenance {
  return dataSource === 'SYNTHETIC' ? 'SIMULATED_CALIBRATED' : 'REAL_ANCHORED';
}
