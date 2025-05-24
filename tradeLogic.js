const { placeOrder } = require('./bitkub');
const { notify } = require('./telegram');

let lastBuyPrice = null;

async function onPriceUpdate(price) {
  const buyDiff = parseFloat(process.env.BUY_PERCENT);
  const sellDiff = parseFloat(process.env.SELL_PERCENT);

  if (!lastBuyPrice) {
    lastBuyPrice = price;
    console.log(`[INFO] Tracking started at ${price}`);
    return;
  }

  const change = ((price - lastBuyPrice) / lastBuyPrice) * 100;

  if (change <= buyDiff) {
    const res = await placeOrder('buy', price);
    await notify(`✅ ซื้อที่ ${price}\nผลลัพธ์: ${JSON.stringify(res)}`);
    lastBuyPrice = price;
  } else if (change >= sellDiff) {
    const res = await placeOrder('sell', price);
    await notify(`✅ ขายที่ ${price}\nผลลัพธ์: ${JSON.stringify(res)}`);
    lastBuyPrice = price;
  }

  console.log(`[INFO] ราคาปัจจุบัน ${price}, เปลี่ยนแปลง ${change.toFixed(2)}%`);
}

module.exports = { onPriceUpdate };
