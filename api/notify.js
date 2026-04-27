export default async function handler(req, res) {
  const allowedOrigins = ['https://corp.ugcmaker.jp', 'https://service.ugcmaker.jp'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (!SLACK_WEBHOOK_URL) {
    return res.status(500).json({ error: 'Slack webhook not configured' });
  }

  try {
    const { type, company, name, email, phone, message, referral } = req.body;

    let slackText;
    if (type === 'contact') {
      slackText = [
        ':postbox: *HPからお問い合わせがありました* :postbox:',
        '------------------------------------------------',
        `*会社名：* ${company}`,
        `*お名前：* ${name}`,
        `*メールアドレス：* ${email}`,
        message ? `*お問い合わせ内容：*\n${message}` : '',
        referral ? `*知ったきっかけ：* ${referral}` : '',
      ].filter(Boolean).join('\n');
    } else if (type === 'download') {
      slackText = [
        ':postbox: *HPから資料のダウンロード依頼がありました* :postbox:',
        '------------------------------------------------',
        `*会社名：* ${company}`,
        `*お名前：* ${name}`,
        `*メールアドレス：* ${email}`,
        phone ? `*電話番号：* ${phone}` : '',
        referral ? `*知ったきっかけ：* ${referral}` : '',
      ].filter(Boolean).join('\n');
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackText }),
    });

    if (!slackRes.ok) {
      throw new Error(`Slack responded with ${slackRes.status}`);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Slack notify error:', e);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
