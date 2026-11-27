import express from "express";
import cors from "cors";
import { config, checkConfig } from "./config";
import { runsRouter } from "./routes/runs";
import { webhooksRouter } from "./routes/webhooks";
import { flagsmithRouter } from "./routes/flagsmith";

checkConfig();

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
