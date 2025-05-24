const axios = require('axios');

async function sendTelegram(botToken, chatId, message) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error('Telegram send error:', e.message);
  }
}

module.exports = sendTelegram;
