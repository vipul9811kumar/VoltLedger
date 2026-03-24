/**
 * Persists a normalized telemetry point to PostgreSQL.
 * Also updates battery.lastTelemetryAt.
 */

import { prisma } from '@voltledger/db';
import type { TelemetryJob } from '../queues/telemetry.queue';
import { normalizeTelemetry } from './normalize';

export interface StoreResult {
  batteryId: string;
  telemetryId: string;
  isNewBattery: boolean;
  skipped: boolean;
  reason?: string;
}

export async function storeTelemetry(
  batteryId: string,
  job: TelemetryJob,
): Promise<StoreResult> {
  const normalized = normalizeTelemetry(batteryId, job);

  // Deduplicate: skip if we already have a point for this battery at this exact timestamp
  const existing = await prisma.batteryTelemetryPoint.findFirst({
    where: {
      batteryId,
      recordedAt: normalized.recordedAt,
    },
    select: { id: true },
  });

  if (existing) {
    return { batteryId, telemetryId: existing.id, isNewBattery: false, skipped: true, reason: 'duplicate_timestamp' };
  }

  // Write telemetry point + update battery's lastTelemetryAt in a transaction
  const [telemetryPoint] = await prisma.$transaction([
    prisma.batteryTelemetryPoint.create({
      data: {
        battery:               { connect: { id: batteryId } },
        recordedAt:            normalized.recordedAt,
        source:                normalized.source as any,
        stateOfHealth:         normalized.stateOfHealth,
        stateOfCharge:         normalized.stateOfCharge,
        fullChargeCapacityKwh: normalized.fullChargeCapacityKwh,
        cycleCount:            normalized.cycleCount,
        cellTempMin:           normalized.cellTempMin,
        cellTempMax:           normalized.cellTempMax,
        cellTempAvg:           normalized.cellTempAvg,
        voltageMin:            normalized.voltageMin,
        voltageMax:            normalized.voltageMax,
        internalResistanceAvg: normalized.internalResistanceAvg ?? undefined,
        chargingEvents24h:     normalized.chargingEvents24h ?? undefined,
        dcFastChargeRatio:     normalized.dcFastChargeRatio ?? undefined,
        odometer:              normalized.odometer ?? undefined,
        rawPayload:            normalized.rawPayload,
      },
      select: { id: true },
    }),
    prisma.battery.update({
      where: { id: batteryId },
      data:  { lastTelemetryAt: normalized.recordedAt },
    }),
  ]);

  return {
    batteryId,
    telemetryId: telemetryPoint.id,
    isNewBattery: false,
    skipped: false,
  };
}

/**
 * Look up battery by serial number.
 * Returns null if not found (caller decides whether to reject or auto-register).
 */
export async function resolveBattery(serialNumber: string) {
  return prisma.battery.findUnique({
    where: { serialNumber },
    select: { id: true, chemistry: true, nominalCapacityKwh: true, status: true },
  });
}
