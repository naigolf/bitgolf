require('dotenv').config();
const BitkubAPI = require('./bitkub-api');
const sendTelegram = require('./telegram');
const { saveTrade, getTodayProfit } = require('./summary');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOL = 'THB_DOGE';  // ✅ ใส่ไว้ด้านบนสุด
const BUY_PERCENT = parseFloat(process.env.BUY_PERCENT || '2.0');   // ซื้อเมื่อราคาลดลง %
const SELL_PERCENT = parseFloat(process.env.SELL_PERCENT || '2.5'); // ขายเมื่อราคาขึ้น %
const TRADE_AMOUNT = parseFloat(process.env.TRADE_AMOUNT || '300'); // เทรดต่อไม้

// ตรวจสอบตัวแปรสำคัญ
if (!API_KEY || !API_SECRET || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Missing required environment variables.');
  process.exit(1);
}

const api = new BitkubAPI(API_KEY, API_SECRET);

async function main() {
  try {
    console.log('🚀 Start main function');
    console.log('📈 Trading symbol:', SYMBOL);

    const ticker = await api.getTicker(SYMBOL);
    //const ticker = await api.getTicker();
    console.log('Available symbols:', Object.keys(ticker));
    if (!ticker || typeof ticker.last === 'undefined') throw new Error(`Invalid ticker data for ${SYMBOL}`);

    const price = parseFloat(ticker.last);
    if (isNaN(price)) throw new Error(`Invalid last price: ${ticker.last}`);

    const wallet = await api.getWallet();
   // console.log('Raw wallet response:', wallet);
   // const thbBalance = wallet['THB'] || 0;
   const thbBalance = (wallet && wallet.result && wallet.result.THB) || 0;

    const buyPrice = price * (1 - BUY_PERCENT / 100);
    const sellPrice = price * (1 + SELL_PERCENT / 100);

    console.log(`💰 Current price: ${price} THB`);
    console.log(`🎯 Buy target: ${buyPrice.toFixed(4)} THB`);
    console.log(`🎯 Sell target: ${sellPrice.toFixed(4)} THB`);
    console.log(`🏦 THB balance: ${thbBalance.toFixed(2)}`);

    if (thbBalance < TRADE_AMOUNT) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `❗️ยอดเงินไม่พอสำหรับซื้อ: ${thbBalance.toFixed(2)} THB`);
      return;
    }

    //const buyAmount = parseFloat((TRADE_AMOUNT / buyPrice).toFixed(6));
    //const buyAmount = (TRADE_AMOUNT / buyPrice).toFixed(6);


    const feeRate = 0.0025;  // ค่าธรรมเนียม 0.25%
    const netAmount = TRADE_AMOUNT * (1 - feeRate);  // หักค่าธรรมเนียมล่วงหน้า
    const buyAmount = (netAmount / buyPrice).toFixed(6);


    
    //const buyOrder = await api.placeOrder('bid', SYMBOL, buyPrice.toFixed(4), buyAmount);

    const buyOrder = await api.placeOrder('bid', SYMBOL, buyPrice.toFixed(4), buyAmount);


    
    if (buyOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `❌ ซื้อไม่สำเร็จ: ${buyOrder.error.message || JSON.stringify(buyOrder)}`);
      return;
    }

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `✅ ซื้อสำเร็จ: ${TRADE_AMOUNT} THB ที่ราคา ${buyPrice.toFixed(4)} THB`);

    const sellAmount = buyAmount;
    const sellOrder = await api.placeOrder('ask', SYMBOL, sellPrice.toFixed(4), sellAmount);

    if (sellOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `❌ ขายไม่สำเร็จ: ${sellOrder.error.message || JSON.stringify(sellOrder)}`);
      return;
    }

    const profit = TRADE_AMOUNT * (SELL_PERCENT - BUY_PERCENT) / 100;

    saveTrade({
      date: new Date().toISOString(),
      symbol: SYMBOL,
      buyPrice: buyPrice.toFixed(4),
      sellPrice: sellPrice.toFixed(4),
      amount: TRADE_AMOUNT,
      profit,
    });

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `✅ ขายสำเร็จ กำไรโดยประมาณ: ${profit.toFixed(2)} THB`);

    const totalProfit = getTodayProfit();
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `📊 กำไรรวมวันนี้: ${totalProfit.toFixed(2)} THB`);

  } catch (e) {
    console.error('❌ Error:', e.message);
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `🔥 Error: ${e.message}`);
  }
}

main();
