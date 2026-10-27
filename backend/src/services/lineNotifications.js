async function notifyAdmin(message) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const recipientId = process.env.LINE_ADMIN_RECIPIENT_ID;

  if (!accessToken || !recipientId) {
    console.info('[LINE notification: not sent]', message);
    return;
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: recipientId,
      messages: [{ type: 'text', text: message.slice(0, 5000) }]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`LINE Messaging API ส่งข้อความไม่สำเร็จ (${response.status}): ${details}`);
  }
}

module.exports = { notifyAdmin };
