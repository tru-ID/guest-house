import { wrapAsync } from "../core/routeUtils.js";

function cleanUpAuthSession(authSession, authSessionDb, req) {
  req.session.authSessionId = null;
  authSessionDb.remove(authSession);
}

function handleCheckResult(userDb, authSessionDb, truIdClient) {
  return wrapAsync(async (req, res) => {
    if ((req.query ?? {}) === {}) {
      res.status(400).end();
      return;
    }

    const { check_id: checkId, code, error } = req.query;

    const authSession = authSessionDb.findByCheckId(checkId ?? null);
    if (!authSession) {
      req.log.error(`could not find an authSession for checkId ${checkId}`);
      res.status(410).end();
      return;
    }

    // check if current cookie session and check session match
    const currentSessionId = req.session.authSessionId;
    if (currentSessionId !== authSession.sessionId) {
      cleanUpAuthSession(authSession, authSessionDb, req);
      req.log.error(
        `authSession mismatch current=${currentSessionId} != checkSession=${authSession.session}`,
      );
      res.status(403).end();
      return;
    }

    if (error) {
      cleanUpAuthSession(authSession, authSessionDb, req);
      req.log.error(
        `failed to verify session for phoneNumber ${authSession.phoneNumber}: ${error}`,
      );
      res.render("sign-in", {
        error: `Cannot log you in: ${error}`,
      });
      return;
    }

    // resolve code to match result
    const { match, noSimChange } = await truIdClient.subscriberCheck.complete(
      authSession.checkId,
      code,
    );

    const simHasChanged = !noSimChange;

    if (!match) {
      cleanUpAuthSession(authSession, authSessionDb, req);
      req.log.warn(
        `phone number ${authSession.phoneNumber} does not match user in session`,
        {
          checkId: authSession.checkId,
          checkResult: { match, noSimChange },
        },
      );
      res.render("sign-in", {
        error:
          "Cannot log you in: could not verify possession of your phoneNumber",
      });
      return;
    }

    const user = userDb.findByPhoneNumber(authSession.phoneNumber);
    if (user) {
      // login the user
      cleanUpAuthSession(authSession, authSessionDb, req);
      req.log.debug(`found user for phone number ${user.phoneNumber}`);

      req.session.userId = user.userId;
      res.redirect("/guest-house");
      return;
    }

    if (simHasChanged) {
      // clean the old user
      // you could also store the old profile somewhere for auditing, etc.
      userDb.remove(user);
      req.log.debug(
        `SIM has changed: purged old user for phone number ${user.phoneNumber}`,
      );
    }

    // finish onboarding
    authSession.phoneNumberVerified = true;
    authSessionDb.save(authSession);

    res.redirect("/guest-house/onboarding");
  });
}

function handleMagicLink(userDb, authSessionDb) {
  return (req, res) => {
    if ((req.query ?? {}) === {}) {
      res.status(400).end();
      return;
    }

    const authSession = authSessionDb.findBySessionId(
      req.session.authSessionId,
    );

    if (!authSession) {
      res.render("error", { error: "Your authentication session has expired" });
      return;
    }
    if (authSession.checkId) {
      res.render("error", { error: "You are not allowed to visit this page" });
      return;
    }

    const { code } = req.query;

    if (authSession.linkCode !== code) {
      cleanUpAuthSession(authSession, authSessionDb, req);
      req.log.warn(
        `rejected magic link for phone number ${authSession.phoneNumber}: mismatched codes`,
      );
      res.render("error", { error: "Your authentication session has expired" });
      return;
    }

    const user = userDb.findByPhoneNumber(authSession.phoneNumber);
    req.log.debug(`found user for phone number ${user.phoneNumber}`);

    cleanUpAuthSession(authSession, authSessionDb, req);

    req.session.userId = user.userId;
    res.redirect("/guest-house");
    return;
  };
}

export function registerVerificationRoutes(
  app,
  { userDb, authSessionDb, truIdClient },
) {
  app.get(
    "/guest-house/verification/handle-check",
    handleCheckResult(userDb, authSessionDb, truIdClient),
  );
  app.get(
    "/guest-house/verification/handle-link",
    handleMagicLink(userDb, authSessionDb),
  );
}
