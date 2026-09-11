# Neutronium navigation release — 11 September 2026

The user authorized deployment with “push it.” This releases the simplified
navigation and task-oriented Home page reviewed on September 10.

Status: uploaded and building on the VPS; rollout verification is pending.

## Scope

- Four interface files: `navigation.tsx`, `workspace.tsx`, `neutronium.css`,
  and `people-overview.tsx` in `src/app/neutronium/`.
- Six browser test files covering navigation and existing workflows.
- The navigation design/review notes.
- All 11 uploaded files passed SHA-256 verification against the reviewed local
  copies. The three existing interface files on the VPS matched the exact
  pre-redesign baseline before upload.
- Unrelated website/application changes, shared configuration, and secrets
  were excluded. No database migrations, credential rotations, scheduler
  changes, or proxy changes are required.

## Target and backups

- Site: `https://neutronium.runsit.ca/neutronium/`
- VPS: `165.22.236.188`; checkout: `/opt/neutronium`; Compose: `neutronium`.
- Database: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260911T071234Z.dump`
- Private files: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260911T071234Z.dump.files.tar.gz`
- Source: `/opt/neutronium-source-20260911T071234Z.tar.gz`
- Rollback image: `neutronium-app:before-navigation-20260911T071234Z`
- Previous image: `sha256:508132717e26ef108ff03dd84415a3ae514095f7f6567bb241627a6d65fe626f`
- VPS build log: `/opt/neutronium/deploy/neutronium/backups/navigation-release-build-20260911T071234Z.log`

The database dump passed `pg_restore -l`; the source and private-file archives
passed gzip integrity checks. Runtime credentials were already configured and
were preserved.

## Validation

- Before deployment: 61 backend tests, lint, TypeScript, and the local
  production build passed again.
- The implementation was previously verified across all 25 local browser
  scenarios, with desktop, directory, and mobile visual review.
- Live rollout and published-interface checks are pending.

Tests use synthetic accounts and simulated providers or mocked API mutations.
They do not prove real email delivery or Microsoft provisioning.
