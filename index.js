async function main() {
  try {
    console.log('Trading symbol:', SYMBOL);
    const ticker = await api.getTicker(SYMBOL);

    if (!ticker) throw new Error(`No ticker data for ${SYMBOL}`);
    if (typeof ticker.last === 'undefined') throw new Error(`Ticker missing last price`);

    const price = parseFloat(ticker.last);
    if (isNaN(price)) throw new Error(`Invalid last price: ${ticker.last}`);

    const wallet = await api.getWallet();
    // wallet เป็น object ไม่ใช่ array
    const thbBalance = wallet['THB'] || 0;

    const buyPrice = price * (1 - BUY_PERCENT / 100);
    const sellPrice = price * (1 + SELL_PERCENT / 100);

    console.log(`Current price: ${price} THB`);
    console.log(`Buy target: ${buyPrice.toFixed(4)} THB`);
    console.log(`Sell target: ${sellPrice.toFixed(4)} THB`);
    console.log(`THB balance: ${thbBalance.toFixed(2)}`);

    if (thbBalance < TRADE_AMOUNT) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ยอดเงินไม่พอสำหรับซื้อ: ${thbBalance.toFixed(2)} THB`);
      return;
    }

    // ปรับฟังก์ชัน placeOrder ให้ส่งพารามิเตอร์ตาม API จริง
    const buyOrder = await api.placeOrder('bid', SYMBOL, buyPrice.toFixed(4), (TRADE_AMOUNT / buyPrice).toFixed(6));

    if (buyOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ซื้อไม่สำเร็จ: ${buyOrder.error.message || JSON.stringify(buyOrder)}`);
      return;
    }

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ซื้อสำเร็จ: ${TRADE_AMOUNT} THB ที่ราคา ${buyPrice.toFixed(4)} THB`);

    const sellAmount = (TRADE_AMOUNT / buyPrice).toFixed(6);
    const sellOrder = await api.placeOrder('ask', SYMBOL, sellPrice.toFixed(4), sellAmount);

    if (sellOrder.error) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ขายไม่สำเร็จ: ${sellOrder.error.message || JSON.stringify(sellOrder)}`);
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

    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `ขายสำเร็จ กำไรโดยประมาณ: ${profit.toFixed(2)} THB`);

    const totalProfit = getTodayProfit();
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `กำไรรวมวันนี้: ${totalProfit.toFixed(2)} THB`);

  } catch (e) {
    console.error('Error:', e.message);
    await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `Error: ${e.message}`);
  }
}
