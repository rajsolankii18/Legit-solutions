export type Env = {
  TELEGRAM_ADMIN_PIN?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_DB?: D1Database
  TELEGRAM_WEBHOOK_SECRET?: string
}

export type PagesContext = {
  request: Request
  env: Env
}

export type TelegramClientRow = {
  chat_id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  display_name: string
  chat_type: string
  started_at: string
  last_seen_at: string
  message_count: number
}

type D1Value = string | number | boolean | null

type D1PreparedStatement = {
  bind(...values: D1Value[]): D1PreparedStatement
  run(): Promise<unknown>
  all<T>(): Promise<{ results?: T[] }>
}

type D1Database = {
  exec(query: string): Promise<unknown>
  prepare(query: string): D1PreparedStatement
}

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

export function requireTelegramDb(env: Env) {
  if (!env.TELEGRAM_DB) throw new Error('TELEGRAM_DB binding is missing.')
  return env.TELEGRAM_DB
}

export function requireAdmin(request: Request, env: Env) {
  const configuredPin = env.TELEGRAM_ADMIN_PIN
  if (!configuredPin) return false
  return request.headers.get('x-admin-pin') === configuredPin
}

export function requireBotToken(env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN secret is missing.')
  return env.TELEGRAM_BOT_TOKEN
}

export async function ensureTelegramTables(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_clients (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      display_name TEXT NOT NULL,
      chat_type TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_clients_last_seen
      ON telegram_clients(last_seen_at);
    CREATE TABLE IF NOT EXISTS telegram_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      sent_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_deliveries_chat_id
      ON telegram_deliveries(chat_id);
  `)
}

export async function recordDelivery(
  db: D1Database,
  input: {
    chatId: string
    error?: string
    fileName: string
    fileSize: number
    status: 'sent' | 'failed'
  },
) {
  await ensureTelegramTables(db)
  await db
    .prepare(
      `INSERT INTO telegram_deliveries
        (chat_id, file_name, file_size, status, error, sent_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.chatId,
      input.fileName,
      input.fileSize,
      input.status,
      input.error ?? null,
      new Date().toISOString(),
    )
    .run()
}
