import {
  jsonResponse,
  recordDelivery,
  requireAdmin,
  requireBotToken,
  requireTelegramDb,
  type PagesContext,
} from './_shared'

const MAX_TELEGRAM_UPLOAD_BYTES = 48 * 1024 * 1024

export async function onRequestPost({ request, env }: PagesContext) {
  if (!requireAdmin(request, env)) {
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
