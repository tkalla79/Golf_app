import nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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
  const safeName = escapeHtml(playerName)
  const safeOpponent = escapeHtml(opponentName)
  const safeGroup = escapeHtml(groupName)
  const safeRound = escapeHtml(roundName)
  const safeDeadline = escapeHtml(deadline)

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
        <p style="color: #333; font-size: 15px;">Cze\u015b\u0107 <strong>${safeName}</strong>,</p>
        <p style="color: #555; font-size: 14px;">
          ${daysLeft <= 2
            ? `<strong style="color: #c75b5b;">Zosta\u0142y ${daysLeft} dni</strong> na rozegranie meczu!`
            : `Przypominamy o zbli\u017caj\u0105cym si\u0119 terminie meczu.`
          }
        </p>
        <div style="background: #f8f6f1; border: 1px solid #e8e2d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Przeciwnik:</td><td style="padding: 4px 0;">${safeOpponent}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">${isPlayoff ? 'Liga' : 'Grupa'}:</td><td style="padding: 4px 0;">${safeGroup}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Runda:</td><td style="padding: 4px 0;">${safeRound}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Termin:</td><td style="padding: 4px 0;"><strong style="color: ${daysLeft <= 2 ? '#c75b5b' : '#134a56'};">do ${safeDeadline}</strong></td></tr>
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

export async function sendMatchConfirmation(
  to: string,
  playerName: string,
  opponentName: string,
  groupName: string,
  roundName: string,
  matchDate: string,
  isPlayoff = false,
) {
  const groupLabel = isPlayoff ? 'Liga' : 'Grupa'
  const recipient = process.env.NODE_ENV === 'production' ? to : (process.env.SMTP_DEV_OVERRIDE || to)
  const safeName = escapeHtml(playerName)
  const safeOpponent = escapeHtml(opponentName)
  const safeGroup = escapeHtml(groupName)
  const safeRound = escapeHtml(roundName)
  const safeDate = escapeHtml(matchDate)

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
    to: recipient,
    subject: `Mecz potwierdzony - ${roundName}`,
    html: `
      <div style="font-family: 'Lato', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #134a56; font-size: 22px; margin: 0;">Don Papa Match Play</h1>
          <p style="color: #888; font-size: 13px; margin-top: 4px;">Karolinka Golf Park</p>
        </div>
        <p style="color: #333; font-size: 15px;">Cześć <strong>${safeName}</strong>,</p>
        <p style="color: #555; font-size: 14px;">Twój mecz został potwierdzony!</p>
        <div style="background: #f8f6f1; border: 1px solid #e8e2d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Przeciwnik:</td><td style="padding: 4px 0;">${safeOpponent}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">${groupLabel}:</td><td style="padding: 4px 0;">${safeGroup}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Runda:</td><td style="padding: 4px 0;">${safeRound}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Termin:</td><td style="padding: 4px 0;"><strong style="color: #134a56;">${safeDate}</strong></td></tr>
          </table>
        </div>
        <p style="color: #555; font-size: 14px;">Godzina rozpoczęcia to start z tee box. Powodzenia! ⛳</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://donpapagolf.pl/grupy" style="background: #d5b665; color: #134a56; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
            Sprawdź tabelę
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">Karolinka Golf Park · Kamień Śląski</p>
      </div>
    `,
  })
}

export async function sendTeeTimeReminder(
  playerEmails: string[],
  receptionEmail: string,
  matchDetails: {
    player1Name: string
    player2Name: string
    teeTime: string
    groupName: string
    roundName: string
  },
): Promise<string[]> {
  const { player1Name, player2Name, teeTime, groupName, roundName } = matchDetails
  const errors: string[] = []
  const safeP1 = escapeHtml(player1Name)
  const safeP2 = escapeHtml(player2Name)
  const safeTee = escapeHtml(teeTime)
  const safeGroup = escapeHtml(groupName)
  const safeRound = escapeHtml(roundName)

  // Email to players (isolated per-email error handling)
  for (const email of playerEmails) {
    try {
      const recipient = process.env.NODE_ENV === 'production' ? email : (process.env.SMTP_DEV_OVERRIDE || email)
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
        to: recipient,
        subject: `Przypomnienie o meczu - ${teeTime}`,
        html: `
          <div style="font-family: 'Lato', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #134a56; font-size: 22px; margin: 0;">Don Papa Match Play</h1>
              <p style="color: #888; font-size: 13px; margin-top: 4px;">Karolinka Golf Park</p>
            </div>
            <p style="color: #333; font-size: 15px;">Przypomnienie o nadchodzącym meczu!</p>
            <div style="background: #f8f6f1; border: 1px solid #e8e2d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px; color: #555;">
                <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Mecz:</td><td style="padding: 4px 0;">${safeP1} vs ${safeP2}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Grupa:</td><td style="padding: 4px 0;">${safeGroup}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Runda:</td><td style="padding: 4px 0;">${safeRound}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Tee time:</td><td style="padding: 4px 0;"><strong style="color: #134a56;">${safeTee}</strong></td></tr>
              </table>
            </div>
            <p style="color: #555; font-size: 14px;">Godzina rozpoczęcia to start z tee box. Powodzenia! ⛳</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #bbb; font-size: 11px; text-align: center;">Karolinka Golf Park · Kamień Śląski</p>
          </div>
        `,
      })
    } catch (err) {
      errors.push(`Player ${email}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // Email to reception (always send, even if player emails failed)
  try {
    const recEmail = process.env.NODE_ENV === 'production' ? receptionEmail : (process.env.SMTP_DEV_OVERRIDE || receptionEmail)
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Don Papa Match Play <noreply@donpapagolf.pl>',
      to: recEmail,
      subject: `Rezerwacja tee time - ${teeTime} - Don Papa Match Play`,
      html: `
        <div style="font-family: 'Lato', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #134a56; font-size: 22px; margin: 0;">Don Papa Match Play</h1>
            <p style="color: #888; font-size: 13px; margin-top: 4px;">Rezerwacja tee time</p>
          </div>
          <p style="color: #333; font-size: 15px;">Prośba o rezerwację tee time:</p>
          <div style="background: #f8f6f1; border: 1px solid #e8e2d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px; color: #555;">
              <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Gracze:</td><td style="padding: 4px 0;">${safeP1}, ${safeP2}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Liga:</td><td style="padding: 4px 0;">${safeGroup} - ${safeRound}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 700; color: #134a56;">Tee time:</td><td style="padding: 4px 0;"><strong style="color: #134a56;">${safeTee}</strong></td></tr>
            </table>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #bbb; font-size: 11px; text-align: center;">Don Papa Match Play · Karolinka Golf Park</p>
        </div>
      `,
    })
  } catch (err) {
    errors.push(`Reception: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  if (errors.length > 0) {
    console.error('Tee time reminder errors:', errors)
  }

  return errors
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
        <p style="color: #333; font-size: 15px;">Cześć <strong>${escapeHtml(playerName)}</strong>,</p>
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
