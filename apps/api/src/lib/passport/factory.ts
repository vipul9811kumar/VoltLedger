/**
 * Passport Resolver Factory
 *
 * Returns the best available resolver for an identifier, in priority order:
 *   1. Catena-X  (if identifier matches BPN/DPP format)
 *   2. GS1       (if identifier is a 30PPID / GS1 Digital Link)
 *   3. Direct OEM (if identifier includes a known OEM prefix with live credentials)
 *   4. Aggregator (if AGGREGATOR_API_URL + AGGREGATOR_API_KEY are set)
 *   5. Mock      (always available — dev/demo fallback)
 *
 * In production, set PASSPORT_RESOLVER=catena_x|gs1|direct_oem|aggregator|mock
 * to force a specific resolver. Omit to use auto-detection.
 */

import type { PassportResolver, ResolveOptions, PassportResolveResult } from '@voltledger/types';
import { MockPassportResolver }       from './mock.resolver';
import { CatenaXPassportResolver }    from './resolvers/catena-x.resolver';
import { GS1PassportResolver }        from './resolvers/gs1.resolver';
import { DirectOemPassportResolver }  from './resolvers/direct-oem.resolver';
import { AggregatorPassportResolver } from './resolvers/aggregator.resolver';

const allResolvers: PassportResolver[] = [
  new CatenaXPassportResolver(),
  new GS1PassportResolver(),
  new DirectOemPassportResolver(),
  new AggregatorPassportResolver(),
  new MockPassportResolver(),
];

export function getResolver(identifier: string): PassportResolver {
  const forced = process.env.PASSPORT_RESOLVER?.toLowerCase();

  if (forced) {
    const map: Record<string, PassportResolver> = {
      catena_x:   allResolvers[0],
      gs1:        allResolvers[1],
      direct_oem: allResolvers[2],
      aggregator: allResolvers[3],
      mock:       allResolvers[4],
    };
    const explicit = map[forced];
    if (explicit) return explicit;
  }

  // Auto-detect: first resolver that claims it can handle the identifier
  const matched = allResolvers.find(r => r.canHandle(identifier));
  return matched ?? allResolvers[4]; // always fall through to mock
}

/** Convenience: resolve using auto-detected resolver */
export async function resolvePassport(
  identifier: string,
  options?: ResolveOptions,
): Promise<PassportResolveResult & { resolverUsed: string }> {
  const resolver = getResolver(identifier);
  const result   = await resolver.resolve(identifier, options);
  return { ...result, resolverUsed: resolver.framework };
}
