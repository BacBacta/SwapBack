import { Buffer } from "buffer";

const TRACK_ENDPOINT = "https://api.mixpanel.com/track?strict=1";
const MIXPANEL_TOKEN =
  process.env.MIXPANEL_SERVER_TOKEN || process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";

export type ServerAnalyticsProps = Record<string, unknown> & {
  distinctId?: string;
};

function sanitizeProperties(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) =>
      value !== undefined && typeof value !== "function"
    )
  );
}

export function trackServerEvent(event: string, props: ServerAnalyticsProps = {}) {
  if (!ANALYTICS_ENABLED || !MIXPANEL_TOKEN || typeof fetch !== "function") {
    return Promise.resolve();
  }

  const { distinctId, ...rest } = props;
  const body = {
    event,
    properties: {
      token: MIXPANEL_TOKEN,
      distinct_id: distinctId ?? "swapback-server",
      origin: "api",
      ...sanitizeProperties(rest),
    },
  };

  const payload = new URLSearchParams({
    data: Buffer.from(JSON.stringify(body)).toString("base64"),
  }).toString();

  return fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
    cache: "no-store",
    keepalive: true,
  })
    .then(() => undefined)
    .catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("📊 server analytics send failed", error);
      }
    });
}
