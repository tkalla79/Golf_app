import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendLoginEmail(to: string, loginUrl: string, playerName: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
    to,
    subject: 'Zaloguj się - Don Papa Match Play',
    html: `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #134a56; font-size: 22px; margin: 0;">Don Papa Match Play</h1>
          <p style="color: #888; font-size: 13px; margin-top: 4px;">Karolinka Golf Park</p>
        </div>
        <p style="color: #333; font-size: 15px;">Cześć <strong>${playerName}</strong>,</p>
        <p style="color: #555; font-size: 14px;">Kliknij poniższy przycisk, aby zalogować się do swojego profilu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #d5b665; color: #134a56; padding: 14px 36px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
            Zaloguj się
          </a>
        </div>
        <p style="color: #999; font-size: 12px;">Link jest ważny przez 1 godzinę. Jeśli nie prosiłeś o logowanie, zignoruj tę wiadomość.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">Karolinka Golf Park · Kamień Śląski</p>
      </div>
    `,
  })
}
