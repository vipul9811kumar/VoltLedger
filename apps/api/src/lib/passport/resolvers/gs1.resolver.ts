/**
 * GS1 Digital Link Passport Resolver — STUB
 *
 * GS1 Digital Link (ISO/IEC 18975) resolves a battery's QR code URL to
 * machine-readable passport data via the GS1 resolver network. Many battery
 * manufacturers (especially Asian OEMs — CATL, BYD, Samsung SDI) publish
 * Digital Product Passports through GS1 infrastructure.
 *
 * Identifier format:
 *   GS1 Digital Link URL:  https://id.gs1.org/01/{GTIN}/21/{serialNumber}
 *   ISO/IEC 15459 PPID:    30PPID/{serialNumber}
 *
 * Integration path:
 *   1. Resolve the GS1 Digital Link URL via the GS1 Resolver (id.gs1.org)
 *   2. Follow linkType=gs1:digitalPassport link relation
 *   3. Fetch the Digital Product Pass JSON from the resolved endpoint
 *   4. Map to RawPassportData
 *
 * Spec reference: https://www.gs1.org/standards/gs1-digital-link
 *
 * TODO: Implement once GTIN / GS1 company prefix is obtained.
 */

import type {
  PassportResolver,
  PassportResolveResult,
  ResolveOptions,
} from '@voltledger/types';

const GS1_RESOLVER_BASE = 'https://id.gs1.org';

export class GS1PassportResolver implements PassportResolver {
  readonly framework = 'GS1' as const;

  canHandle(identifier: string): boolean {
    // GS1 Digital Link URLs or 30PPID-format ISO 15459 identifiers
    return (
      identifier.startsWith('https://id.gs1.org') ||
      identifier.startsWith('30PPID/') ||
      identifier.startsWith('01/') ||
      /^\d{14}/.test(identifier) // starts with a 14-digit GTIN
    );
  }

  async resolve(
    identifier: string,
    _options?: ResolveOptions,
  ): Promise<PassportResolveResult> {
    // STUB — not yet implemented
    // Real implementation steps:
    //   1. Build GS1 Digital Link URL from identifier
    //      e.g. https://id.gs1.org/01/{gtin}/21/{serial}
    //   2. GET URL with Accept: application/json + linkType=gs1:digitalPassport
    //   3. Follow the returned link to the DPP endpoint
    //   4. Parse W3C Verifiable Credential or plain JSON payload
    //   5. Verify digital signature (optional but recommended)
    //   6. Map to RawPassportData

    void GS1_RESOLVER_BASE; // will be used when implemented

    return {
      success:    false,
      error:      `GS1 resolver not yet implemented. Identifier: ${identifier}`,
      tierAccess: 'PUBLIC',
      resolvedAt: new Date(),
      framework:  'GS1',
      latencyMs:  0,
    };
  }
}
