const axios = require("axios");
const crypto = require("crypto");

// ✅ โหลดค่าจาก GitHub Secrets
const API_KEY = process.env.BITKUB_API_KEY;
const API_SECRET = process.env.BITKUB_API_SECRET;
const SYMBOL = process.env.SYMBOL || "doge_thb";
const BUY_PERCENT = parseFloat(process.env.BUY_PERCENT || "0.01"); // 1%
const SELL_PERCENT = parseFloat(process.env.SELL_PERCENT || "0.012"); // 1.2%
const BUY_AMOUNT = parseFloat(process.env.BUY_AMOUNT || "30"); // บาท

const BASE_URL = "https://api.bitkub.com";

// ⏱️ GET server time
async function getServerTime() {
  const res = await axios.get(`${BASE_URL}/api/v3/servertime`);
  return res.data;
}

// 🔏 Signature generator
function sign(ts, method, path, bodyOrQuery = "") {
  const text = `${ts}${method}${path}${bodyOrQuery}`;
  return crypto.createHmac("sha256", API_SECRET).update(text).digest("hex");
}

// 📦 Get wallet balance
async function getWallet() {
  const ts = await getServerTime();
  const path = "/api/v3/market/wallet";
  const sig = sign(ts, "POST", path, "{}");

  const headers = {
    "X-BTK-APIKEY": API_KEY,
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": sig,
    "Content-Type": "application/json",
  };

  const res = await axios.post(BASE_URL + path, {}, { headers });
  return res.data.result;
}

// 📈 Get ticker price
//async function getTicker(symbol) {
//  const res = await axios.get(`${BASE_URL}/api/market/ticker?sym=${symbol}`);
//  return res.data[symbol].last;
//}


async function getTicker(symbol) {
  const res = await axios.get(`${BASE_URL}/api/market/ticker?sym=${symbol}`);
  console.log("✅ Ticker Response:", res.data);
  return res.data[symbol]?.last;
}


// 🛒 Place buy order
async function placeBid(symbol, amt, rat) {
  const ts = await getServerTime();
  const path = "/api/v3/market/place-bid";
  const body = { sym: symbol, amt, rat, typ: "limit" };
  const sig = sign(ts, "POST", path, JSON.stringify(body));

  const headers = {
    "X-BTK-APIKEY": API_KEY,
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": sig,
    "Content-Type": "application/json",
  };

  const res = await axios.post(BASE_URL + path, body, { headers });
  return res.data;
}

// 🛒 Place sell order
async function placeAsk(symbol, amt, rat) {
  const ts = await getServerTime();
  const path = "/api/v3/market/place-ask";
  const body = { sym: symbol, amt, rat, typ: "limit" };
  const sig = sign(ts, "POST", path, JSON.stringify(body));

  const headers = {
    "X-BTK-APIKEY": API_KEY,
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": sig,
    "Content-Type": "application/json",
  };

  const res = await axios.post(BASE_URL + path, body, { headers });
  return res.data;
}

// 🚀 Main logic
async function runBot() {
  try {
    const wallet = await getWallet();
    const price = await getTicker(SYMBOL);
    const [coin, currency] = SYMBOL.toUpperCase().split("_");

    const thb = wallet["THB"].available;
    const coinAmt = wallet[coin]?.available || 0;

    console.log(`💰 THB: ${thb}, ${coin}: ${coinAmt}, Price: ${price}`);

    // ✅ BUY
    if (thb >= BUY_AMOUNT) {
      const targetBuyPrice = price * (1 - BUY_PERCENT);
      const coinToBuy = +(BUY_AMOUNT / targetBuyPrice).toFixed(3);

      console.log(`🟢 Buying ${coinToBuy} ${coin} at ${targetBuyPrice}`);
      const res = await placeBid(SYMBOL, coinToBuy, Math.floor(targetBuyPrice));
      console.log("✅ Buy order:", res);
    }

    // ✅ SELL
    if (coinAmt > 0.5) {
      const targetSellPrice = price * (1 + SELL_PERCENT);
      console.log(`🔴 Selling ${coinAmt} ${coin} at ${targetSellPrice}`);
      const res = await placeAsk(SYMBOL, +coinAmt.toFixed(3), Math.floor(targetSellPrice));
      console.log("✅ Sell order:", res);
    }
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

runBot();
