# SSO — Identity Today and the Okta / Entra ID Path

How authentication works now, and the exact steps to add an enterprise IdP.
The provider seam is `src/lib/auth.ts` — the `providers` array is built
dynamically (Google pushes at the `if (hasGoogle)` block, line ~65), so adding
an OIDC provider is an append, not a rewrite. Last updated: July 2026.

## Identity today

- **Google Workspace OIDC** when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are
  set; `hd` is passed as a UI hint but domain restriction is enforced
  **server-side** in the `signIn` callback via `emailAllowed()` (allowlist from
  `ALLOWED_EMAIL_DOMAINS`, default `mytra.ai`), including an
  `email_verified === true` check.
- **JWT sessions**, 12-hour max age (`session: { strategy: 'jwt' }`).
- **Roles** resolve server-side per request from env allowlists
  (`src/lib/roles.ts`: `ADMIN_EMAILS` → admin, `EHS_EMAILS` → ehs, else
  worker) and are exposed as `session.user.role` + `session.user.isAdmin`.
- **Dev/worker fallbacks**: zero-config dev Credentials login outside
  production; a shared `EMAIL_LOGIN_CODE` path that can only mint **worker**
  sessions in production (see *Identity assurance* below).

## Adding Okta

1. Okta Admin → Applications → Create App Integration → **OIDC, Web
   Application**. Sign-in redirect URI:
   `https://<your-domain>/api/auth/callback/okta`
2. Set env vars on Vercel: `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`,
   `OKTA_ISSUER` (e.g. `https://acme.okta.com/oauth2/default`).
3. In `src/lib/auth.ts`, next to the `if (hasGoogle)` block (line ~65):

   ```ts
   import Okta from 'next-auth/providers/okta'

   const hasOkta = !!(process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER)
   if (hasOkta) {
     providers.push(
       Okta({
         clientId: process.env.OKTA_CLIENT_ID!,
         clientSecret: process.env.OKTA_CLIENT_SECRET!,
         issuer: process.env.OKTA_ISSUER!,
       })
     )
   }
   ```

4. Extend the `signIn` callback's provider check so Okta profiles pass through
   the same `emailAllowed()` gate Google uses (match on
   `account?.provider === 'okta'`).

## Adding Microsoft Entra ID (Azure AD)

1. Entra admin center → App registrations → New registration. Redirect URI
   (Web): `https://<your-domain>/api/auth/callback/azure-ad`
2. Env vars: `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID`.
3. Same insertion point in `src/lib/auth.ts`:

   ```ts
   import AzureAD from 'next-auth/providers/azure-ad'

   const hasEntra = !!(process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET && process.env.ENTRA_TENANT_ID)
   if (hasEntra) {
     providers.push(
       AzureAD({
         clientId: process.env.ENTRA_CLIENT_ID!,
         clientSecret: process.env.ENTRA_CLIENT_SECRET!,
         tenantId: process.env.ENTRA_TENANT_ID!,
       })
     )
   }
   ```

4. Same `signIn`-callback treatment (`account?.provider === 'azure-ad'`).

## What keeps applying regardless of IdP

`emailAllowed()` (domain allowlist), `isAdmin()` / `resolveRole()` (role
allowlists), the 12-hour JWT session, and the audit trail all operate on the
**email the IdP asserts** — so swapping or adding providers changes who vouches
for the mailbox, not any authorization logic. No callers outside
`src/lib/auth.ts` change.

## Identity assurance decisions (July 2026)

- **Shared email-code logins are worker-only in production.** `EMAIL_LOGIN_CODE`
  is a single shared secret, so it cannot prove WHICH person is signing in.
  `src/lib/auth.ts` refuses to mint `admin`/`ehs` sessions from it in
  production (`resolveRole(email) !== 'worker'` → rejected, logged as
  `code-login-blocked-elevated`). Elevated roles authenticate with OAuth,
  where the provider verifies the mailbox owner.
- Roles resolve server-side from `ADMIN_EMAILS` / `EHS_EMAILS` env allowlists
  (`src/lib/roles.ts`); the client only ever sees the resolved
  `session.user.role`.
