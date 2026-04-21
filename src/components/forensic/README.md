# `src/components/forensic/`

Public Website 2.0 surface — components rendered by the `(forensic)` route
group. Frozen visual direction is owned by the MASTER / BIBLE / V2 shells.

## Frontier

- Public forensic code MAY import from:
  - `@/lib/design-system`
  - `@/lib/contracts/website`
  - `@/lib/constellation`
  - `@/lib/mocks/*`
  - generic neutral utils (`@/lib/utils`, `clsx`, `tailwind-merge`)

- Public forensic code MUST NOT import from:
  - `@/components/investigator/*`
  - `@/lib/investigator/*`, `@/lib/intel-vault/*`, `@/lib/intelligence/*`

The ESLint config enforces this (`no-restricted-imports`).

## Conventions

- Every forensic page is wrapped by `(forensic)/layout.tsx` which sets
  `.forensic-surface` on the outer `<div>`. All tokens live in
  `src/lib/design-system/tokens.css` and are scoped to that class.
- No Tailwind for semantic styling in forensic components. Tailwind is only
  allowed for raw layout utilities (flex, grid). All color, typography,
  spacing, and radii go through CSS variables.
- No cyan. No glassmorphism. No SaaS cards. Use `--ink*`, `--bone*`,
  `--rule*`, `--signal*`, `--risk*`, `--caution*`, `--cleared*`.
