/**
 * Third-Party Aggregator Resolver — STUB
 *
 * Aggregators (Minviro, Circulor, Circularity First, Battery Pass Consortium)
 * normalise passport data from multiple OEMs and data-exchange frameworks
 * into a single API. This simplifies integration at the cost of being
 * dependent on a third party.
 *
 * Aggregators are useful when:
 *   - OEM coverage spans many manufacturers (Catena-X + GS1 + direct)
 *   - You don't want to manage per-OEM OAuth flows
 *   - Real-time data is less critical than breadth of coverage
 *
 * Integration path:
 *   1. Sign aggregator service agreement
 *   2. Obtain aggregator API key
 *   3. GET /v1/passports/{identifier} → normalised DPP JSON
 *   4. Map → RawPassportData
 *
 * Config: AGGREGATOR_API_URL and AGGREGATOR_API_KEY env vars
 *
 * TODO: Evaluate aggregator vendors once pilot lenders are onboarded.
 */

import type {
  PassportResolver,
  PassportResolveResult,
  ResolveOptions,
} from '@voltledger/types';
import { generatePassportForScenario } from '../scenario-generator';

export class AggregatorPassportResolver implements PassportResolver {
  readonly framework = 'THIRD_PARTY_AGGREGATOR' as const;

  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl = process.env.AGGREGATOR_API_URL ?? '';
    this.apiKey  = process.env.AGGREGATOR_API_KEY  ?? '';
  }

  canHandle(_identifier: string): boolean {
    // Aggregator is a universal fallback — handles any identifier format
    return Boolean(this.apiUrl && this.apiKey);
  }

  async resolve(
    identifier: string,
    _options?: ResolveOptions,
  ): Promise<PassportResolveResult> {
    // WS-F: demo/test-only — a forced scenario produces a realistic, framework-tagged
    // payload via the shared generator without a real aggregator integration existing.
    if (_options?.forceScenario) {
      return generatePassportForScenario(identifier, 'THIRD_PARTY_AGGREGATOR', _options);
    }

    // STUB — not yet implemented
    // Real implementation:
    //   const res = await fetch(`${this.apiUrl}/v1/passports/${encodeURIComponent(identifier)}`, {
    //     headers: { Authorization: `Bearer ${this.apiKey}` },
    //   });
    //   const body = await res.json();
    //   return mapAggregatorResponse(body);

    return {
      success:    false,
      error:      `Aggregator resolver not yet implemented. Identifier: ${identifier}`,
      tierAccess: 'PUBLIC',
      resolvedAt: new Date(),
      framework:  'THIRD_PARTY_AGGREGATOR',
      latencyMs:  0,
    };
  }
}
