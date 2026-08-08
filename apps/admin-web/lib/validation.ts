import { z } from 'zod';

/**
 * An id as Postgres defines it, not as RFC 4122 does.
 *
 * zod's `.uuid()` enforces the RFC version and variant nibbles (`[1-8]` in the
 * third group, `[89ab]` in the fourth). Postgres' `uuid` type does not: it
 * accepts any 8-4-4-4-12 hex string, and this database is full of hand-written
 * fixture ids that exercise that — `b2000000-0000-0000-0000-000000000001` for a
 * restaurant, `a0000000-…` for the org, `fc200000-…` for a food court. Every
 * restaurant, both food courts, the organization and most menu items are
 * shaped that way, so `.uuid()` rejected ids the database considers perfectly
 * valid and that RLS is happy to match on.
 *
 * The failure modes were split and both bad: Server Actions threw a raw
 * ZodError ("Invalid UUID") on ids straight out of our own tables, while
 * lib/filters silently dropped them, so restaurant/org/food-court filters
 * quietly matched nothing instead of erroring.
 *
 * `z.guid()` is the format-agnostic 8-4-4-4-12 check, which is exactly the
 * contract Postgres offers. Use this everywhere an id crosses a boundary;
 * reserve `.uuid()` for values we generate ourselves and want RFC-shaped.
 */
export const dbId = z.guid();
