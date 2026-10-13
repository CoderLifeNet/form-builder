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
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed
npm run build
npm run dev -w @coderlifenet/form-server
npm run dev -w example-minimal
```

Open the Vite URL and sign in is handled by the example host through `/dev/login`.

## Walkthrough

1. In Demo tools, keep default theme or switch to custom theme.
2. Open Design form and adjust a field label.
3. Save draft and then Publish version.
4. Open Fill out form and submit a response.
5. Confirm status updates for save/publish/submit outcomes.

## Notes

- Analytics runtime and consent controls are host-owned in AnalyticsHost.
- This example demonstrates reusable integration, not TrackForge-specific behavior.
