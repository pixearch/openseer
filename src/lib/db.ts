import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const GLOBAL_SQL_KEY = "__openseer_sql";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function createClient(): SqlClient {
  return postgres(getConnectionString(), { max: 1 });
}

function getSql(): SqlClient {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_SQL_KEY]?: SqlClient;
  };
  if (!g[GLOBAL_SQL_KEY]) {
    g[GLOBAL_SQL_KEY] = createClient();
  }
  return g[GLOBAL_SQL_KEY];
}

/** Server-only Postgres client. Do not import from client components. */
export const sql: SqlClient = getSql();
