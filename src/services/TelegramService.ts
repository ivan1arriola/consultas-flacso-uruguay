import fetch from 'node-fetch'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Telegram credentials not configured')
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  })

  const data = await res.json()
  if (!data.ok) throw new Error('Telegram API error: ' + JSON.stringify(data))
  return data
}

export default { sendTelegramMessage }
