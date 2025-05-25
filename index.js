// index.js
const { getWallet, placeOrder } = require("./bitkub");
const { sendTelegramMessage } = require("./telegram");

async function main() {
  console.log("🚀 Start Trading Bot");

  try {
    const wallet = await getWallet();
    console.log("💰 Wallet:", wallet);

    // ตัวอย่างการซื้อ USDT
    const result = await placeOrder({
      side: "bid", // หรือ "ask"
      sym: "THB_USDT",
      amt: 100, // ซื้อ 100 บาท
      typ: "market",
    });

    console.log("✅ Order placed:", result);
    await sendTelegramMessage(`✅ Order Placed: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error("❌ Error:", err.message || err);
    await sendTelegramMessage(`❌ Error: ${err.message}`);
  }
}

main();
