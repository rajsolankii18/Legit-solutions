import {
  ensureTelegramTables,
  jsonResponse,
  requireAdmin,
  requireTelegramDb,
  type PagesContext,
  type TelegramClientRow,
} from './_shared'

export async function onRequestGet({ request, env }: PagesContext) {
  if (!requireAdmin(request, env)) {
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

  const statement = db.prepare(`
    SELECT chat_id, username, first_name, last_name, display_name, chat_type,
      started_at, last_seen_at, message_count
    FROM telegram_clients
    ${where}
    ORDER BY last_seen_at DESC
    LIMIT 200
  `)

  const result = await statement.bind(...params).all<TelegramClientRow>()
  return jsonResponse({ ok: true, clients: result.results ?? [] })
}
