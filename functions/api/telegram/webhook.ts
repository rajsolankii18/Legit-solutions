import {
  ensureTelegramTables,
  jsonResponse,
  requireBotToken,
  requireTelegramDb,
  type PagesContext,
} from './_shared'

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

type TelegramMessage = {
  chat: TelegramChat
  from?: TelegramUser
  text?: string
}

type TelegramUpdate = {
  message?: TelegramMessage
}

export async function onRequestPost({ request, env }: PagesContext) {
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
