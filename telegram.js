const axios = require('axios');
require('dotenv').config();

function notify(msg) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  return axios.post(url, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: msg
  });
}

module.exports = { notify };
