const axios = require("axios");
const crypto = require("crypto");

// อ่านค่าจาก GitHub Secrets (ในสภาพแวดล้อมจริง ให้ตั้งเป็น ENV variables)
const API_KEY = process.env.BITKUB_API_KEY;
const API_SECRET = process.env.BITKUB_API_SECRET;

// ตั้งค่า parameter bot
const SYMBOL = process.env.SYMBOL || "DOGE_THB";  // เหรียญที่เทรด
const BUY_AMOUNT_THB = Number(process.env.BUY_AMOUNT) || 30; // 30 บาทต่อไม้
const BUY_TRIGGER_PERCENT = Number(process.env.BUY_PERCENT) || 0.7;  // ซื้อเมื่อราคาลดลง 0.5–1% (ใช้ 0.7% เป็นตัวอย่าง)
const SELL_TRIGGER_PERCENT = Number(process.env.SELL_PERCENT) || 1.0; // ขายเมื่อราคาขึ้น 0.7–1.2% (ใช้ 1% เป็นตัวอย่าง)

const host = "https://api.bitkub.com";

function genSign(apiSecret, payloadString) {
  return crypto.createHmac("sha256", apiSecret).update(payloadString).digest("hex");
}

async function getServerTime() {
  const path = "/api/v3/servertime";
  const res = await axios.get(host + path);
  return res.data; // ค่าตัวเลข timestamp
}

// ฟังก์ชัน getTicker ดึงราคาล่าสุด (ไม่ต้องใช้ signature)
async function getTicker(symbol) {
  const res = await axios.get(`${host}/api/v3/market/ticker?sym=${symbol}`);
  const tickerData = res.data[0];
  return tickerData?.last ? Number(tickerData.last) : null;
}

// ฟังก์ชัน getWallet เช็คยอดเงินบาทและเหรียญ
async function getWallet() {
  const path = "/api/v3/market/wallet";
  const ts = await getServerTime();

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
  return res.data.result; // object เช่น { thb: 12345, doge: 10.123, ... }
}

// ฟังก์ชัน สั่งซื้อ (POST /api/v3/market/place-bid)
async function placeBid(symbol, amountTHB, rate) {
  const path = "/api/v3/market/place-bid";
  const ts = await getServerTime();

  const body = {
    sym: symbol,
    amt: amountTHB,
    rat: rate,
    typ: "limit",
  };

  const method = "POST";
  const payloadString = ts + method + path + JSON.stringify(body);
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

// ฟังก์ชัน สั่งขาย (POST /api/v3/market/place-ask)
async function placeAsk(symbol, amountCoin, rate) {
  const path = "/api/v3/market/place-ask";
  const ts = await getServerTime();

  const body = {
    sym: symbol,
    amt: amountCoin,
    rat: rate,
    typ: "limit",
  };

  const method = "POST";
  const payloadString = ts + method + path + JSON.stringify(body);
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

// ฟังก์ชันหลัก: รัน logic Mini-Scalping
async function runBot() {
  try {
    // ดึงราคาล่าสุด
    const currentPrice = await getTicker(SYMBOL);
    if (!currentPrice) {
      console.log("❌ ไม่สามารถดึงราคาล่าสุดได้");
      return;
    }
    console.log(`📈 ราคาล่าสุดของ ${SYMBOL}: ${currentPrice}`);

    // เช็คยอด wallet
    const wallet = await getWallet();
    if (!wallet) {
      console.log("❌ ไม่สามารถดึงข้อมูล Wallet ได้");
      return;
    }


// Get balances

const coin = SYMBOL.split("_")[0]; // ดึง DOGE จาก DOGE_THB
const thbBalance = parseFloat(wallet["thb"] || 0); // ใช้ตัวพิมพ์เล็ก
const coinBalance = parseFloat(wallet[coin.toLowerCase()] || 0); // เช่น doge


console.log(`💰 ยอด THB: ${thbBalance}, ยอดเหรียญ ${coin}: ${coinBalance}`);



    // กำหนดราคาที่เราจะซื้อ-ขาย โดยเปรียบเทียบกับราคาล่าสุด
    // ซื้อเมื่อราคาลดลง 0.5-1% (สมมติเราจะตั้งซื้อที่ currentPrice * (1 - BUY_TRIGGER_PERCENT/100))
    const buyPrice = +(currentPrice * (1 - BUY_TRIGGER_PERCENT / 100)).toFixed(6);

    // ขายเมื่อราคาขึ้น 0.7-1.2% (สมมติเราจะตั้งขายที่ currentPrice * (1 + SELL_TRIGGER_PERCENT/100))
    const sellPrice = +(currentPrice * (1 + SELL_TRIGGER_PERCENT / 100)).toFixed(6);

    // เช็คว่ามีเงินพอจะซื้อหรือไม่
    if (thbBalance >= BUY_AMOUNT_THB) {
      console.log(`⚡️ สั่งซื้อ: จำนวนเงิน ${BUY_AMOUNT_THB} THB ที่ราคา ${buyPrice}`);
      const buyRes = await placeBid(SYMBOL, BUY_AMOUNT_THB, buyPrice);
      console.log("📦 ผลลัพธ์การสั่งซื้อ:", buyRes);
    } else {
      console.log("❌ เงิน THB ไม่พอสำหรับการซื้อ");
    }

    // เช็คว่ามีเหรียญพอขายหรือไม่ (สมมติขายทั้งหมดที่มี)
    if (coinBalance > 0) {
      console.log(`⚡️ สั่งขาย: จำนวนเหรียญ ${coinBalance} ที่ราคา ${sellPrice}`);
      const sellRes = await placeAsk(SYMBOL, coinBalance, sellPrice);
      console.log("📦 ผลลัพธ์การสั่งขาย:", sellRes);
    } else {
      console.log("❌ ไม่มีเหรียญสำหรับขาย");
    }
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// เรียกใช้งาน bot
runBot();
