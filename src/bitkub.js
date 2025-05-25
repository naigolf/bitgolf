const axios = require('axios');
const crypto = require('crypto');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = 'https://api.bitkub.com';

async function getServerTime() {
  const res = await axios.get(`${BASE_URL}/api/v3/servertime`);
  return res.data;
}

function signMessage(ts, method, path, body = '') {
  const message = `${ts}${method}${path}${body}`;
  return crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');
}

async function getWallet() {
  const ts = await getServerTime();
  const path = '/api/v3/market/wallet';
  const sig = signMessage(ts, 'POST', path);
  const headers = {
    'X-BTK-APIKEY': API_KEY,
    'X-BTK-TIMESTAMP': ts,
    'X-BTK-SIGN': sig,
    'Content-Type': 'application/json',
  };
  const res = await axios.post(`${BASE_URL}${path}`, {}, { headers });
  return res.data;
}

async function placeBid(sym, amt) {
  const ts = await getServerTime();
  const path = '/api/v3/market/place-bid';
  const body = JSON.stringify({ sym, amt, rat: 0, typ: 'market' });
  const sig = signMessage(ts, 'POST', path, body);
  const headers = {
    'X-BTK-APIKEY': API_KEY,
    'X-BTK-TIMESTAMP': ts,
    'X-BTK-SIGN': sig,
    'Content-Type': 'application/json',
  };
  const res = await axios.post(`${BASE_URL}${path}`, JSON.parse(body), { headers });
  return res.data;
}

async function placeAsk(sym, amt) {
  const ts = await getServerTime();
  const path = '/api/v3/market/place-ask';
  const body = JSON.stringify({ sym, amt, rat: 0, typ: 'market' });
  const sig = signMessage(ts, 'POST', path, body);
  const headers = {
    'X-BTK-APIKEY': API_KEY,
    'X-BTK-TIMESTAMP': ts,
    'X-BTK-SIGN': sig,
    'Content-Type': 'application/json',
  };
  const res = await axios.post(`${BASE_URL}${path}`, JSON.parse(body), { headers });
  return res.data;
}

async function getTicker(sym) {
  const res = await axios.get(`${BASE_URL}/api/market/ticker?sym=${sym}`);
  return res.data[sym];
}

module.exports = { getWallet, placeBid, placeAsk, getTicker };
