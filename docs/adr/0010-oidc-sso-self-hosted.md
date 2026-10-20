# ADR-0010: OIDC/SSO sign-in for self-hosted deployments (Phase 2 design)

- Status: Accepted (design; implementation in Phase 2)
- Date: 2026-10-20

## Context

Companies self-hosting Backlogfit want only employees to join rooms, with real names from their
identity provider and facilitator rights for agile coaches, without adding accounts, sessions
or a user database. The hosted service stays anonymous; this is a self-hosted option.

## Decision

- **Pluggable `AuthProvider`** (core interface): `verify(credential, { now, roomId }) →
  Promise<AuthVerdict>`. The Node server ships an OIDC implementation; others (e.g. trusted
  reverse-proxy headers) can be added without touching the reducer. Providers never throw for
  bad tokens; they return `{ ok: false, reason }`.
- **ID token verified server-side.** The browser runs the OIDC authorization code flow with
  PKCE against the IdP and sends the ID token once, in the first WebSocket frame, as the
  reserved `hello.auth: { kind: 'oidc', idToken }` (`OidcCredentialSchema`, ≤ 8 KiB). Never in
  a URL. The provider verifies the signature (JWKS from the issuer's discovery document, cached
  in memory, RS256/ES256 via WebCrypto, `alg: none` and HMAC rejected), then applies the pure
  claim policy `evaluateIdTokenClaims`: `iss`, `aud` (+ `azp` when several audiences), `exp`,
  `nbf`, `iat` with clock skew, maximum token age (default 10 min), optional `nonce`.
- **Name claims.** The display name comes from the first usable claim in `nameClaims` (default
  `name`, then `preferred_username`), cleaned like any display name and cut to 40 characters.
  `email` is not used by default (more personal than needed). The typed name is ignored.
- **Role mapping by group claim** (`groupsClaim`, default `groups`):
  `facilitatorGroups` → co-admin in every room joined; `allowedGroups` (optional) → only these
  groups may join at all (`not_allowed` otherwise). **Admin is never granted by a group**: it
  stays bound to the room's admin secret, i.e. the person who created the room. A group-wide
  admin could close or reconfigure every colleague's room, which is more power than any
  facilitator needs.
- **No tokens stored.** The token is verified and discarded in the same call. Only the
  resulting `{ name, authority }` reaches the reducer (through `HelloAuth`, in the spirit of
  ADR-0005). No `sub`, email, groups or token is written to room state, storage or logs. Resume
  keeps using the per-room resume token, so reconnects do not need a fresh ID token.
- Configuration via env: `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_NAME_CLAIMS`,
  `OIDC_GROUPS_CLAIM`, `OIDC_FACILITATOR_GROUPS`, `OIDC_ALLOWED_GROUPS`. When `OIDC_ISSUER` is
  unset, behaviour is exactly v1.

## Consequences

- Core exports `AuthProvider`, `AuthCredential`, `OidcCredentialSchema`, `VerifiedIdentity`,
  `AuthVerdict`, `OidcClaimsPolicy`, `RoleMapping`, `evaluateIdTokenClaims`,
  `displayNameFromClaims`, `authorityFromGroups`. Nothing is wired into v1.
- Phase 2 protocol changes (additive): optional `hello.auth`, optional `HelloAuth.identity`
  (`VerifiedIdentity`), and a room flag `requireSso` so rooms on an SSO deployment refuse
  anonymous joins. The reducer then uses `identity.name` and raises authority to `coadmin`
  where mapped.
- The CSP `connect-src` must include the IdP token endpoint on SSO deployments (configured by the
  operator).
- A compromised IdP can mint participants and co-admins, but not room admins.
