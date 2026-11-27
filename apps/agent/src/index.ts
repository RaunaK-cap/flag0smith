import express from "express";
import cors from "cors";
import { config } from "./config";
import { setupLlm } from "./llm";
import { runsRouter } from "./routes/runs";
import { webhooksRouter } from "./routes/webhooks";
import { flagsmithRouter } from "./routes/flagsmith";

setupLlm(); // before any agent runs

const app = express();
app.use(cors());
app.use(webhooksRouter); // before express.json(), the webhook needs the raw body for the signature check
app.use(express.json());
app.use(runsRouter);
app.use(flagsmithRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`FlagPilot agent listening on http://localhost:${config.port}`);
});
