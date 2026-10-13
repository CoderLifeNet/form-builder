import { createFormServer } from "./index.js";

const port = Number(process.env.PORT ?? 4010);
const app = createFormServer({
  retentionPolicy: { pendingUploadMaxAgeMs: 24 * 60 * 60 * 1000 },
  async bindingAncestors(_ctx, scope) {
    // Demo host relationship; production hosts resolve this from their own membership data.
    return scope.type === "project" && scope.id === "example-project"
      ? [{ type: "workspace", id: "example-workspace" }, scope]
      : [scope];
  },
  sourceRegistry: {
    async capabilities() { return { "profile.first_name": "1", "profile.last_name": "1", "request.categories": "1", "request.title_hint": "1" }; },
    async resolveSourceValue(sourceId, _ctx, payload) {
      if (sourceId === "profile.first_name") {
        return process.env.DEMO_FIRST_NAME ?? "Owner";
      }
      if (sourceId === "profile.last_name") {
        return process.env.DEMO_LAST_NAME ?? "User";
      }
      if (sourceId === "request.categories") {
        return [
          { id: "equipment", label: "Equipment" },
          { id: "access", label: "Access" },
          { id: "other", label: "Other" }
        ];
      }
      if (sourceId === "request.title_hint") {
        const requester = String(payload.field_first_name ?? payload.first_name ?? "").trim();
        return requester ? `${requester} request` : "";
      }
      throw new Error(`SOURCE_NOT_REGISTERED:${sourceId}`);
    }
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Form server listening on ${port}`);
});
