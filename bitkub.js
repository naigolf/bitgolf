// bitkub.js
const axios = require("axios");
const crypto = require("crypto");

const API_URL = "https://api.bitkub.com";
const API_KEY = process.env.BITKUB_API_KEY;
const API_SECRET = process.env.BITKUB_API_SECRET;

function signRequest(path, method, body = {}) {
  const ts = Date.now();
  const payload = method === "GET" ? "" : JSON.stringify(body);
  const message = `${ts}${method}${path}${payload}`;
  const sig = crypto
    .createHmac("sha256", API_SECRET)
    .update(message)
    .digest("hex");
  return { ts, sig };
}

async function getWallet() {
  const path = "/api/v3/market/wallet";
  const { ts, sig } = signRequest(path, "POST", { ts: Date.now() });

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-BTK-APIKEY": API_KEY,
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": sig,
  };

  const response = await axios.post(`${API_URL}${path}`, { ts }, { headers });
  return response.data;
}

async function placeOrder({ side = "bid", sym, amt, typ = "market", rat = 0 }) {
  const path = `/api/v3/market/place-${side}`;
  const ts = Date.now();
  const body = { sym, amt, rat, typ, ts };
  const { sig } = signRequest(path, "POST", body);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-BTK-APIKEY": API_KEY,
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": sig,
  };

  const response = await axios.post(`${API_URL}${path}`, { ...body }, { headers });
  return response.data;
}

module.exports = { getWallet, placeOrder };
