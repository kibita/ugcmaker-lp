const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com','googlemail.com',
  'yahoo.com','yahoo.co.jp','yahoo.ne.jp','ymail.com','rocketmail.com',
  'hotmail.com','hotmail.co.jp','hotmail.co.uk',
  'outlook.com','outlook.jp','outlook.co.jp',
  'live.com','live.jp','msn.com',
  'icloud.com','me.com','mac.com',
  'aol.com',
  'nifty.com','nifty.ne.jp',
  'biglobe.ne.jp','biglobe.jp',
  'so-net.ne.jp','so-net.jp',
  'ocn.ne.jp','plala.or.jp','plala.ne.jp',
  'goo.ne.jp','excite.co.jp',
  'dion.ne.jp','dti.ne.jp','zaq.ne.jp',
  'docomo.ne.jp','au.com','ezweb.ne.jp',
  'softbank.ne.jp','i.softbank.jp','ai.softbank.jp',
  'vodafone.ne.jp','kddi.com',
  'protonmail.com','proton.me',
  'tutanota.com','tutanota.de',
  'gmx.com','gmx.de','gmx.net',
  'mail.ru','yandex.ru','yandex.com',
  'duck.com',
  'mailinator.com','10minutemail.com','temp-mail.org',
  'guerrillamail.com','throwawaymail.com','maildrop.cc',
  'sharklasers.com','spam4.me','yopmail.com','getairmail.com','mintemail.com',
  'qq.com','163.com','126.com','sina.com','sina.cn','139.com','189.cn',
  'web.de','mail.de','t-online.de',
]);
function isBlockedEmail(v) {
  const m = String(v || '').toLowerCase().match(/@([^\s@]+)$/);
  return !!(m && BLOCKED_EMAIL_DOMAINS.has(m[1]));
}

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

    if (email && isBlockedEmail(email)) {
      return res.status(400).json({
        error: 'invalid_email_domain',
        message: '会社ドメインのメールアドレスをご入力ください（フリーメール・キャリアメール不可）',
      });
    }

    const nowJst = new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const dash = '—';
    const field = (label, value) => ({ type: 'mrkdwn', text: `*${label}*\n${value || dash}` });

    let headerText, blocks;

    if (type === 'contact') {
      headerText = '📮 お問い合わせがありました 📮';
      blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `*${headerText}*` } },
        { type: 'section', fields: [ field('会社名', company), field('お名前', name) ] },
        { type: 'section', fields: [ field('メールアドレス', email ? `<mailto:${email}|${email}>` : null), field('電話番号', phone) ] },
        { type: 'section', fields: [ field('知ったきっかけ', referral) ] },
      ];
      if (message) {
        blocks.push({ type: 'divider' });
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*お問い合わせ内容*\n>>>${message}` } });
      }
      blocks.push({ type: 'context', elements: [ { type: 'mrkdwn', text: `受信日時: ${nowJst} (JST)　|　service.ugcmaker.jp` } ] });
    } else if (type === 'download') {
      headerText = '📥 資料のダウンロード依頼がありました 📥';
      blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `*${headerText}*` } },
        { type: 'section', fields: [ field('会社名', company), field('お名前', name) ] },
        { type: 'section', fields: [ field('メールアドレス', email ? `<mailto:${email}|${email}>` : null), field('電話番号', phone) ] },
        { type: 'section', fields: [ field('知ったきっかけ', referral) ] },
        { type: 'context', elements: [ { type: 'mrkdwn', text: `受信日時: ${nowJst} (JST)　|　service.ugcmaker.jp` } ] },
      ];
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          { color: '#22c55e', blocks },
        ],
      }),
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
