import axios from "axios";
import { URLSearchParams } from "node:url";
import { Buffer } from "node:buffer";

function clientCredentialsClient({ axios, clientId, clientSecret, scope }) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const data = new URLSearchParams({
    scope: scope.join(" "),
    grant_type: "client_credentials",
  });

  const getTokens = async () => {
    let res;
    try {
      res = await axios.post("/oauth2/v1/token", data, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
    } catch (err) {
      throw new Error(
        `failed to get client credentials token for clientId=${clientId}`,
        { cause: err },
      );
    }

    const { access_token, expires_in } = res.data;

    const expires = Date.now() + expires_in * 1000;

    return {
      accessToken: access_token,
      expires,
    };
  };

  return {
    getTokens,
  };
}

class TokenManager {
  #tokens;
  #tokenFetcher;

  static fromCredentials({ axios, clientId, clientSecret, scope }) {
    const tokenClient = clientCredentialsClient({
      axios,
      clientId,
      clientSecret,
      scope,
    });

    return new TokenManager(tokenClient);
  }

  constructor(tokenFetcher) {
    this.#tokens = {};
    this.#tokenFetcher = tokenFetcher;
  }

  async getAccessToken() {
    if (!this.#hasValidCachedToken()) {
      this.#tokens = await this.#tokenFetcher.getTokens();
    }

    return this.#tokens.accessToken;
  }

  #hasValidCachedToken() {
    return this.#tokens && this.#tokens.expires > Date.now();
  }
}

export const ReachabilityFailure = Object.freeze({
  UnsupportedNetwork: "Unsupported Network",
  NotMobileIP: "Not a mobile IP",
});

async function checkDeviceReachability(truIdClient, deviceIp) {
  let res;
  try {
    res = await truIdClient.get(`/coverage/v0.1/device_ips/${deviceIp}`);
  } catch (err) {
    if (err?.response?.status === 400) {
      return {
        reachable: false,
        reason: ReachabilityFailure.UnsupportedNetwork,
      };
    } else if (err?.response?.status === 412) {
      return { reachable: false, reason: ReachabilityFailure.NotMobileIP };
    } else {
      throw new Error(
        `failed to check device reachability for deviceIp=${deviceIp}`,
        { cause: err },
      );
    }
  }

  const { products } = res.data;

  const normalizedProducts = products.map((p) => {
    return { productId: p.product_id, name: p.product_name };
  });

  return { reachable: true, products: normalizedProducts };
}

async function createSubscriberCheck(
  truIdClient,
  { phoneNumber, redirectUrl },
) {
  const data = {
    phone_number: phoneNumber,
    redirect_url: redirectUrl,
  };

  let res;
  try {
    res = await truIdClient.post(`/subscriber_check/v0.2/checks`, data);
  } catch (err) {
    throw new Error(`failed to create check for phoneNumber=${phoneNumber}`, {
      cause: err,
    });
  }

  const { check_id: checkId } = res.data;

  return checkId;
}

async function completeSubscriberCheck(truIdClient, { checkId, code }) {
  const data = [{ op: "add", path: "/code", value: code }];
  const opts = { headers: { "Content-Type": "application/json-patch+json" } };

  let res;
  try {
    res = await truIdClient.patch(
      `/subscriber_check/v0.2/checks/${checkId}`,
      data,
      opts,
    );
  } catch (err) {
    throw new Error(`failed to complete check for checkId=${checkId}`, {
      cause: err,
    });
  }

  const {
    status,
    match,
    no_sim_change: noSimChange,
    sim_change_withing: simChangeWithin,
  } = res.data;

  return {
    status,
    match,
    noSimChange,
    simChangeWithin,
  };
}

export function TruIdClient({
  clientId,
  clientSecret,
  dataResidency = "eu",
  scope = ["phone_check", "subscriber_check", "sim_check", "coverage"],
}) {
  const apiBaseUrl = `https://${dataResidency}.api.tru.id`;
  const customAxios = axios.create({
    baseURL: apiBaseUrl,
  });
  const tokenManager = TokenManager.fromCredentials({
    axios: customAxios,
    clientId,
    clientSecret,
    scope,
  });

  customAxios.interceptors.request.use(async (req) => {
    if (!req.headers?.get("Authorization")) {
      const bearerToken = await tokenManager.getAccessToken();
      req.headers = req.headers?.set(
        "Authorization",
        `Bearer ${bearerToken}`,
      ) ?? { Authorization: `Bearer ${bearerToken}` };
    }

    return req;
  });

  return {
    subscriberCheck: {
      create(phoneNumber, { redirectUrl }) {
        return createSubscriberCheck(customAxios, { phoneNumber, redirectUrl });
      },
      complete(checkId, code) {
        return completeSubscriberCheck(customAxios, { checkId, code });
      },
    },
    coverage: {
      reachabilityCheck(deviceIp) {
        return checkDeviceReachability(customAxios, deviceIp);
      },
    },
    get baseUrl() {
      return apiBaseUrl;
    },
  };
}
