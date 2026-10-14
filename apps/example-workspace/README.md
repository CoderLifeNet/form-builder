# example-workspace

Workspace/project runnable host for @coderlifenet/form-builder.

## Purpose

Demonstrates full authoring and response lifecycle with scope defaults:

1. Forms management and form design.
2. Draft save and published versions for future responses.
3. Fill out form and response editing.
4. Response discovery/filtering and per-response history.
5. Scope default version behavior (workspace/project inheritance).

## Run

From repository root:

```bash
npm ci
npm run dev
```

This single command:

- checks prerequisites (Node/npm/Docker/ports),
- starts local PostgreSQL in Docker and waits for readiness,
- builds required artifacts before migrations,
- applies migrations to `postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder`,
- starts backend + workspace frontend with matching API URL wiring,
- labels output and shuts down child processes cleanly on `Ctrl+C`.

Optional explicit seed (first setup only, or when intentionally desired):

```bash
FORM_DB_URL=postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder npm run db:seed
```

Manual mode (separate terminals) remains available:

Terminal 1 (backend)

```bash
FORM_DB_URL=postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder FORM_DEV_AUTH=true PORT=4010 npm run dev -w @coderlifenet/form-server
```

Terminal 2 (frontend)

```bash
VITE_FORM_API_BASE_URL=http://127.0.0.1:4010 npm run dev -w example-workspace -- --host 127.0.0.1 --port 4175 --strictPort
```

URLs:

- Frontend: http://127.0.0.1:4175/
- Backend API: http://127.0.0.1:4010/

When you change reusable package code in `packages/`, restart both terminals so rebuilt package output is reloaded.

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
- Keep existing local data by default. Startup does not reset, delete volumes, or reseed.
