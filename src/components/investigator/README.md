# `src/components/investigator/`

Reserved for the live investigator app. The existing investigator UI still
lives under `src/components/{graph,explorer,vault,...}` and `src/app/investigators/`;
new investigator work lands here so the frontier is clear.

## Frontier

Investigator code MUST NOT import from `@/components/forensic/*`. The only
legal sharing is via:

- `@/lib/design-system`
- `@/lib/contracts/website` (if the same public shape is used)
- `@/lib/constellation`

The ESLint config enforces this (`no-restricted-imports`).
