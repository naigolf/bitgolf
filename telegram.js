const axios = require('axios');

module.exports = async function sendTelegram(token, chatId, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error.message);
  }
};
