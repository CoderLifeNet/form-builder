import { createFormServer } from "./index.js";

const port = Number(process.env.PORT ?? 4010);
const app = createFormServer({
  sourceRegistry: {
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
