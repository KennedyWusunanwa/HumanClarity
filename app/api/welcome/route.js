import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { name, email } = await request.json();

    if (!email || !name) {
      return Response.json({ error: 'Missing name or email' }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      console.warn('[welcome] Gmail credentials not configured — skipping email.');
      return Response.json({ ok: true, skipped: true });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    const firstName = name.split(' ')[0];

    await transporter.sendMail({
      from: `"HumanClarity AI" <${gmailUser}>`,
      to: email,
      subject: `Welcome to HumanClarity, ${firstName}!`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to HumanClarity</title>
</head>
<body style="margin:0;padding:0;background:#0e0f11;font-family:'Roboto',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f11;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(145deg,rgba(15,19,38,0.97) 0%,rgba(10,11,15,0.98) 100%);border:1px solid rgba(168,199,250,0.18);border-radius:20px;overflow:hidden;">

          <!-- header -->
          <tr>
            <td style="padding:36px 40px 24px;border-bottom:1px solid rgba(168,199,250,0.1);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:40px;height:40px;background:linear-gradient(135deg,#4968ff,#7c3cff);border-radius:10px;"></span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <p style="margin:0;color:#e3e3e3;font-weight:700;font-size:16px;">HumanClarity AI</p>
                    <p style="margin:2px 0 0;color:#a8c7fa;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Natural writing, fast</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#e3e3e3;line-height:1.2;">
                Welcome, ${firstName}! ✦
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#8e918f;line-height:1.65;">
                Your HumanClarity account is ready. You can now humanize AI-written text, save documents, and track your usage — all from one place.
              </p>

              <!-- feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:10px 14px;background:rgba(168,199,250,0.06);border:1px solid rgba(168,199,250,0.1);border-radius:10px;margin-bottom:8px;display:block;">
                    <span style="color:#a8c7fa;font-size:13px;font-weight:600;">✓ Humanize up to 500 words free</span>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 14px;background:rgba(168,199,250,0.06);border:1px solid rgba(168,199,250,0.1);border-radius:10px;">
                    <span style="color:#a8c7fa;font-size:13px;font-weight:600;">✓ Save &amp; manage your documents</span>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 14px;background:rgba(168,199,250,0.06);border:1px solid rgba(168,199,250,0.1);border-radius:10px;">
                    <span style="color:#a8c7fa;font-size:13px;font-weight:600;">✓ Bypass AI detectors like Turnitin</span>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#4968ff,#7c3cff);border-radius:10px;">
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://humanclarity.vercel.app'}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Open HumanClarity →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(168,199,250,0.08);">
              <p style="margin:0;font-size:12px;color:#6b7a94;line-height:1.6;">
                You're receiving this because you created a HumanClarity account with this email address.<br />
                If you didn't sign up, you can safely ignore this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[welcome] Failed to send welcome email:', err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
