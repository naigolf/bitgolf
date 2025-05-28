const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

// ENV variables
const API_KEY = process.env.BITKUB_API_KEY;
const API_SECRET = process.env.BITKUB_API_SECRET;

const SYMBOL = process.env.SYMBOL || "DOGE_THB";
const BUY_AMOUNT_THB = Number(process.env.BUY_AMOUNT) || 30;
const BUY_TRIGGER_PERCENT = Number(process.env.BUY_PERCENT) || 0.7;
const SELL_TRIGGER_PERCENT = Number(process.env.SELL_PERCENT) || 1.0;

const host = "https://api.bitkub.com";
const basePriceFile = "./base_price.json";

function genSign(apiSecret, payloadString) {
  return crypto.createHmac("sha256", apiSecret).update(payloadString).digest("hex");
}

async function getServerTime() {
  const res = await axios.get(host + "/api/v3/servertime");
  return res.data;
}

async function getTicker(symbol) {
  const res = await axios.get(`${host}/api/v3/market/ticker?sym=${symbol}`);
  const tickerData = res.data[0];
  return tickerData?.last ? Number(tickerData.last) : null;
}

async function getWallet() {
  const ts = await getServerTime();
  const path = "/api/v3/market/wallet";
  const method = "POST";
  const payloadString = ts + method + path + "{}";
  const signature = genSign(API_SECRET, payloadString);

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": signature,
    "X-BTK-APIKEY": API_KEY,
  };

  const res = await axios.post(host + path, {}, { headers });
  return res.data.result;
}

async function placeBid(symbol, amountTHB, rate) {
  const ts = await getServerTime();
  const path = "/api/v3/market/place-bid";

  const body = {
    sym: symbol,
    amt: amountTHB,
    rat: rate,
    typ: "market",
  };

  const payloadString = ts + "POST" + path + JSON.stringify(body);
  const signature = genSign(API_SECRET, payloadString);

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": signature,
    "X-BTK-APIKEY": API_KEY,
  };

  const res = await axios.post(host + path, body, { headers });
  return res.data;
}

async function placeAsk(symbol, amountCoin, rate) {
  const ts = await getServerTime();
  const path = "/api/v3/market/place-ask";

  const body = {
    sym: symbol,
    amt: amountCoin,
    rat: rate,
    typ: "market",
  };

  const payloadString = ts + "POST" + path + JSON.stringify(body);
  const signature = genSign(API_SECRET, payloadString);

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": signature,
    "X-BTK-APIKEY": API_KEY,
  };

  const res = await axios.post(host + path, body, { headers });
  return res.data;
}

// ฟังก์ชันจัดการ basePrice
function readBasePrice() {
  try {
    const data = fs.readFileSync(basePriceFile, "utf8");
    return JSON.parse(data)[SYMBOL] || null;
  } catch {
    return null;
  }
}

function writeBasePrice(price) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(basePriceFile, "utf8"));
  } catch {}
  data[SYMBOL] = price;
  fs.writeFileSync(basePriceFile, JSON.stringify(data, null, 2));
}

// ฟังก์ชันหลัก
async function runBot() {
  try {
    const currentPrice = await getTicker(SYMBOL);
    if (!currentPrice) return console.log("❌ ดึงราคาล่าสุดไม่ได้");

    console.log(`📈 ราคาล่าสุด: ${currentPrice}`);

    const wallet = await getWallet();
    if (!wallet) return console.log("❌ ดึงข้อมูล Wallet ไม่ได้");

    const coin = SYMBOL.split("_")[0];
    const thbBalance = parseFloat(wallet["THB"] || 0);
    const coinBalance = parseFloat(wallet[coin.toUpperCase()] || 0);

    console.log(`💰 THB: ${thbBalance}, ${coin}: ${coinBalance}`);

    const buyPrice = +(currentPrice * (1 - BUY_TRIGGER_PERCENT / 100)).toFixed(6);
    const basePrice = readBasePrice();
    const sellPrice = basePrice ? +(basePrice * (1 + SELL_TRIGGER_PERCENT / 100)).toFixed(6) : null;

    // ซื้อ
    if (currentPrice <= buyPrice && thbBalance >= BUY_AMOUNT_THB) {
      console.log(`⚡️ ซื้อ: ${BUY_AMOUNT_THB} ที่ราคา <= ${buyPrice}`);
      const buyRes = await placeBid(SYMBOL, BUY_AMOUNT_THB, currentPrice);
      console.log("✅ ซื้อสำเร็จ:", buyRes);
      writeBasePrice(currentPrice);
    } else {
      console.log("⏳ ยังไม่ถึงจุดซื้อ");
    }

    // ขาย
    if (basePrice && currentPrice >= sellPrice && coinBalance > 0) {
      console.log(`⚡️ ขาย: ${coinBalance} ที่ราคา >= ${sellPrice} (base: ${basePrice})`);
      const sellRes = await placeAsk(SYMBOL, coinBalance, currentPrice);
      console.log("✅ ขายสำเร็จ:", sellRes);
      writeBasePrice(null); // เคลียร์ basePrice หลังขาย
    } else {
      console.log("⏳ ยังไม่ถึงจุดขาย");
    }

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

runBot();
