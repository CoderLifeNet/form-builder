# Continue the first-working-version sprint

Run this in Copilot Agent on the existing local implementation branch.

---

Continue the original first-working-version sprint to completion; do not start a new unrelated project or rewrite working code.

1. Inspect git status, current branch, AGENTS.md, the task plan and docs/sprints/first-working-version-report.md. Preserve local work and current commits. The earlier report explicitly says the sprint is incomplete.
2. Fetch origin/main and bring in the documentation changes, reconciling conflicts with your local implementation docs. Do not blindly overwrite local files or switch away from the implementation branch. Read docs/file-storage.md and the revised docs/prompts/first-working-version.md. This invocation authorizes the remaining implementation in this repository; original publication/major-version/other-repository restrictions remain.
3. Correct the storage design: provider-neutral engine contract, working local filesystem adapter and S3-compatible adapter, with optional Garage Docker Compose reference setup. Garage is not required for no-file forms, traditional server uploads or core/browser packages. Supply configuration around a pinned official image; do not invent a custom Garage distribution. Replace mandatory MinIO/LocalStack assumptions and align docs/env/scripts/examples.
4. Use docs/file-storage.md for upload authority, stable identities, pending/attached states, private filesystem paths, historical references, deletion recovery and provider routing. Do not lose existing objects by changing the default adapter. If objects exist, document/implement a deliberate transfer only if needed; do not reset existing storage.
5. Review every A01–A22 result. Turn all failed/partial/unverified required outcomes into coherent dependency-ordered tasks, then execute them. Do not restrict continuation to A07/A08/A13/A15/A17/A18/A21 if other criteria remain partial. Do not downgrade criteria or stop at another baseline.
6. Verify the apparent x-tenant-id/x-actor-id test path: these headers are not trusted production identity. Keep any such bypass strictly development-only and opt-in, or replace it with the example's host login/session. Production service authorization must use verified host context and deny absent policy; test forged requests.
7. Complete history/type/option changes, explicit migration, uploads, dependency reconciliation, compact validation, retention/erasure, accessibility and any other gaps discovered from code/report. Frontend controls must call the real service; docs and container startup are not substitutes for working upload integration.
8. Run upload integration against private filesystem storage and actual Garage. Verify no-file setup without storage configuration, filesystem setup without an object-store container, and existing packed-package consumer tests. Do not claim a provider is supported merely because its container starts.
9. Run the complete required build/integration/browser/accessibility/upgrade checks. Preserve truthful command/results evidence, repair failures and revalidate changed paths.
10. Update task plan, report matrix, requirements, architecture, decision log, README/package READMEs and tested guides. Distinguish implemented, tested and human-reviewed. Keep versions in 0.x.x; no major, publication or release tagging.
11. Commit coherent remaining work without rewriting the existing baseline commit merely for cosmetic history. Deliver a concise completion report pointing to exact commands, evidence and genuine blockers.

Proceed from inspection to planning and execution without asking whether to start the next tranche. Continue until required outcomes are verified, or report specific external blockers after completing independent work. Do not call the sprint complete with partial acceptance outcomes.
