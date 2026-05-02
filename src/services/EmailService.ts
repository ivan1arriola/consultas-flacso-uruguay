import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS

export async function sendEmail(opts: { to: string; subject: string; text?: string; html?: string; from?: string }) {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured')
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  const info = await transporter.sendMail({
    from: opts.from || process.env.EMAIL_REPLY_TO || SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })

  return info
}

export default { sendEmail }
