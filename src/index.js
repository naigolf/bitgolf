const axios = require('axios');
const crypto = require('crypto');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOL = process.env.SYMBOL || 'THB_DOGE';
const BUY_DROP_PERCENT = parseFloat(process.env.BUY_DROP_PERCENT || '0.8');
const SELL_GAIN_PERCENT = parseFloat(process.env.SELL_GAIN_PERCENT || '1.0');
const TRADE_AMOUNT = parseFloat(process.env.TRADE_AMOUNT || '100');

function sign(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function notify(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️ Telegram config missing.");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    console.log("📢 Telegram notified.");
  } catch (err) {
    console.error("❌ Telegram send failed:", err.message);
  }
}

async function getTickerPrice() {
  try {
    const res = await axios.get('https://api.bitkub.com/api/market/ticker');
    const data = res.data[SYMBOL];
    if (!data) {
      await notify(`❌ ไม่พบราคา symbol ${SYMBOL} ใน ticker`);
      return null;
    }
    console.log(`💰 Last price of ${SYMBOL}: ${data.last}`);
    return data.last;
  } catch (err) {
    await notify(`❌ Error fetching price: ${err.message}`);
    return null;
  }
}

async function getWallet() {
  const ts = Date.now();
  const payload = { ts };
  const sig = sign(payload, API_SECRET);

  try {
    const res = await axios.post('https://api.bitkub.com/api/market/wallet', {
      ...payload,
      sig,
    }, {
      headers: {
        'X-BTK-APIKEY': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    // สำคัญ: ตรวจสอบโครงสร้าง response ว่ามี result หรือไม่
    if (!res.data || !res.data.result) {
      throw new Error('Invalid wallet response');
    }

    console.log("👛 Wallet fetched successfully.");
    return res.data.result;
  } catch (err) {
    await notify(`❌ Error fetching wallet: ${err.message}`);
    return null;
  }
}

async function placeBid(amount) {
  const ts = Date.now();
  const payload = {
    sym: SYMBOL,
    amt: amount,
    rat: 0,
    typ: 'market',
    ts,
  };
  const sig = sign(payload, API_SECRET);

  try {
    const res = await axios.post('https://api.bitkub.com/api/market/v2/place-bid', {
      ...payload,
      sig,
    }, {
      headers: {
        'X-BTK-APIKEY': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Buy order placed: ${JSON.stringify(res.data)}`);
    return res.data;
  } catch (err) {
    await notify(`❌ Buy order failed: ${err.message}`);
    throw err;
  }
}

async function placeAsk(amount) {
  const ts = Date.now();
  const payload = {
    sym: SYMBOL,
    amt: amount,
    rat: 0,
    typ: 'market',
    ts,
  };
  const sig = sign(payload, API_SECRET);

  try {
    const res = await axios.post('https://api.bitkub.com/api/market/v2/place-ask', {
      ...payload,
      sig,
    }, {
      headers: {
        'X-BTK-APIKEY': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Sell order placed: ${JSON.stringify(res.data)}`);
    return res.data;
  } catch (err) {
    await notify(`❌ Sell order failed: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("🤖 Starting Mini-Scalping Bot...");
  const lastPrice = await getTickerPrice();
  if (!lastPrice) {
    console.log("❌ Cannot proceed without price data.");
    return;
  }

  const wallet = await getWallet();
  if (!wallet) {
    console.log("❌ Cannot proceed without wallet data.");
    return;
  }

  const coin = SYMBOL.split('_')[1];
  const thbBalance = wallet['THB'] || 0;
  const coinBalance = wallet[coin] || 0;

  const buyThreshold = lastPrice * (1 - BUY_DROP_PERCENT / 100);
  const sellThreshold = lastPrice * (1 + SELL_GAIN_PERCENT / 100);

  console.log(`🔻 Buy if price <= ${buyThreshold.toFixed(4)} THB`);
  console.log(`🔺 Sell if price >= ${sellThreshold.toFixed(4)} THB`);
  console.log(`💵 THB balance: ${thbBalance.toFixed(2)}`);
  console.log(`📦 ${coin} balance: ${coinBalance.toFixed(6)}`);

  try {
    if (thbBalance >= TRADE_AMOUNT && lastPrice <= buyThreshold) {
      console.log("⚙️ Condition met for BUY");
      await placeBid(TRADE_AMOUNT);
      await notify(`✅ ซื้อ ${coin} จำนวน ${TRADE_AMOUNT} THB ที่ราคา ${lastPrice} THB`);
    } else if (coinBalance > 0 && lastPrice >= sellThreshold) {
      console.log("⚙️ Condition met for SELL");
      await placeAsk(coinBalance);
      await notify(`✅ ขาย ${coin} จำนวน ${coinBalance.toFixed(6)} ที่ราคา ${lastPrice} THB`);
    } else {
      console.log("⏳ ไม่มีคำสั่งซื้อหรือขายในรอบนี้");
    }
  } catch (err) {
    console.error("❌ Error during trade:", err.message);
    await notify(`❌ Bot Error: ${err.message}`);
  }
}

main();
