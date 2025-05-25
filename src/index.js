const axios = require("axios");
const crypto = require("crypto");

// Env
const API_KEY = process.env.BTK_API_KEY;
const API_SECRET = process.env.BTK_API_SECRET;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOL = process.env.SYMBOL || "DOGE_THB";
const MIN_DROP_PERCENT = parseFloat(process.env.MIN_DROP_PERCENT) || 0.5;
const MIN_RISE_PERCENT = parseFloat(process.env.MIN_RISE_PERCENT) || 0.7;
const AMOUNT_BUY = parseFloat(process.env.AMOUNT_BUY) || 100;

// API
const BASE_URL = "https://api.bitkub.com";

async function getServerTime() {
  const res = await axios.get(`${BASE_URL}/api/v3/servertime`);
  console.log("🕒 Server Time:", res.data);
  return res.data;
}

function signRequest(timestamp, method, path, payload = {}) {
  const body = JSON.stringify(payload);
  const text = `${timestamp}${method}${path}${body}`;
  console.log("🔐 Text to Sign:", text);
  const hmac = crypto.createHmac("sha256", API_SECRET);
  hmac.update(text);
  const signature = hmac.digest("hex");
  console.log("✅ Signature:", signature);
  return signature;
}

async function getCurrentPrice() {
  const res = await axios.get(`${BASE_URL}/api/market/ticker?sym=${SYMBOL}`);
  console.log("💰 Ticker Data:", res.data);
  return res.data[SYMBOL].last;
}

async function getWallet() {
  const ts = await getServerTime();
  const path = "/api/v3/market/wallet";
  const sig = signRequest(ts, "POST", path, { ts });
  const res = await axios.post(`${BASE_URL}${path}`, { ts }, {
    headers: {
      "Content-Type": "application/json",
      "X-BTK-TIMESTAMP": ts,
      "X-BTK-APIKEY": API_KEY,
      "X-BTK-SIGN": sig
    }
  });
  console.log("👛 Wallet:", res.data);
  return res.data;
}

async function placeOrder(type = "buy", price = 0, amount = AMOUNT_BUY) {
  const ts = await getServerTime();
  const path = type === "buy" ? "/api/v3/market/place-bid" : "/api/v3/market/place-ask";
  const payload = {
    sym: SYMBOL,
    amt: amount,
    rat: price,
    typ: "market"
  };
  const sig = signRequest(ts, "POST", path, payload);
  const res = await axios.post(`${BASE_URL}${path}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "X-BTK-TIMESTAMP": ts,
      "X-BTK-APIKEY": API_KEY,
      "X-BTK-SIGN": sig
    }
  });
  console.log(`📦 ${type.toUpperCase()} Order Response:`, res.data);
  return res.data;
}

async function notify(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message
  });
  console.log("📨 Telegram sent:", res.data);
}

async function main() {
  try {
    console.log("🚀 Bot started");
    const currentPrice = await getCurrentPrice();
    const basePrice = currentPrice / (1 - (MIN_DROP_PERCENT / 100));
    const sellTarget = currentPrice * (1 + (MIN_RISE_PERCENT / 100));
    console.log("📉 Buy if <= ", currentPrice);
    console.log("📈 Sell if >= ", sellTarget);

    const wallet = await getWallet();

    const thb = wallet["THB"]?.available || 0;
    const coin = wallet[SYMBOL.split("_")[0]]?.available || 0;
    console.log("💼 THB:", thb, "COIN:", coin);

    if (thb >= AMOUNT_BUY) {
      console.log("💡 Buying condition met");
      const buyRes = await placeOrder("buy", 0, AMOUNT_BUY);
      await notify(`✅ Buy order placed @ ${currentPrice} THB`);
    } else if (coin > 0) {
      console.log("💡 Selling condition met");
      const sellRes = await placeOrder("sell", 0, coin);
      await notify(`✅ Sell order placed @ ${currentPrice} THB`);
    } else {
      console.log("🛑 No action: No THB or coin available");
      await notify(`No trade executed. THB=${thb}, Coin=${coin}`);
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    await notify(`❌ Bot Error: ${err.message}`);
  }
}

main();
