# SSO & Identity Assurance

> Stub — the full Okta/Entra provider walkthrough lands with milestone EN-M2.

## Identity assurance decisions (July 2026)

- **Shared email-code logins are worker-only in production.** `EMAIL_LOGIN_CODE`
  is a single shared secret, so it cannot prove WHICH person is signing in.
  `src/lib/auth.ts` therefore refuses to mint `admin`/`ehs` sessions from it in
  production (`resolveRole(email) !== 'worker'` → rejected, logged as
  `code-login-blocked-elevated`). Elevated roles authenticate with Google OAuth,
  where the provider verifies the mailbox owner.
- Roles resolve server-side from `ADMIN_EMAILS` / `EHS_EMAILS` env allowlists
  (`src/lib/roles.ts`); the client only ever sees the resolved
  `session.user.role`.
