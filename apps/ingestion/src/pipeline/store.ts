/**
 * Persists a normalized telemetry point to PostgreSQL.
 * Also updates battery.lastTelemetryAt.
 */

import { prisma, type Battery } from '@voltledger/db';
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
 * Returns null if not found.
 */
export async function resolveBattery(serialNumber: string): Promise<Pick<Battery, 'id' | 'chemistry' | 'nominalCapacityKwh' | 'status'> | null> {
  return prisma.battery.findUnique({
    where: { serialNumber },
    select: { id: true, chemistry: true, nominalCapacityKwh: true, status: true },
  });
}

/**
 * Auto-register a battery when it arrives in telemetry but isn't in the DB yet.
 * Picks the first battery model matching the chemistry as a default.
 */
export async function autoRegisterBattery(serialNumber: string, chemistry?: string): Promise<Pick<Battery, 'id' | 'chemistry' | 'nominalCapacityKwh' | 'status'> | null> {
  const model = await prisma.batteryModel.findFirst({
    where: chemistry ? { chemistry: chemistry as any } : undefined,
  });

  if (!model) return null;

  // upsert prevents race condition when multiple concurrent workers
  // see the same unknown battery and all try to register it simultaneously
  return prisma.battery.upsert({
    where:  { serialNumber },
    update: {},
    create: {
      serialNumber,
      batteryModelId:     model.id,
      chemistry:          model.chemistry,
      nominalCapacityKwh: model.capacityKwh,
      dataSource:         'SYNTHETIC',
    },
    select: { id: true, chemistry: true, nominalCapacityKwh: true, status: true },
  });
}
