// Database access. Production: any standard Postgres via DATABASE_URL.
// Local development without a database: set DEV_DB=pglite (a built-in Postgres that saves to .data/).
let pool = null;
let lite = null;
let schemaReady = null;

export class DbNotConfigured extends Error {}

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DEV_DB === "pglite");
}

async function getLite() {
  if (!lite) {
    const { PGlite } = await import("@electric-sql/pglite");
    lite = new PGlite(process.env.PGLITE_DIR || ".data/pglite");
    await lite.waitReady;
  }
  return lite;
}

async function getPool() {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000 });
  }
  return pool;
}

export async function query(text, params = []) {
  if (process.env.DATABASE_URL) return (await getPool()).query(text, params);
  if (process.env.DEV_DB === "pglite") {
    const db = await getLite();
    const r = await db.query(text, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  }
  throw new DbNotConfigured("Database is not set up");
}

async function exec(sql) {
  if (process.env.DATABASE_URL) return (await getPool()).query(sql);
  const db = await getLite();
  return db.exec(sql);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organisations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  licence_status TEXT NOT NULL DEFAULT 'active',
  licence_expires DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  org_id INT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','doctor','nurse','pharmacist')),
  password_hash TEXT,
  activation_hash TEXT,
  activation_expires TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, staff_number)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id INT,
  staff_id INT,
  staff_number TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS audit_org_at ON audit_log (org_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_ip_action ON audit_log (ip, action, at DESC);
`;

export function ensureSchema() {
  if (!dbConfigured()) throw new DbNotConfigured("Database is not set up");
  if (!schemaReady) schemaReady = exec(SCHEMA).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}
