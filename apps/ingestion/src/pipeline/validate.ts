/**
 * Telemetry validation using Zod.
 * Rejects clearly bad data before it touches the database.
 */

import { z } from 'zod';
import type { TelemetryJob } from '../queues/telemetry.queue';

const TelemetrySchema = z.object({
  serialNumber:            z.string().min(3).max(60),
  source:                  z.string().min(1),
  recordedAt:              z.string().datetime(),

  stateOfHealth:           z.number().min(0).max(100),
  stateOfCharge:           z.number().min(0).max(100),
  fullChargeCapacityKwh:   z.number().positive().max(500),
  cycleCount:              z.number().int().min(0).max(100_000),

  cellTempMin:             z.number().min(-40).max(100),
  cellTempMax:             z.number().min(-40).max(120),
  cellTempAvg:             z.number().min(-40).max(120),

  voltageMin:              z.number().positive().max(1500),
  voltageMax:              z.number().positive().max(1500),

  internalResistanceAvg:   z.number().positive().max(100).optional(),
  chargingEvents24h:       z.number().int().min(0).max(50).optional(),
  dcFastChargeRatio:       z.number().min(0).max(1).optional(),
  odometer:                z.number().min(0).max(2_000_000).optional(),

  rawPayload:              z.record(z.unknown()).optional(),
});

export interface ValidationResult {
  valid: boolean;
  data?: z.infer<typeof TelemetrySchema>;
  errors?: string[];
  warnings?: string[];
}

export function validateTelemetry(job: TelemetryJob): ValidationResult {
  const result = TelemetrySchema.safeParse(job);
  const warnings: string[] = [];

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    };
  }

  const d = result.data;

  // Cross-field sanity checks
  if (d.cellTempMin > d.cellTempMax) {
    return { valid: false, errors: ['cellTempMin cannot exceed cellTempMax'] };
  }
  if (d.voltageMin > d.voltageMax) {
    return { valid: false, errors: ['voltageMin cannot exceed voltageMax'] };
  }
  if (d.cellTempAvg < d.cellTempMin || d.cellTempAvg > d.cellTempMax) {
    return { valid: false, errors: ['cellTempAvg must be between cellTempMin and cellTempMax'] };
  }

  // Soft warnings (data passes, but flag for monitoring)
  if (d.stateOfHealth < 50)  warnings.push('SoH critically low (<50%)');
  if (d.cellTempMax > 55)    warnings.push('High cell temperature detected (>55°C)');
  if (d.dcFastChargeRatio && d.dcFastChargeRatio > 0.8) {
    warnings.push('Extremely high DCFC ratio (>80%)');
  }
  if (d.cycleCount > 5000)   warnings.push('Very high cycle count (>5000)');

  return { valid: true, data: d, warnings };
}
