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

    const nowJst = new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const dash = '—';
    const field = (label, value) => ({ type: 'mrkdwn', text: `*${label}*\n${value || dash}` });

    let headerText, fallbackText, blocks;

    if (type === 'contact') {
      headerText = '📮 HPからお問い合わせがありました 📮';
      fallbackText = `お問い合わせ: ${company} / ${name}`;
      blocks = [
        { type: 'header', text: { type: 'plain_text', text: headerText, emoji: true } },
        { type: 'section', fields: [ field('会社名', company), field('お名前', name) ] },
        { type: 'section', fields: [ field('メールアドレス', email ? `<mailto:${email}|${email}>` : null), field('知ったきっかけ', referral) ] },
      ];
      if (message) {
        blocks.push({ type: 'divider' });
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*お問い合わせ内容*\n>>>${message}` } });
      }
      blocks.push({ type: 'context', elements: [ { type: 'mrkdwn', text: `🕒 受信日時: ${nowJst} (JST)　|　🌐 service.ugcmaker.jp` } ] });
    } else if (type === 'download') {
      headerText = '📥 HPから資料のダウンロード依頼がありました 📥';
      fallbackText = `資料DL: ${company} / ${name}`;
      blocks = [
        { type: 'header', text: { type: 'plain_text', text: headerText, emoji: true } },
        { type: 'section', fields: [ field('会社名', company), field('お名前', name) ] },
        { type: 'section', fields: [ field('メールアドレス', email ? `<mailto:${email}|${email}>` : null), field('電話番号', phone) ] },
        { type: 'section', fields: [ field('知ったきっかけ', referral) ] },
        { type: 'context', elements: [ { type: 'mrkdwn', text: `🕒 受信日時: ${nowJst} (JST)　|　🌐 service.ugcmaker.jp` } ] },
      ];
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fallbackText, blocks }),
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
