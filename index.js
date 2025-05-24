require('dotenv').config();
const BitkubAPI = require('./bitkub-api');
const sendTelegram = require('./telegram');
const { saveTrade, getTodayProfit } = require('./summary');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
//const SYMBOL = process.env.SYMBOL || 'DOGE_THB';

const SYMBOL = (process.env.SYMBOL && process.env.SYMBOL !== '***') ? process.env.SYMBOL : 'DOGE_THB';
console.log('Trading symbol:', SYMBOL);

const BUY_PERCENT = parseFloat(process.env.BUY_PERCENT || '2.0');   // ซื้อเมื่อราคาลดลง 2%
const SELL_PERCENT = parseFloat(process.env.SELL_PERCENT || '2.5'); // ขายเมื่อราคาขึ้น 2.5%
const TRADE_AMOUNT = parseFloat(process.env.TRADE_AMOUNT || '300'); // เทรดไม้ละ 300 บาท

if (!API_KEY || !API_SECRET || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const api = new BitkubAPI(API_KEY, API_SECRET);

async function main() {
  try {
    console.log('Trading symbol:', SYMBOL);
    const ticker = await api.getTicker(SYMBOL);

    // เพิ่มการตรวจสอบ ticker และ last price
    if (!ticker) {
      throw new Error(`No ticker data received for symbol ${SYMBOL}`);
    }
    if (typeof ticker.last === 'undefined') {
      console.error("Ticker data:", ticker);
      throw new Error(`Ticker data missing 'last' property for symbol ${SYMBOL}`);
    }

    const price = parseFloat(ticker.last);
    if (isNaN(price)) {
      throw new Error(`Invalid last price received: ${ticker.last}`);
    }

    const wallet = await api.getWallet();
    if (!Array.isArray(wallet)) {
      console.error("Wallet data:", wallet);
      throw new Error("Wallet data is not an array or invalid");
    }

    // แปลงเงิน THB ใน wallet
    const thbBalance = wallet.find(w => w.currency === 'THB')?.balance || 0;

    // คำนวณราคาซื้อและขาย
    const buyPrice = price * (1 - BUY_PERCENT / 100);
    const sellPrice = price * (1 + SELL_PERCENT / 100);

    console.log(`Current price: ${price} THB`);
    console.log(`Buy price target: ${buyPrice.toFixed(4)} THB`);
    console.log(`Sell price target: ${sellPrice.toFixed(4)} THB`);
    console.log(`THB balance: ${thbBalance.toFixed(2)}`);

    if (thbBalance < TRADE_AMOUNT) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ยอดเงินไม่พอสำหรับซื้อ: ${thbBalance.toFixed(2)} THB`);
      return;
    }

    // ส่งคำสั่งซื้อ
    const buyOrder = await api.placeOrder('bid', SYMBOL, buyPrice.toFixed(4), (TRADE_AMOUNT / buyPrice).toFixed(6));

    if (buyOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ซื้อไม่สำเร็จ: ${buyOrder.error.message || JSON.stringify(buyOrder)}`);
      return;
    }

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ซื้อสำเร็จ: ${TRADE_AMOUNT} THB ที่ราคา ${buyPrice.toFixed(4)} THB`);

    // ขายทันที (Auto-Sell)
    const sellAmount = (TRADE_AMOUNT / buyPrice).toFixed(6);
    const sellOrder = await api.placeOrder('ask', SYMBOL, sellPrice.toFixed(4), sellAmount);

    if (sellOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ขายไม่สำเร็จ: ${sellOrder.error.message || JSON.stringify(sellOrder)}`);
      return;
    }

    // บันทึกกำไรคร่าวๆ
    const profit = TRADE_AMOUNT * (SELL_PERCENT - BUY_PERCENT) / 100;

    saveTrade({
      date: new Date().toISOString(),
      symbol: SYMBOL,
      buyPrice: buyPrice.toFixed(4),
      sellPrice: sellPrice.toFixed(4),
      amount: TRADE_AMOUNT,
      profit,
    });

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ขายสำเร็จ กำไรโดยประมาณ: ${profit.toFixed(2)} THB`);

    // สรุปกำไรรวมวันนี้
    const totalProfit = getTodayProfit();
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `กำไรรวมวันนี้: ${totalProfit.toFixed(2)} THB`);

  } catch (e) {
    console.error('Error:', e.message);
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `Error: ${e.message}`);
  }
}

main();
