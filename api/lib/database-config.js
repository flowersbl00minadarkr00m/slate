const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopback(hostname) {
  return LOOPBACK_HOSTS.has(hostname.replace(/^\[|\]$/g, "").toLowerCase());
}

export function getDatabaseConfig(connectionString) {
  if (typeof connectionString !== "string" || !connectionString.trim()) return null;

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid Postgres configuration.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Postgres configuration must use a postgres URL.");
  }

  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");

  return {
    connectionString: url.toString(),
    ssl: isLoopback(url.hostname) ? false : { rejectUnauthorized: true },
    max: 2,
  };
}
