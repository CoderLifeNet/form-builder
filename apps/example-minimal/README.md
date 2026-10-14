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
npm run dev:infra
npm run build
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate
# First setup only (or when you intentionally want fresh sample data):
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed
```

Start backend and frontend in separate terminals:

Terminal 1 (backend)

```bash
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder FORM_DEV_AUTH=true PORT=4010 npm run dev -w @coderlifenet/form-server
```

Terminal 2 (frontend)

```bash
npm run dev -w example-minimal
```

URLs:

- Frontend: http://127.0.0.1:4173/ (or the port Vite prints)
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
- Keep existing local data by default. Do not run `db:seed` again unless you explicitly want to overwrite sample state.
