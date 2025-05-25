const axios = require('axios');
const crypto = require('crypto');

// ENV from GitHub Secrets
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOL = process.env.SYMBOL || 'THB_DOGE';
const BUY_DROP_PERCENT = parseFloat(process.env.BUY_DROP_PERCENT || '0.8');  // 0.8%
const SELL_GAIN_PERCENT = parseFloat(process.env.SELL_GAIN_PERCENT || '1.0'); // 1.0%
const TRADE_AMOUNT = parseFloat(process.env.TRADE_AMOUNT || '100'); // in THB or coin

// --- Utils ---
function sign(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function notify(message) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn("⚠️ Telegram config missing.");
      return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    console.log("📢 Telegram notified:", message);
  } catch (err) {
    console.error("❌ Failed to send Telegram message:", err.message);
  }
}

// --- API calls ---
async function getTickerPrice() {
  try {
    const res = await axios.get('https://api.bitkub.com/api/market/ticker');
    console.log('📊 Raw ticker data:', Object.keys(res.data).slice(0, 5)); // แสดง key แรกๆ เฉยๆ
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
  const res = await axios.post('https://api.bitkub.com/api/market/wallet', {
    ...payload,
    sig,
  }, {
    headers: {
      'X-BTK-APIKEY': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  return res.data.result;
}

async function placeBid(amount) {
  const ts = Date.now();
  const payload = {
    sym: SYMBOL,
    amt: amount,
    rat: 0,
    typ: 'market',
    ts
  };
  const sig = sign(payload, API_SECRET);

  const res = await axios.post('https://api.bitkub.com/api/market/v2/place-bid', {
    ...payload,
    sig
  }, {
    headers: {
      'X-BTK-APIKEY': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

async function placeAsk(amount) {
  const ts = Date.now();
  const payload = {
    sym: SYMBOL,
    amt: amount,
    rat: 0,
    typ: 'market',
    ts
  };
  const sig = sign(payload, API_SECRET);

  const res = await axios.post('https://api.bitkub.com/api/market/v2/place-ask', {
    ...payload,
    sig
  }, {
    headers: {
      'X-BTK-APIKEY': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

// --- Main Strategy ---
async function main() {
  console.log("🤖 Starting Mini-Scalping Bot...");
  const lastPrice = await getTickerPrice();
  if (!lastPrice) return;

  const wallet = await getWallet();
  console.log("👛 Wallet snapshot:", wallet);

  const coin = SYMBOL.split('_')[1];
  const thbBalance = wallet['THB'] || 0;
  const coinBalance = wallet[coin] || 0;

  const buyThreshold = lastPrice * (1 - BUY_DROP_PERCENT / 100);
  const sellThreshold = lastPrice * (1 + SELL_GAIN_PERCENT / 100);

  console.log(`🔻 Buy if <= ${buyThreshold.toFixed(4)} THB`);
  console.log(`🔺 Sell if >= ${sellThreshold.toFixed(4)} THB`);

  try {
    if (thbBalance >= TRADE_AMOUNT && lastPrice <= buyThreshold) {
      const buyRes = await placeBid(TRADE_AMOUNT);
      await notify(`✅ Buy Success: ${coin} at ${lastPrice} THB`);
      console.log("✅ Buy response:", buyRes);
    } else if (coinBalance > 0 && lastPrice >= sellThreshold) {
      const sellRes = await placeAsk(coinBalance);
      await notify(`✅ Sell Success: ${coin} at ${lastPrice} THB`);
      console.log("✅ Sell response:", sellRes);
    } else {
      console.log("⏳ No trade conditions met.");
    }
  } catch (err) {
    console.error("❌ Trade error:", err.message);
    await notify(`❌ Bot Error: ${err.message}`);
  }
}

// Run manually
main();
