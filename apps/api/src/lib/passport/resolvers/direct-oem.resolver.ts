/**
 * Direct OEM API Resolver — STUB
 *
 * Some manufacturers (Tesla, Rivian, BMW) expose proprietary REST APIs
 * for battery data. This resolver calls an OEM-specific endpoint directly
 * using a pre-negotiated API key / OAuth2 credential.
 *
 * This is the highest-fidelity path for restricted-tier data because OEM
 * APIs often expose real-time SoH, cycle history, and fault logs — not just
 * the passport snapshot.
 *
 * Integration path (per OEM):
 *   1. Sign data-sharing agreement with OEM
 *   2. Obtain OAuth2 client credentials / API key
 *   3. Map OEM-specific battery identifier (e.g. Tesla pack ID) to serial
 *   4. Call OEM endpoint, handle pagination and auth token refresh
 *   5. Map proprietary response → RawPassportData
 *
 * Config: set OEM_API_KEYS env var as JSON object: { "TESLA": "key", "BMW": "key" }
 *
 * TODO: Implement per-OEM adapters as data-sharing agreements are signed.
 */

import type {
  PassportResolver,
  PassportResolveResult,
  ResolveOptions,
} from '@voltledger/types';
import { generatePassportForScenario } from '../scenario-generator';

const SUPPORTED_OEMS = ['TESLA', 'BMW', 'RIVIAN', 'RIVN'] as const;

export class DirectOemPassportResolver implements PassportResolver {
  readonly framework = 'DIRECT_OEM' as const;

  canHandle(identifier: string): boolean {
    const upper = identifier.toUpperCase();
    return SUPPORTED_OEMS.some(oem => upper.includes(oem));
  }

  async resolve(
    identifier: string,
    _options?: ResolveOptions,
  ): Promise<PassportResolveResult> {
    // WS-F: demo/test-only — a forced scenario produces a realistic, framework-tagged
    // payload via the shared generator without real per-OEM integration existing.
    if (_options?.forceScenario) {
      return generatePassportForScenario(identifier, 'DIRECT_OEM', _options);
    }

    // STUB — not yet implemented
    // When implementing: switch on OEM prefix, use per-OEM adapter
    // e.g. TeslaOemAdapter, BmwOemAdapter, RivianOemAdapter

    return {
      success:    false,
      error:      `Direct OEM resolver not yet implemented. Identifier: ${identifier}`,
      tierAccess: 'PUBLIC',
      resolvedAt: new Date(),
      framework:  'DIRECT_OEM',
      latencyMs:  0,
    };
  }
}
