import { wrapAsync } from "../core/routeUtils.js";
import {
  startWithPhoneVerification,
  startNoVerification,
  startWithMagicLink,
} from "../core/session/create.js";

function handleSignInPage() {
  return (req, res) => {
    const { userId } = req.session;
    if (userId) {
      res.redirect("/guest-house");
      return;
    }

    res.render("sign-in");
  };
}

function handleSignInAction(userDb, authSessionDb, truIdClient) {
  return wrapAsync(async (req, res) => {
    const { userId } = req.session;
    if (userId) {
      res.redirect("/guest-house");
      return;
    }

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.render("sign-in", {
        error: "You need to input a phone number",
      });
      return;
    }

    const user = userDb.findByPhoneNumber(phoneNumber);
    const coverageResult = await truIdClient.coverage.reachabilityCheck(req.ip);

    let authSession;
    let nextUrl;

    if (!coverageResult.reachable) {
      req.log.warn(
        `unreachable session for ip ${req.ip} and phoneNumber ${phoneNumber}: ${coverageResult.reason}`,
      );

      if (!user) {
        // try onboarding the user based on the email only
        authSession = startNoVerification(phoneNumber);
        nextUrl = "/guest-house/onboarding";

        req.log.debug(`onboard new user with phoneNumber ${phoneNumber}`);
      } else if (user.email) {
        // try to send a magic link
        const sessionResult = startWithMagicLink(user.phoneNumber, user.email);
        req.log.info(
          `sent email to ${user.email} magic link: ${sessionResult.magicLink}`,
        );

        authSession = sessionResult.authSession;
        nextUrl = "/guest-house/magic-link";
      } else {
        // we opt to fail the login, but you could fallback to a 2FA SMS code
        req.log.warn(
          `rejected login for user with phoneNumber ${phoneNumber}: no fallback email`,
        );
        res.render("sign-in", {
          error: `Cannot log you in: ${coverageResult.reason}`,
        });
        return;
      }
    } else {
      // always verify the phone number (sign-in and sign-up)
      const sessionResult = await startWithPhoneVerification(
        phoneNumber,
        truIdClient,
      );

      authSession = sessionResult.authSession;
      nextUrl = sessionResult.redirectUrl;

      req.log.debug(`verify phoneNumber ${phoneNumber}`);
    }

    authSessionDb.save(authSession);
    req.session.authSessionId = authSession.sessionId;
    res.redirect(nextUrl);
  });
}

function handleSignOut() {
  return (req, res) => {
    req.session = null;
    res.redirect("/guest-house");
  };
}

export function registerAuthRoutes(
  app,
  { userDb, authSessionDb, truIdClient },
) {
  app.get("/guest-house/auth/sign-in", handleSignInPage());
  app.post(
    "/guest-house/auth/sign-in",
    handleSignInAction(userDb, authSessionDb, truIdClient),
  );
  app.post("/guest-house/auth/sign-out", handleSignOut());
}
