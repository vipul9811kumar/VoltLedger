/**
 * Mock Passport Resolver
 *
 * Generates realistic EU Battery Passport data from a battery's serial number
 * and any known telemetry context. Used for demos and local dev.
 *
 * Coverage model (mirrors real-world ramp), and scenario-forcing for WS-F's coverage-matrix
 * proof, both live in scenario-generator.ts — this class is a thin wrapper over it:
 *   - 60% of batteries get a passport (post-2027 originations)
 *   - Of those: 70% public tier only, 30% restricted tier
 *   - Restricted-tier SoH is consistent with telemetry (±3% noise)
 */

import type { PassportResolver, PassportResolveResult, ResolveOptions } from '@voltledger/types';
import { generatePassportForScenario, r } from './scenario-generator';

export class MockPassportResolver implements PassportResolver {
  readonly framework = 'MOCK' as const;

  canHandle(_identifier: string): boolean {
    return true; // mock handles everything
  }

  async resolve(
    identifier: string,
    options?: ResolveOptions,
  ): Promise<PassportResolveResult> {
    // Simulate latency (kept here, not in the shared generator, since real resolvers will
    // have their own genuinely-variable network latency once implemented). Seeded, matching
    // the original resolver's determinism — same identifier always yields the same latency.
    await new Promise(res => setTimeout(res, 40 + Math.floor(r(identifier, 0, 0, 60))));
    return generatePassportForScenario(identifier, 'MOCK', options);
  }
}
