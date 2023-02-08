import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import express from "express";
import process from "node:process";
import { pinoHttp } from "pino-http";
import { AuthSessionDb } from "./core/session/AuthSessionDb.js";
import { TruIdClient } from "./core/truId.js";
import { UserDb } from "./core/user.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerVerificationRoutes } from "./routes/verification.js";

const app = express();
const port = 3000;

const pino = pinoHttp({
  autoLogging: false,
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  quietReqLogger: true,
});

// middleware setup

app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(pino);
app.use(
  cookieSession({
    name: "tid_gs",
    secret: "changeme",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 5 * 60 * 1000, // 5 minutes
  }),
);

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));

// routing

const userDb = new UserDb();
const authSessionDb = new AuthSessionDb();
const truIdClient = new TruIdClient({
  clientId: process.env.TRU_CLIENT_ID,
  clientSecret: process.env.TRU_CLIENT_SECRET,
  dataResidency: process.env.TRU_DATA_RESIDENCY,
});

const system = { userDb, authSessionDb, truIdClient };

app.get("/guest-house", (req, res) => {
  const { userId } = req.session;
  const user = userDb.findById(userId);

  const model = {};
  if (user) {
    model.user = user;
  } else {
    // clean stale session
    req.session = null;
  }

  res.render("index", model);
});

app.get("/guest-house/magic-link", (req, res) => {
  res.render("magic-link");
});

registerAuthRoutes(app, system);
registerVerificationRoutes(app, system);
registerOnboardingRoutes(app, system);

// error middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log.error(err);
  res.status(500);
  res.send(err?.message ?? err);
});

// startup

app.listen(port, () => {
  pino.logger.info(`Listening on port ${port}`);
  pino.logger.info(`Visit ${process.env.APP_BASE_URL}/guest-house to start`);
});
