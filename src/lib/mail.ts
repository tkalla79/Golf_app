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

export async function sendMatchReminder(
  to: string,
  playerName: string,
  opponentName: string,
  groupName: string,
  roundName: string,
  deadline: string,
  daysLeft: number,
  isPlayoff: boolean,
) {
  const recipient = process.env.NODE_ENV === 'production' ? to : (process.env.SMTP_DEV_OVERRIDE || to)
  const urgency = daysLeft <= 2 ? 'PILNE: ' : ''

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
    to: recipient,
    subject: `${urgency}Przypomnienie o meczu - ${roundName}`,
    html: `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #134a56; font-size: 22px; margin: 0;">Don Papa Match Play</h1>
          <p style="color: #888; font-size: 13px; margin-top: 4px;">Karolinka Golf Park</p>
        </div>
        <p style="color: #333; font-size: 15px;">Cze\u015b\u0107 <strong>${playerName}</strong>,</p>
        <p style="color: #555; font-size: 14px;">
          ${daysLeft <= 2
            ? `<strong style="color: #c75b5b;">Zosta\u0142y ${daysLeft} dni</strong> na rozegranie meczu!`
            : `Przypominamy o zbli\u017caj\u0105cym si\u0119 terminie meczu.`
          }
        </p>
        <div style="background: #f8f6f1; border: 1px solid #e8e2d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Przeciwnik:</td><td style="padding: 4px 0;">${opponentName}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">${isPlayoff ? 'Drabinka' : 'Grupa'}:</td><td style="padding: 4px 0;">${groupName}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Runda:</td><td style="padding: 4px 0;">${roundName}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Termin:</td><td style="padding: 4px 0;"><strong style="color: ${daysLeft <= 2 ? '#c75b5b' : '#134a56'};">do ${deadline}</strong></td></tr>
          </table>
        </div>
        <p style="color: #555; font-size: 14px;">Skontaktuj si\u0119 z przeciwnikiem i um\u00f3wcie termin meczu. Powodzenia! \u26f3</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://donpapagolf.pl/grupy" style="background: #d5b665; color: #134a56; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
            Sprawd\u017a tabel\u0119
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">Karolinka Golf Park \u00b7 Kamie\u0144 \u015al\u0105ski</p>
      </div>
    `,
  })
}

export async function sendLoginEmail(to: string, loginUrl: string, playerName: string) {
  const recipient = process.env.NODE_ENV === 'production' ? to : (process.env.SMTP_DEV_OVERRIDE || to)

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
    to: recipient,
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
