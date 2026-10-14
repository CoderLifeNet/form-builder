# Contributing

This project is in active implementation for the first working version. Keep changes within approved repository boundaries in AGENTS.md and docs.

Read AGENTS.md and the documentation index before editing. Submit coherent changes with a concise explanation of the problem, resulting behavior, and verification evidence.

For runtime changes, include relevant contract tests, security/authorization checks, accessibility verification, migrations, and documentation updates. Use the accepted work package criteria and avoid tests that only duplicate implementation details.

For UX-affecting changes, review both reusable UI and both example hosts:

- validate wording against real behavior,
- avoid exposing implementation-only terminology,
- keep response actions contextual,
- verify pointer and keyboard interactions in a real browser pass (not only mocked assertions),
- preserve keyboard and accessibility behavior,
- include focused regression coverage for changed interactions.

For example-host setup instructions, keep docs aligned with runnable commands: build before compiled migrations/seeding, show explicit backend `FORM_DB_URL` and `FORM_DEV_AUTH=true`, and avoid unnecessary local data resets.

Version changes follow docs/versioning.md. No automatic major releases or publishing.

License selection remains pending Chris's decision. Do not publish packages or accept outside code contributions until licensing is resolved.
