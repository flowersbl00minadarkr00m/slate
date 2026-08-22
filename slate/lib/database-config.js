const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function postgresPoolOptions(rawConnectionString) {
  let url;
  try {
    url = new URL(rawConnectionString);
  } catch {
    throw new Error("Postgres connection string must be a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Postgres connection string must use postgres:// or postgresql://.");
  }

  // node-postgres lets sslmode in the URL replace the explicit SSL object.
  // Remove it so hosted databases always retain certificate verification.
  url.searchParams.delete("sslmode");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return {
    connectionString: url.toString(),
    ssl: LOCAL_DATABASE_HOSTS.has(hostname) ? false : { rejectUnauthorized: true },
    max: 2,
  };
}
