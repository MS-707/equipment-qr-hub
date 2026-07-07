# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Sage EHS, please report it
responsibly. **Do not open a public issue.**

Email **mark.starr@mytra.ai** with:

- A description of the vulnerability
- Steps to reproduce
- Any relevant screenshots or logs

We will acknowledge your report within 2 business days and aim to provide a
fix or mitigation within 7 days for critical issues.

## Scope

This policy covers the Sage EHS application, its API routes, and any
associated infrastructure operated by Mytra AI, Inc.

## Supported Versions

Only the latest deployed version receives security updates.

## Dependency Posture

Production dependencies are audited with `npm audit --omit=dev`;
`package-lock.json` is git-tracked. Advisories that only resolve via breaking
framework upgrades are risk-accepted with dated rationale and a review-by date
in [docs/DEPENDENCY-AUDIT.md](docs/DEPENDENCY-AUDIT.md).
