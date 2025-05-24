require('dotenv').config();
const BitkubAPI = require('./bitkub');
const axios = require('axios');

const {
  BITKUB_API_KEY,
  BITKUB_API_SECRET,
  BITKUB_SYMBOL,
  TRADE_AMOUNT,
  BUY_PERCENT,
  SELL_PERCENT,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID
} = process.env;

const api = new BitkubAPI(BITKUB_API_KEY, BITKUB_API_SECRET);
let lastBuyPrice = null;
let errorCount = 0;

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message
  });
}

async function canBuy(thbNeeded) {
  try {
    const wallet = await api.wallet();
    return wallet.THB >= thbNeeded;
  } catch (err) {
    console.error("Error fetching wallet:", err.message);
    return false;
  }
}

async function canSell(coin, qtyNeeded) {
  try {
    const wallet = await api.wallet();
    return wallet[coin] >= qtyNeeded;
  } catch (err) {
    console.error("Error fetching wallet:", err.message);
    return false;
  }
}

async function tradeBot() {
  try {
    const ticker = await api.ticker(BITKUB_SYMBOL);
    const lastPrice = ticker.last;
    const coin = BITKUB_SYMBOL.split("_")[0];
    const buyPrice = lastPrice * (1 + parseFloat(BUY_PERCENT) / 100);
    const sellPrice = lastBuyPrice ? lastBuyPrice * (1 + parseFloat(SELL_PERCENT) / 100) : null;

    if (!lastBuyPrice) {
      if (!(await canBuy(TRADE_AMOUNT))) {
        errorCount++;
        await sendTelegram("❌ ไม่สามารถซื้อได้: เงินไม่พอในพอร์ต");
        if (errorCount >= 5) {
          await sendTelegram("⛔ หยุดบอทชั่วคราว 10 นาที (เงินไม่พอ)");
          setTimeout(tradeBot, 600000); // wait 10 mins
          return;
        }
        return setTimeout(tradeBot, 30000);
      }

      await api.placeBuyOrder(BITKUB_SYMBOL, TRADE_AMOUNT / buyPrice, buyPrice);
      lastBuyPrice = buyPrice;
      errorCount = 0;
      await sendTelegram(`✅ ซื้อที่ ${buyPrice.toFixed(3)} บาท`);
    } else if (sellPrice && lastPrice >= sellPrice) {
      const coinQty = TRADE_AMOUNT / lastBuyPrice;
      if (!(await canSell(coin, coinQty))) {
        await sendTelegram("❌ ไม่สามารถขายได้: เหรียญไม่พอในพอร์ต");
        return setTimeout(tradeBot, 30000);
      }

      await api.placeSellOrder(BITKUB_SYMBOL, coinQty, sellPrice);
      await sendTelegram(`💰 ขายที่ ${sellPrice.toFixed(3)} บาท`);
      lastBuyPrice = null;
    }
  } catch (err) {
    console.error("Trade bot error:", err.message);
    await sendTelegram(`⚠️ ERROR: ${err.message}`);
  }

  setTimeout(tradeBot, 30000);
}

tradeBot();
