type Env = {
  ASSETS: Fetcher
  TELEGRAM_ADMIN_PIN?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_DB?: D1Database
  TELEGRAM_WEBHOOK_SECRET?: string
}

type Fetcher = {
  fetch(request: Request): Promise<Response>
}

type TelegramClientRow = {
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

type TelegramChat = {
  first_name?: string
  id: number
  last_name?: string
  title?: string
  type: string
  username?: string
}

type TelegramUser = {
  first_name?: string
  id: number
  last_name?: string
  username?: string
}

type TelegramUpdate = {
  message?: {
    chat: TelegramChat
    from?: TelegramUser
    text?: string
  }
}

const MAX_TELEGRAM_UPLOAD_BYTES = 48 * 1024 * 1024

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/telegram/clients' && request.method === 'GET') {
        return getTelegramClients(request, env)
      }

      if (url.pathname === '/api/telegram/send' && request.method === 'POST') {
        return sendTelegramDocument(request, env)
      }

      if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') {
        return receiveTelegramWebhook(request, env)
      }

      return env.ASSETS.fetch(request)
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : 'Server error.' },
        { status: 500 },
      )
    }
  },
}

async function getTelegramClients(request: Request, env: Env) {
  if (!hasAdminAccess(request, env)) {
    return jsonResponse({ ok: false, error: 'Invalid admin PIN.' }, { status: 401 })
  }

  const db = requireTelegramDb(env)
  await ensureTelegramTables(db)

  const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? ''
  const params: string[] = []
  let where = ''
  if (query) {
    where = `WHERE lower(display_name) LIKE ? OR lower(username) LIKE ? OR chat_id LIKE ?`
    params.push(`%${query}%`, `%${query}%`, `%${query}%`)
  }

  const result = await db
    .prepare(`
      SELECT chat_id, username, first_name, last_name, display_name, chat_type,
        started_at, last_seen_at, message_count
      FROM telegram_clients
      ${where}
      ORDER BY last_seen_at DESC
      LIMIT 200
    `)
    .bind(...params)
    .all<TelegramClientRow>()

  return jsonResponse({ ok: true, clients: result.results ?? [] })
}

async function sendTelegramDocument(request: Request, env: Env) {
  if (!hasAdminAccess(request, env)) {
    return jsonResponse({ ok: false, error: 'Invalid admin PIN.' }, { status: 401 })
  }

  const db = requireTelegramDb(env)
  const token = requireBotToken(env)
  const form = await request.formData()
  const chatId = String(form.get('chatId') ?? '').trim()
  const caption = String(form.get('caption') ?? '').trim()
  const document = form.get('document')

  if (!chatId) return jsonResponse({ ok: false, error: 'Select a Telegram client.' }, { status: 400 })
  if (!(document instanceof File)) {
    return jsonResponse({ ok: false, error: 'Upload document is missing.' }, { status: 400 })
  }
  if (document.size > MAX_TELEGRAM_UPLOAD_BYTES) {
    return jsonResponse({ ok: false, error: 'Telegram upload is limited to about 50 MB per file.' }, { status: 413 })
  }

  const telegramForm = new FormData()
  telegramForm.set('chat_id', chatId)
  if (caption) telegramForm.set('caption', caption.slice(0, 1024))
  telegramForm.set('document', document, document.name)

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: telegramForm,
  })
  const payload = await response.json() as { description?: string; ok?: boolean }

  if (!response.ok || !payload.ok) {
    const error = payload.description ?? `Telegram HTTP ${response.status}`
    await recordDelivery(db, {
      chatId,
      error,
      fileName: document.name,
      fileSize: document.size,
      status: 'failed',
    })
    return jsonResponse({ ok: false, error }, { status: 502 })
  }

  await recordDelivery(db, {
    chatId,
    fileName: document.name,
    fileSize: document.size,
    status: 'sent',
  })
  return jsonResponse({ ok: true, fileName: document.name })
}

async function receiveTelegramWebhook(request: Request, env: Env) {
  const configuredSecret = env.TELEGRAM_WEBHOOK_SECRET
  if (!configuredSecret) {
    return jsonResponse({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET secret is missing.' }, { status: 500 })
  }

  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (headerSecret !== configuredSecret) {
    return jsonResponse({ ok: false, error: 'Invalid Telegram webhook secret.' }, { status: 401 })
  }

  const update = await request.json() as TelegramUpdate
  const message = update.message
  if (!message?.chat) return jsonResponse({ ok: true, ignored: true })

  const db = requireTelegramDb(env)
  await ensureTelegramTables(db)

  const chat = message.chat
  const sender = message.from
  const chatId = String(chat.id)
  const firstName = chat.first_name ?? sender?.first_name ?? null
  const lastName = chat.last_name ?? sender?.last_name ?? null
  const username = chat.username ?? sender?.username ?? null
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    chat.title ||
    (username ? `@${username}` : `Telegram ${chatId}`)
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO telegram_clients
        (chat_id, username, first_name, last_name, display_name, chat_type, started_at, last_seen_at, message_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(chat_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        display_name = excluded.display_name,
        chat_type = excluded.chat_type,
        last_seen_at = excluded.last_seen_at,
        message_count = telegram_clients.message_count + 1`,
    )
    .bind(chatId, username, firstName, lastName, displayName, chat.type, now, now)
    .run()

  if (message.text?.trim().startsWith('/start')) {
    const token = requireBotToken(env)
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Connected to Legit solutions. You can receive converted VCF/ZIP files here now.',
      }),
    })
  }

  return jsonResponse({ ok: true })
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

function hasAdminAccess(request: Request, env: Env) {
  const configuredPin = env.TELEGRAM_ADMIN_PIN
  if (!configuredPin) return false
  return request.headers.get('x-admin-pin') === configuredPin
}

function requireTelegramDb(env: Env) {
  if (!env.TELEGRAM_DB) throw new Error('TELEGRAM_DB binding is missing.')
  return env.TELEGRAM_DB
}

function requireBotToken(env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN secret is missing.')
  return env.TELEGRAM_BOT_TOKEN
}

async function ensureTelegramTables(db: D1Database) {
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

async function recordDelivery(
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
