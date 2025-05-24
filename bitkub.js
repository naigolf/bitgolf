const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://api.bitkub.com';

function sign(data) {
  const hmac = crypto.createHmac('sha256', process.env.API_SECRET);
  return hmac.update(data).digest('hex');
}

async function placeOrder(side, rate) {
  const ts = Date.now();
  const sym = process.env.SYMBOL;
  const amt = Number(process.env.TRADE_AMOUNT);

  const data = {
    sym, amt, rate, typ: 'limit', ts, sig: ''
  };

  const qs = `amt=${amt}&rate=${rate}&sym=${sym}&ts=${ts}&typ=limit`;
  data.sig = sign(qs);

  const path = `/api/market/place-${side}`;

  try {
    const res = await axios.post(`${BASE_URL}${path}`, data, {
      headers: { 'X-BTK-APIKEY': process.env.API_KEY }
    });
    return res.data;
  } catch (err) {
    return err.response?.data || err.message;
  }
}

module.exports = { placeOrder };
