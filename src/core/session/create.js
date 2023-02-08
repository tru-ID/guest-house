import { randomUUID } from "node:crypto";
import process from "node:process";

export async function startWithPhoneVerification(phoneNumber, truIdClient) {
  const checkId = await truIdClient.subscriberCheck.create(phoneNumber, {
    redirectUrl: `${process.env.APP_BASE_URL}/guest-house/verification/handle-check`,
  });

  return {
    authSession: {
      sessionId: randomUUID(),
      phoneNumber,
      phoneNumberVerified: false,
      checkId,
    },
    redirectUrl: `${truIdClient.baseUrl}/subscriber_check/v0.2/checks/${checkId}/redirect`,
  };
}

export function startNoVerification(phoneNumber) {
  return {
    sessionId: randomUUID(),
    phoneNumber,
    phoneNumberVerified: false,
  };
}

export function startWithMagicLink(phoneNumber, email) {
  const code = randomUUID();

  return {
    authSession: {
      sessionId: randomUUID(),
      phoneNumber,
      phoneNumberVerified: false,
      email,
      linkCode: code,
    },
    magicLink: `${process.env.APP_BASE_URL}/guest-house/verification/handle-link?code=${code}`,
  };
}
