# example-minimal

Minimal runnable host for @coderlifenet/form-builder.

## Purpose

Shows the shortest complete flow:

1. Design a form draft.
2. Publish a form version.
3. Fill out and submit a response.

## Run

From repository root:

```bash
npm ci
npm run dev:minimal
```

This single command:

- checks prerequisites (Node/npm/Docker/ports),
- starts local PostgreSQL in Docker and waits for readiness,
- builds required artifacts before migrations,
- applies migrations to `postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder`,
- starts backend + minimal frontend with matching API URL wiring,
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
VITE_FORM_API_BASE_URL=http://127.0.0.1:4010 npm run dev -w example-minimal -- --host 127.0.0.1 --port 4173 --strictPort
```

URLs:

- Frontend: http://127.0.0.1:4173/
- Backend API: http://127.0.0.1:4010/

Sign-in for demo users is handled by the host through `/dev/login`.

When you change reusable package code in `packages/`, restart both terminals so rebuilt package output is reloaded.

## Walkthrough

1. In Demo tools, keep default theme or switch to custom theme.
2. Open Design form and adjust a field label.
3. Save draft and then Publish version.
4. Open Fill out form and submit a response.
5. Confirm status updates for save/publish/submit outcomes.

## Notes

- Analytics runtime and consent controls are host-owned in AnalyticsHost.
- This example demonstrates reusable integration, not TrackForge-specific behavior.
- Keep existing local data by default. Startup does not reset, delete volumes, or reseed.
