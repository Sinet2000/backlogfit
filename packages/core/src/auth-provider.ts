/**
 * Phase 2 design (ADR-0010): pluggable sign-in for self-hosted deployments (OIDC/SSO).
 *
 * Not wired into v1: HelloSchema has no `auth` field yet and the reducer ignores identities.
 * The interface is what the Node server will implement; the claim checks and the group → role
 * mapping are pure and live here so every provider applies the same policy. Signature
 * verification (JWKS, RS256/ES256 via WebCrypto) is the provider's job, before these checks.
 */
import * as v from 'valibot';
import { NAME_MAX } from './schemas.ts';
import type { Authority } from './state.ts';
import { cleanText, hasUnsafeChars, hasVisibleChar } from './text.ts';

export const ID_TOKEN_MAX = 8192;
export const GROUPS_MAX = 200;

/** Reserved shape of `hello.auth` (Phase 2). The token is verified, then discarded. */
export const OidcCredentialSchema = v.strictObject({
  kind: v.literal('oidc'),
  idToken: v.pipe(
    v.string(),
    v.maxLength(ID_TOKEN_MAX),
    v.regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  ),
});
export type OidcCredential = v.InferOutput<typeof OidcCredentialSchema>;
export type AuthCredential = OidcCredential;

/**
 * Group claim → room authority. `admin` is never granted by a group: it stays bound to the
 * room's admin secret (the room owner). Facilitator groups become co-admins.
 */
export interface RoleMapping {
  /** Members become co-admins in every room they join. */
  facilitatorGroups?: readonly string[];
  /** If set, only members of these (or facilitator) groups may join at all. */
  allowedGroups?: readonly string[] | null;
}

/** What a provider hands to the room after successful verification. Nothing else is kept. */
export interface VerifiedIdentity {
  /** Display name derived from claims (cleaned, ≤ NAME_MAX). Replaces the typed name. */
  name: string;
  authority: Exclude<Authority, 'admin'>;
}

export type AuthFailure =
  | 'invalid_token'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'expired'
  | 'not_yet_valid'
  | 'too_old'
  | 'nonce_mismatch'
  | 'no_name'
  | 'not_allowed';

export type AuthVerdict =
  | { ok: true; identity: VerifiedIdentity }
  | { ok: false; reason: AuthFailure };

export interface AuthContext {
  /** Epoch ms, from the adapter's clock. */
  now: number;
  roomId: string;
}

/**
 * Implemented by the self-hosted server (e.g. an OIDC provider with an in-memory JWKS cache).
 * Must not persist or log the credential. Must not throw for bad tokens; return a verdict.
 */
export interface AuthProvider {
  readonly id: string;
  verify(credential: AuthCredential, ctx: AuthContext): Promise<AuthVerdict>;
}

export interface OidcClaimsPolicy {
  issuer: string;
  /** This deployment's OIDC client id. */
  audience: string;
  clockSkewSeconds?: number;
  /** Reject tokens issued longer ago than this (default 600 s). */
  maxAgeSeconds?: number;
  nonce?: string;
  /** Claims tried in order for the display name. Default: name, preferred_username. */
  nameClaims?: readonly string[];
  /** Claim holding group names (default `groups`). */
  groupsClaim?: string;
  roles?: RoleMapping;
}

const DEFAULT_NAME_CLAIMS = ['name', 'preferred_username'] as const;

/** First usable name claim: string, NFC-trimmed, no unsafe characters, cut to NAME_MAX. */
export function displayNameFromClaims(
  claims: Readonly<Record<string, unknown>>,
  nameClaims: readonly string[] = DEFAULT_NAME_CLAIMS,
): string | null {
  for (const c of nameClaims) {
    const raw = claims[c];
    if (typeof raw !== 'string') continue;
    const s = cleanText(raw);
    if (s === '' || hasUnsafeChars(s) || !hasVisibleChar(s)) continue;
    return [...s].slice(0, NAME_MAX).join('').trim();
  }
  return null;
}

/** null = not allowed to join. */
export function authorityFromGroups(
  groups: readonly string[],
  roles: RoleMapping = {},
): VerifiedIdentity['authority'] | null {
  const has = (list: readonly string[] | null | undefined) =>
    list?.some((g) => groups.includes(g)) === true;
  if (has(roles.facilitatorGroups)) return 'coadmin';
  if (roles.allowedGroups != null && !has(roles.allowedGroups)) return null;
  return 'none';
}

function groupsOf(claims: Readonly<Record<string, unknown>>, claim: string): string[] {
  const raw = claims[claim];
  if (!Array.isArray(raw)) return [];
  return raw.filter((g): g is string => typeof g === 'string').slice(0, GROUPS_MAX);
}

/**
 * Check the payload of an already signature-verified ID token against the policy and map it to
 * an identity. Pure: time comes from `now` (epoch ms).
 */
export function evaluateIdTokenClaims(
  claims: unknown,
  policy: OidcClaimsPolicy,
  now: number,
): AuthVerdict {
  if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) {
    return { ok: false, reason: 'invalid_token' };
  }
  const c = claims as Record<string, unknown>;
  const fail = (reason: AuthFailure): AuthVerdict => ({ ok: false, reason });
  const t = now / 1000;
  const skew = policy.clockSkewSeconds ?? 60;

  if (typeof c.sub !== 'string' || c.sub === '' || typeof c.exp !== 'number') {
    return fail('invalid_token');
  }
  if (c.iss !== policy.issuer) return fail('wrong_issuer');
  const aud = typeof c.aud === 'string' ? [c.aud] : Array.isArray(c.aud) ? c.aud : [];
  if (!aud.includes(policy.audience)) return fail('wrong_audience');
  if (aud.length > 1 && c.azp !== policy.audience) return fail('wrong_audience');
  if (c.exp + skew <= t) return fail('expired');
  if (typeof c.nbf === 'number' && c.nbf - skew > t) return fail('not_yet_valid');
  if (typeof c.iat !== 'number' || c.iat - skew > t) return fail('invalid_token');
  if (c.iat + (policy.maxAgeSeconds ?? 600) + skew < t) return fail('too_old');
  if (policy.nonce !== undefined && c.nonce !== policy.nonce) return fail('nonce_mismatch');

  const name = displayNameFromClaims(c, policy.nameClaims);
  if (name === null) return fail('no_name');
  const authority = authorityFromGroups(groupsOf(c, policy.groupsClaim ?? 'groups'), policy.roles);
  if (authority === null) return fail('not_allowed');
  return { ok: true, identity: { name, authority } };
}
