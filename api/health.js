import { setSecurityHeaders } from "./lib/request-policy.js";

function hasProviderConfiguration(env) {
  return Boolean(env.OPENAI_API_KEY && env.YOUTUBE_API_KEY);
}

function hasCacheConfiguration(env) {
  return Boolean(env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL);
}

export function createHealthHandler({ env = process.env } = {}) {
  return async function healthHandler(req, res) {
    setSecurityHeaders(res);
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed.", code: "method-not-allowed" });
      return;
    }

    const generationEnabled = env.SLATE_API_ENABLED === "1";
    const providersConfigured = hasProviderConfiguration(env);
    const ready = generationEnabled && providersConfigured;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not-ready",
      generationEnabled,
      providersConfigured,
      cacheConfigured: hasCacheConfiguration(env),
    });
  };
}

export default createHealthHandler();
