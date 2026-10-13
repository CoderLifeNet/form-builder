# example-workspace

Workspace/project runnable host for @coderlifenet/form-builder.

## Purpose

Demonstrates full authoring and response lifecycle with scope defaults:

1. Forms management and form design.
2. Draft save and immutable publication versions.
3. Fill out form and response editing.
4. Response discovery/filtering and per-response history.
5. Scope default version behavior (workspace/project inheritance).

## Run

From repository root:

```bash
npm ci
npm run dev:infra
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed
npm run build
npm run dev -w @coderlifenet/form-server
npm run dev -w example-workspace
```

## Walkthrough

1. In Demo tools, switch identity between owner/collaborator/outsider.
2. In Forms, create or open a form.
3. In Design form, update fields, save draft, and publish.
4. In Fill out form, submit at least two responses.
5. In Responses, use filters and verify:
   - View response
   - Edit response
   - Response history
6. In Workspace settings, review published form versions and scope defaults.
7. Reload page and confirm responses rediscover correctly.

## Notes

- Form version history is distinct from response revision history.
- Host provides identity, permissions, source integrations, and analytics runtime.
- This example remains generic and avoids TrackForge-specific domain assumptions.
