const { getWallet, placeBid, placeAsk, getTicker } = require('./bitkub');
const { sendTelegramMessage } = require('./telegram');

const SYMBOL = 'THB_DOGE';
const BUY_THRESHOLD = -0.005; // -0.5%
const SELL_THRESHOLD = 0.007; // 0.7%

let lastPrice = null;

async function executeStrategy() {
  const ticker = await getTicker(SYMBOL);
  const currentPrice = ticker.last;

  if (!lastPrice) {
    lastPrice = currentPrice;
    return;
  }

  const priceChange = (currentPrice - lastPrice) / lastPrice;

  if (priceChange <= BUY_THRESHOLD) {
    const wallet = await getWallet();
    const thbBalance = wallet.THb.available;
    const amountToSpend = Math.min(thbBalance, 100); // จำกัดการใช้ทุน
    const bidResult = await placeBid(SYMBOL, amountToSpend);
    await sendTelegramMessage(`ซื้อ DOGE ที่ราคา ${currentPrice} บาท จำนวน ${amountToSpend} บาท`);
    lastPrice = currentPrice;
  } else if (priceChange >= SELL_THRESHOLD) {
    const wallet = await getWallet();
    const dogeBalance = wallet.DOGE.available;
    const askResult = await placeAsk(SYMBOL, dogeBalance);
    await sendTelegramMessage(`ขาย DOGE ที่ราคา ${currentPrice} บาท จำนวน ${dogeBalance} DOGE`);
    lastPrice = currentPrice;
  }
}

module.exports = { executeStrategy };
