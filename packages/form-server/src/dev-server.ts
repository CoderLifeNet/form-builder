import { createFormServer } from "./index.js";

const port = Number(process.env.PORT ?? 4010);
const app = createFormServer();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Form server listening on ${port}`);
});
