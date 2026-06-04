/**
 * Origination Audit routes
 *
 * POST /v1/origination/attest   — create an evidence-locked origination audit at loan creation
 * GET  /v1/origination/:id       — retrieve a specific audit record
 * GET  /v1/origination/battery/:serial — list all audits for a battery
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound, serverError } from '../lib/errors';
import type { OriginationEvidenceSnapshot } from '@voltledger/types';

export async function originationRoutes(app: FastifyInstance) {

  // POST /v1/origination/attest
  // Creates a frozen evidence record at loan origination.
  // Called by the lender portal at the moment of loan decision.
  app.post<{
    Body: {
      batterySerial: string;
      lenderId?: string;
      loanId?: string;
      vehicleValueUsd?: number;
    };
  }>('/attest', async (req, reply) => {
    const { batterySerial, lenderId, loanId, vehicleValueUsd = 35_000 } = req.body ?? {};

    if (!batterySerial) {
      return reply.status(400).send({ error: 'batterySerial is required' });
    }

    try {
      const battery = await prisma.battery.findUnique({
        where: { serialNumber: batterySerial },
        include: {
          batteryModel:    true,
          batteryPassport: { include: { verification: true } },
          riskScores:      { orderBy: { scoredAt: 'desc' }, take: 1 },
          residualValues:  { orderBy: { estimatedAt: 'desc' }, take: 1 },
          ltvRecommendations: { orderBy: { recommendedAt: 'desc' }, take: 1 },
        },
      });

      if (!battery) return notFound(reply, `Battery ${batterySerial} not found`);

      const passport  = battery.batteryPassport;
      const riskScore = battery.riskScores[0];
      const rv        = battery.residualValues[0];
      const ltv       = battery.ltvRecommendations[0];

      // Determine SoH source for this origination
      let sohSource: string;
      let sohUsedPct: number | null = null;

      if (riskScore) {
        sohSource  = riskScore.sohSource;
        // Use the SoH that was actually used in scoring
        const latestTelemetry = await prisma.batteryTelemetryPoint.findFirst({
          where:   { batteryId: battery.id },
          orderBy: { recordedAt: 'desc' },
        });
        sohUsedPct = latestTelemetry?.stateOfHealth ?? null;
        if (passport?.unitSoH && sohSource !== 'TELEMETRY') {
          sohUsedPct = passport.unitSoH;
        }
      } else {
        sohSource = 'NONE';
      }

      // Build the frozen evidence snapshot
      const evidenceSnapshot: OriginationEvidenceSnapshot = {
        capturedAt:         new Date().toISOString(),
        batterySerial:      battery.serialNumber,
        vin:                battery.vin,
        chemistry:          battery.chemistry,
        nominalCapacityKwh: battery.nominalCapacityKwh,

        sohSource:          sohSource as any,
        sohUsedPct:         sohUsedPct ?? 0,

        passportPresent:    !!passport,
        passportUniqueId:   passport?.passportUniqueId,
        passportTier:       (passport?.tierAccess as any) ?? null,
        passportVerified:   passport?.isVerified ?? false,

        // Freeze the public passport fields at origination
        passportFields: passport ? {
          carbonFootprintKgCo2e: passport.carbonFootprintKgCo2e ?? undefined,
          carbonIntensityClass:  passport.carbonIntensityClass ?? undefined,
          recycledContentPct:    passport.recycledContentPct ?? undefined,
          unitSoH:               passport.unitSoH ?? undefined,
          chargeCycleCount:      passport.chargeCycleCount ?? undefined,
          batteryStatusCode:     (passport.batteryStatusCode as any) ?? undefined,
          negativeEvents:        (passport.negativeEvents as any) ?? undefined,
        } : undefined,

        riskScore: riskScore ? {
          compositeScore:  riskScore.compositeScore,
          grade:           riskScore.grade,
          confidenceLevel: riskScore.confidenceLevel,
        } : undefined,
      };

      // Build lender-facing attestation text
      const passportLine = passport
        ? `EU Battery Passport (${passport.tierAccess} tier${passport.isVerified ? ', identity verified' : ''}) checked at origination. Passport ID: ${passport.passportUniqueId}.`
        : 'No EU Battery Passport on record for this asset at origination.';

      const scoreLine = riskScore
        ? `Risk assessment: grade ${riskScore.grade}, composite score ${riskScore.compositeScore}/1000. SoH source: ${sohSource}${sohUsedPct != null ? ` (${sohUsedPct.toFixed(1)}%)` : ''}.`
        : 'No risk score on record at origination.';

      const attestationText = [
        `VoltLedger Origination Attestation`,
        `Battery: ${batterySerial} | ${battery.chemistry} | ${battery.nominalCapacityKwh} kWh`,
        `VIN: ${battery.vin ?? 'not linked'}`,
        passportLine,
        scoreLine,
        rv ? `Residual value estimate: $${rv.batteryResidualValueUsd.toFixed(0)} USD (${Math.round(rv.batteryValuePctOfVehicle * 100)}% of vehicle value).` : '',
        ltv ? `Recommended LTV: ${ltv.recommendedLtvPct.toFixed(1)}% | Risk premium: ${ltv.riskPremiumBps}bps.` : '',
        `This attestation captures the data state at the time of origination. VoltLedger verifies passport data on behalf of the lender but does not assume regulatory compliance obligations.`,
        `Generated: ${new Date().toISOString()}`,
      ].filter(Boolean).join('\n');

      const audit = await prisma.originationAudit.create({
        data: {
          batteryId:                  battery.id,
          loanId:                     loanId ?? null,
          passportId:                 passport?.id ?? null,
          lenderId:                   lenderId ?? null,
          checkedAt:                  new Date(),
          passportTierAccessed:       (passport?.tierAccess as string) ?? null,
          passportVerifiedAtCheck:    passport?.isVerified ?? false,
          sohSource,
          sohUsedPct,
          compositeScoreAtOrigination: riskScore?.compositeScore ?? null,
          riskGradeAtOrigination:     riskScore?.grade ?? null,
          evidenceSnapshot:           evidenceSnapshot as any,
          attestationText,
          attestationVersion:         '1.0',
        },
      });

      return reply.status(201).send({
        auditId:          audit.id,
        batteryId:        battery.id,
        batterySerial,
        passportPresent:  !!passport,
        passportTier:     passport?.tierAccess ?? null,
        passportVerified: passport?.isVerified ?? false,
        sohSource,
        sohUsedPct,
        compositeScore:   riskScore?.compositeScore ?? null,
        riskGrade:        riskScore?.grade ?? null,
        attestationText,
        checkedAt:        audit.checkedAt,
      });
    } catch (err) {
      return serverError(reply, err);
    }
  });

  // GET /v1/origination/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const audit = await prisma.originationAudit.findUnique({
      where: { id: req.params.id },
      include: {
        battery:  { select: { serialNumber: true, chemistry: true } },
        passport: { select: { passportUniqueId: true, tierAccess: true, isVerified: true } },
      },
    });
    if (!audit) return notFound(reply, `Origination audit ${req.params.id} not found`);
    return audit;
  });

  // GET /v1/origination/battery/:serial — audit history for a battery
  app.get<{ Params: { serial: string } }>('/battery/:serial', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
    });
    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const audits = await prisma.originationAudit.findMany({
      where:   { batteryId: battery.id },
      orderBy: { checkedAt: 'desc' },
      select: {
        id:                          true,
        checkedAt:                   true,
        passportTierAccessed:        true,
        passportVerifiedAtCheck:     true,
        sohSource:                   true,
        sohUsedPct:                  true,
        compositeScoreAtOrigination: true,
        riskGradeAtOrigination:      true,
        attestationVersion:          true,
      },
    });

    return { batteryId: battery.id, serial: req.params.serial, audits };
  });
}
