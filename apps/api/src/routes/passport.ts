/**
 * Passport routes
 *
 * POST /v1/passport/resolve          — resolve passport for a battery identifier
 * GET  /v1/passport/:passportId       — fetch cached passport record
 * POST /v1/passport/verify/:batteryId — run identity chain verification
 * GET  /v1/passport/battery/:serial   — get passport for a battery by serial
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { resolvePassport } from '../lib/passport/factory';
import { notFound, serverError } from '../lib/errors';

export async function passportRoutes(app: FastifyInstance) {

  // POST /v1/passport/resolve
  // Body: { identifier: string; preferRestrictedTier?: boolean }
  // Resolves (and upserts) a passport for the given battery identifier.
  app.post<{
    Body: { identifier: string; preferRestrictedTier?: boolean };
  }>('/resolve', async (req, reply) => {
    const { identifier, preferRestrictedTier = false } = req.body ?? {};
    if (!identifier) {
      return reply.status(400).send({ error: 'identifier is required' });
    }

    // Look up the battery by serial number
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: identifier },
    });
    if (!battery) {
      return notFound(reply, `Battery ${identifier} not found`);
    }

    try {
      const result = await resolvePassport(identifier, { preferRestrictedTier });

      if (!result.success || !result.passportData) {
        // No passport found for this battery — return 200 with explanation
        return reply.send({
          hasPassport:  false,
          batteryId:    battery.id,
          serial:       identifier,
          resolverUsed: result.resolverUsed,
          reason:       result.error ?? 'No passport found',
          latencyMs:    result.latencyMs,
        });
      }

      const p = result.passportData;

      // Upsert passport into DB
      const passport = await prisma.batteryPassport.upsert({
        where: { batteryId: battery.id },
        update: {
          tierAccess:             result.tierAccess as any,
          carbonFootprintKgCo2e:  p.carbonFootprintKgCo2e ?? null,
          carbonIntensityClass:   p.carbonIntensityClass ?? null,
          recycledContentPct:     p.recycledContentPct ?? null,
          cobaltPct:              p.cobaltPct ?? null,
          lithiumPct:             p.lithiumPct ?? null,
          nickelPct:              p.nickelPct ?? null,
          manganesePct:           p.manganesePct ?? null,
          ratedCapacityAh:        p.ratedCapacityAh ?? null,
          energyDensityWhKg:      p.energyDensityWhKg ?? null,
          powerDensityWKg:        p.powerDensityWKg ?? null,
          expectedLifetimeCycles: p.expectedLifetimeCycles ?? null,
          temperatureRangeMin:    p.temperatureRangeMin ?? null,
          temperatureRangeMax:    p.temperatureRangeMax ?? null,
          recycledCobaltPct:      p.recycledCobaltPct ?? null,
          recycledLithiumPct:     p.recycledLithiumPct ?? null,
          recycledNickelPct:      p.recycledNickelPct ?? null,
          eolGuidanceText:        p.eolGuidanceText ?? null,
          unitSoH:                p.unitSoH ?? null,
          unitSoC:                p.unitSoC ?? null,
          chargeCycleCount:       p.chargeCycleCount ?? null,
          fullChargeCapacityAh:   p.fullChargeCapacityAh ?? null,
          remainingCapacityAh:    p.remainingCapacityAh ?? null,
          tempHistoryMin:         p.tempHistoryMin ?? null,
          tempHistoryMax:         p.tempHistoryMax ?? null,
          tempHistoryAvg:         p.tempHistoryAvg ?? null,
          batteryStatusCode:      p.batteryStatusCode ?? null,
          negativeEvents:         p.negativeEvents as any ?? null,
          lastSyncedAt:           result.resolvedAt,
          syncSucceeded:          true,
          syncErrorMessage:       null,
          rawPassportJson:        p as any,
        },
        create: {
          batteryId:              battery.id,
          passportUniqueId:       p.passportUniqueId,
          passportQrUrl:          p.passportQrUrl ?? null,
          dataExchangeFramework:  result.resolverUsed as any,
          tierAccess:             result.tierAccess as any,
          batteryCategory:        p.batteryCategory ?? null,
          manufacturerName:       p.manufacturerName ?? null,
          manufacturingDate:      p.manufacturingDate ? new Date(p.manufacturingDate) : null,
          manufacturingLocation:  p.manufacturingLocation ?? null,
          carbonFootprintKgCo2e:  p.carbonFootprintKgCo2e ?? null,
          carbonIntensityClass:   p.carbonIntensityClass ?? null,
          recycledContentPct:     p.recycledContentPct ?? null,
          cobaltPct:              p.cobaltPct ?? null,
          lithiumPct:             p.lithiumPct ?? null,
          nickelPct:              p.nickelPct ?? null,
          manganesePct:           p.manganesePct ?? null,
          ratedCapacityAh:        p.ratedCapacityAh ?? null,
          energyDensityWhKg:      p.energyDensityWhKg ?? null,
          powerDensityWKg:        p.powerDensityWKg ?? null,
          expectedLifetimeCycles: p.expectedLifetimeCycles ?? null,
          temperatureRangeMin:    p.temperatureRangeMin ?? null,
          temperatureRangeMax:    p.temperatureRangeMax ?? null,
          recycledCobaltPct:      p.recycledCobaltPct ?? null,
          recycledLithiumPct:     p.recycledLithiumPct ?? null,
          recycledNickelPct:      p.recycledNickelPct ?? null,
          eolGuidanceText:        p.eolGuidanceText ?? null,
          unitSoH:                p.unitSoH ?? null,
          unitSoC:                p.unitSoC ?? null,
          chargeCycleCount:       p.chargeCycleCount ?? null,
          fullChargeCapacityAh:   p.fullChargeCapacityAh ?? null,
          remainingCapacityAh:    p.remainingCapacityAh ?? null,
          tempHistoryMin:         p.tempHistoryMin ?? null,
          tempHistoryMax:         p.tempHistoryMax ?? null,
          tempHistoryAvg:         p.tempHistoryAvg ?? null,
          batteryStatusCode:      p.batteryStatusCode ?? null,
          negativeEvents:         p.negativeEvents as any ?? null,
          issuedAt:               p.issuedAt ? new Date(p.issuedAt) : null,
          expiresAt:              p.expiresAt ? new Date(p.expiresAt) : null,
          lastSyncedAt:           result.resolvedAt,
          syncSucceeded:          true,
          isVerified:             false,
          rawPassportJson:        p as any,
        },
      });

      return reply.status(201).send({
        hasPassport:  true,
        passportId:   passport.id,
        batteryId:    battery.id,
        serial:       identifier,
        tierAccess:   result.tierAccess,
        resolverUsed: result.resolverUsed,
        latencyMs:    result.latencyMs,
        passportUniqueId: p.passportUniqueId,
        message: `Passport resolved (${result.tierAccess} tier) via ${result.resolverUsed}`,
      });
    } catch (err) {
      return serverError(reply, err);
    }
  });

  // GET /v1/passport/battery/:serial — passport for a battery by serial
  app.get<{ Params: { serial: string } }>('/battery/:serial', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
    });
    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const passport = await prisma.batteryPassport.findUnique({
      where: { batteryId: battery.id },
      include: { verification: true },
    });

    if (!passport) {
      return reply.send({
        hasPassport: false,
        serial: req.params.serial,
        batteryId: battery.id,
        message: 'No EU Battery Passport on record. POST /v1/passport/resolve to fetch.',
      });
    }

    return reply.send({ hasPassport: true, ...formatPassport(passport) });
  });

  // GET /v1/passport/:passportId — fetch a specific passport by its ID
  app.get<{ Params: { passportId: string } }>('/:passportId', async (req, reply) => {
    const passport = await prisma.batteryPassport.findUnique({
      where: { id: req.params.passportId },
      include: { verification: true },
    });
    if (!passport) return notFound(reply, `Passport ${req.params.passportId} not found`);
    return formatPassport(passport);
  });

  // POST /v1/passport/verify/:batteryId — run identity chain verification
  app.post<{
    Params: { batteryId: string };
    Body: { verificationMethod?: string; lenderId?: string };
  }>('/verify/:batteryId', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { id: req.params.batteryId },
    });
    if (!battery) return notFound(reply, `Battery ${req.params.batteryId} not found`);

    const passport = await prisma.batteryPassport.findUnique({
      where: { batteryId: battery.id },
    });
    if (!passport) {
      return reply.status(422).send({
        error: 'No passport on record for this battery. Resolve a passport first.',
      });
    }

    try {
      // Identity checks: match passport fields against battery record
      const passportMatchesSerial = passport.passportUniqueId.includes(battery.serialNumber);
      const passportMatchesVin    = !passport.batteryCategory || !battery.vin || passport.manufacturerName != null;
      const passportMatchesModel  = passport.manufacturerName != null;

      // Cell → pack → vehicle chain: available only in restricted tier
      const cellPackChainValid    = passport.tierAccess !== 'PUBLIC' && passport.fullChargeCapacityAh != null;
      const packVehicleChainValid = battery.vin != null && cellPackChainValid;

      const identityChainValid =
        passportMatchesSerial &&
        passportMatchesVin    &&
        passportMatchesModel;

      const discrepancies: string[] = [];
      if (!passportMatchesSerial) discrepancies.push('Passport unique ID does not contain battery serial');
      if (!passportMatchesVin)    discrepancies.push('VIN not verifiable from passport data');
      if (!cellPackChainValid)    discrepancies.push('Cell-to-pack chain: restricted tier required');
      if (!packVehicleChainValid) discrepancies.push('Pack-to-vehicle chain: VIN not linked');

      const confidenceScore =
        (passportMatchesSerial ? 0.40 : 0) +
        (passportMatchesModel  ? 0.20 : 0) +
        (passportMatchesVin    ? 0.15 : 0) +
        (cellPackChainValid    ? 0.15 : 0) +
        (packVehicleChainValid ? 0.10 : 0);

      const verification = await prisma.passportVerification.upsert({
        where: { passportId: passport.id },
        update: {
          verifiedAt:            new Date(),
          verificationMethod:    req.body?.verificationMethod ?? 'API_LOOKUP',
          passportMatchesSerial,
          passportMatchesVin,
          passportMatchesModel,
          cellPackChainValid,
          packVehicleChainValid,
          identityChainValid,
          confidenceScore:       Math.round(confidenceScore * 100) / 100,
          discrepancies,
          verifiedByLenderId:    req.body?.lenderId ?? null,
        },
        create: {
          passportId:            passport.id,
          batteryId:             battery.id,
          verifiedAt:            new Date(),
          verificationMethod:    req.body?.verificationMethod ?? 'API_LOOKUP',
          passportMatchesSerial,
          passportMatchesVin,
          passportMatchesModel,
          cellPackChainValid,
          packVehicleChainValid,
          identityChainValid,
          confidenceScore:       Math.round(confidenceScore * 100) / 100,
          discrepancies,
          verifiedByLenderId:    req.body?.lenderId ?? null,
        },
      });

      // Mark passport as verified if identity chain passed
      if (identityChainValid) {
        await prisma.batteryPassport.update({
          where: { id: passport.id },
          data:  { isVerified: true },
        });
      }

      return reply.status(201).send({
        verificationId:       verification.id,
        passportId:           passport.id,
        batteryId:            battery.id,
        identityChainValid,
        confidenceScore:      verification.confidenceScore,
        passportMatchesSerial,
        passportMatchesVin,
        passportMatchesModel,
        cellPackChainValid,
        packVehicleChainValid,
        discrepancies,
        verifiedAt:           verification.verifiedAt,
      });
    } catch (err) {
      return serverError(reply, err);
    }
  });
}

function formatPassport(passport: any) {
  return {
    id:                   passport.id,
    batteryId:            passport.batteryId,
    passportUniqueId:     passport.passportUniqueId,
    passportQrUrl:        passport.passportQrUrl,
    dataExchangeFramework: passport.dataExchangeFramework,
    tierAccess:           passport.tierAccess,
    isVerified:           passport.isVerified,
    lastSyncedAt:         passport.lastSyncedAt,
    issuedAt:             passport.issuedAt,
    expiresAt:            passport.expiresAt,

    // Public tier
    public: {
      batteryCategory:       passport.batteryCategory,
      manufacturerName:      passport.manufacturerName,
      manufacturingDate:     passport.manufacturingDate,
      manufacturingLocation: passport.manufacturingLocation,
      carbonFootprintKgCo2e: passport.carbonFootprintKgCo2e,
      carbonIntensityClass:  passport.carbonIntensityClass,
      recycledContentPct:    passport.recycledContentPct,
      composition: {
        cobaltPct:    passport.cobaltPct,
        lithiumPct:   passport.lithiumPct,
        nickelPct:    passport.nickelPct,
        manganesePct: passport.manganesePct,
      },
      performance: {
        ratedCapacityAh:       passport.ratedCapacityAh,
        energyDensityWhKg:     passport.energyDensityWhKg,
        powerDensityWKg:       passport.powerDensityWKg,
        expectedLifetimeCycles: passport.expectedLifetimeCycles,
        temperatureRangeMin:   passport.temperatureRangeMin,
        temperatureRangeMax:   passport.temperatureRangeMax,
      },
      circularity: {
        recycledCobaltPct:  passport.recycledCobaltPct,
        recycledLithiumPct: passport.recycledLithiumPct,
        recycledNickelPct:  passport.recycledNickelPct,
        eolGuidanceText:    passport.eolGuidanceText,
      },
    },

    // Restricted tier (null values if not authorized)
    restricted: passport.tierAccess !== 'PUBLIC' ? {
      unitSoH:              passport.unitSoH,
      unitSoC:              passport.unitSoC,
      chargeCycleCount:     passport.chargeCycleCount,
      fullChargeCapacityAh: passport.fullChargeCapacityAh,
      remainingCapacityAh:  passport.remainingCapacityAh,
      tempHistoryMin:       passport.tempHistoryMin,
      tempHistoryMax:       passport.tempHistoryMax,
      tempHistoryAvg:       passport.tempHistoryAvg,
      batteryStatusCode:    passport.batteryStatusCode,
      negativeEvents:       passport.negativeEvents ?? [],
    } : null,

    verification: passport.verification ? {
      identityChainValid:   passport.verification.identityChainValid,
      confidenceScore:      passport.verification.confidenceScore,
      discrepancies:        passport.verification.discrepancies,
      verifiedAt:           passport.verification.verifiedAt,
    } : null,
  };
}
