/**
 * Normalizes a validated telemetry payload before DB write.
 * Handles unit conversions, rounding, and source mapping.
 */

import type { Prisma } from '@voltledger/db';
import type { TelemetryJob } from '../queues/telemetry.queue';

const SOURCE_MAP: Record<string, Prisma.EnumDataSourceFilter['equals']> = {
  OEM_API:          'OEM_API',
  MQTT_TELEMATICS:  'MQTT_TELEMATICS',
  MANUAL_UPLOAD:    'MANUAL_UPLOAD',
  AUCTION_SCAN:     'AUCTION_SCAN',
  SYNTHETIC:        'SYNTHETIC',
};

export function normalizeTelemetry(
  batteryId: string,
  job: TelemetryJob,
): Omit<Prisma.BatteryTelemetryPointCreateInput, 'battery'> & { batteryId: string } {
  const source = SOURCE_MAP[job.source.toUpperCase()] ?? 'MANUAL_UPLOAD';

  return {
    batteryId,
    recordedAt:             new Date(job.recordedAt),
    source:                 source as any,

    // Round to 2dp for consistency
    stateOfHealth:          Math.round(job.stateOfHealth * 100) / 100,
    stateOfCharge:          Math.round(job.stateOfCharge * 100) / 100,
    fullChargeCapacityKwh:  Math.round(job.fullChargeCapacityKwh * 100) / 100,
    cycleCount:             job.cycleCount,

    cellTempMin:            Math.round(job.cellTempMin * 10) / 10,
    cellTempMax:            Math.round(job.cellTempMax * 10) / 10,
    cellTempAvg:            Math.round(job.cellTempAvg * 10) / 10,

    voltageMin:             Math.round(job.voltageMin * 10) / 10,
    voltageMax:             Math.round(job.voltageMax * 10) / 10,

    internalResistanceAvg:  job.internalResistanceAvg != null
      ? Math.round(job.internalResistanceAvg * 100) / 100
      : null,

    chargingEvents24h:      job.chargingEvents24h ?? null,
    dcFastChargeRatio:      job.dcFastChargeRatio != null
      ? Math.round(job.dcFastChargeRatio * 1000) / 1000
      : null,
    odometer:               job.odometer != null
      ? Math.round(job.odometer)
      : null,

    rawPayload:             (job.rawPayload ?? undefined) as any,
  };
}
