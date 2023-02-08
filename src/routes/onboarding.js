import { userFromPhoneNumber } from "../core/user.js";

function handleOnboarding(userDb, authSessionDb) {
  return (req, res) => {
    const user = userDb.findById(req.session.userId);
    const authSession = authSessionDb.findBySessionId(
      req.session.authSessionId,
    );

    if (!user && !authSession) {
      res.redirect("/guest-house/auth/sign-in");
      return;
    }

    if (user) {
      // no need to onboard a logged in user
      res.redirect("/guest-house");
      return;
    }

    res.render("onboarding", { canSkip: authSession.phoneNumberVerified });
  };
}

function handleOnboardingAction(userDb, authSessionDb) {
  return (req, res) => {
    const user = userDb.findById(req.session.userId);
    const authSession = authSessionDb.findBySessionId(
      req.session.authSessionId,
    );

    if (!user && !authSession) {
      res.redirect("/guest-house/auth/sign-in");
      return;
    }

    if (user) {
      // no need to onboard a logged in user
      res.redirect("/guest-house");
      return;
    }

    const isOngoingPhoneVerification =
      authSession.checkId && !authSession.phoneNumberVerified;
    const isOngoingEmailVerification = authSession.linkCode;
    if (isOngoingPhoneVerification || isOngoingEmailVerification) {
      req.log.debug(
        `rejected onboarding for phoneNumber ${authSession.phoneNumber} with on-going verification`,
      );
      res.render("error", { error: "You are not allowed to visit this page" });
      return;
    }

    const newUser = userFromPhoneNumber(authSession.phoneNumber);

    // handle form email logic
    const { email } = req.body;
    if (!email && !authSession.phoneNumberVerified) {
      res.render("onboarding", {
        error: "You need to provide an email to sign-in",
        canSkip: false,
      });
      return;
    }

    newUser.email = email ?? null;
    userDb.save(newUser);

    req.log.debug(`created new user for phone number ${newUser.phoneNumber}`);

    // cleanup authSession
    req.session.authSessionId = null;
    authSessionDb.remove(authSession);

    req.session.userId = newUser.userId;
    res.redirect("/guest-house");
  };
}

export function registerOnboardingRoutes(app, { userDb, authSessionDb }) {
  app.get("/guest-house/onboarding", handleOnboarding(userDb, authSessionDb));
  app.post(
    "/guest-house/onboarding",
    handleOnboardingAction(userDb, authSessionDb),
  );
}
