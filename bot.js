require('dotenv').config();
const axios = require('axios');
const CryptoJS = require('crypto-js');

// ตั้งค่าจาก .env
const {
  BITKUB_API_KEY,
  BITKUB_API_SECRET,
  TRADE_SYMBOL,
  BUY_DIP_PERCENT,
  SELL_GAIN_PERCENT,
  TRADE_AMOUNT
} = process.env;

const BASE_URL = 'https://api.bitkub.com';

// ฟังก์ชันสร้างลายเซ็น
/*
function generateSignature(payload) {
  return CryptoJS.HmacSHA256(JSON.stringify(payload), BITKUB_API_SECRET).toString();
}
*/
function generateSignature(payload) {
  // แปลง payload เป็น string ถ้ายังไม่ใช่
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // สร้าง signature ด้วย crypto-js
  const signature = CryptoJS.HmacSHA256(
    payloadString,
    BITKUB_API_SECRET
  ).toString(CryptoJS.enc.Hex);
  
  return signature;
}

// ตรวจสอบยอดเงินใน wallet
/*
async function checkWalletBalance() {
  try {
    const ts = Date.now();
    const payload = { ts };
    const signature = generateSignature(payload);

    const response = await axios.post(`${BASE_URL}/api/market/wallet`, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error checking wallet:', error.response?.data || error.message);
    throw error;
  }
}
*/

async function checkWalletBalance() {
  try {
    const ts = Date.now();
    const payload = { ts };
    const signature = generateSignature(payload);

    const response = await axios.post(`${BASE_URL}/api/market/wallet`, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error checking wallet:', error.response?.data || error.message);
    throw error;
  }
}

// ตรวจสอบราคาปัจจุบัน
async function getCurrentPrice() {
  try {
    const response = await axios.get(`${BASE_URL}/api/market/ticker?sym=${TRADE_SYMBOL}`);
    return response.data[TRADE_SYMBOL].last;
  } catch (error) {
    console.error('Error getting price:', error.message);
    throw error;
  }
}

// สั่งซื้อ
async function placeBuyOrder(price) {
  try {
    const amount = (TRADE_AMOUNT / price).toFixed(2);
    const ts = Date.now();
    const payload = {
      sym: TRADE_SYMBOL,
      amt: amount,
      rat: price,
      typ: 'limit',
      ts
    };

    const signature = generateSignature(payload);

    const response = await axios.post(`${BASE_URL}/api/market/place-bid`, payload, {
      headers: {
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error placing buy order:', error.response?.data || error.message);
    throw error;
  }
}

// สั่งขาย
async function placeSellOrder(amount, price) {
  try {
    const ts = Date.now();
    const payload = {
      sym: TRADE_SYMBOL,
      amt: amount,
      rat: price,
      typ: 'limit',
      ts
    };

    const signature = generateSignature(payload);

    const response = await axios.post(`${BASE_URL}/api/market/place-ask`, payload, {
      headers: {
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error placing sell order:', error.response?.data || error.message);
    throw error;
  }
}

// ตรวจสอบคำสั่งซื้อที่เปิดอยู่
async function checkOpenOrders() {
  try {
    const ts = Date.now();
    const payload = { sym: TRADE_SYMBOL, ts };
    const signature = generateSignature(payload);

    const response = await axios.post(`${BASE_URL}/api/market/my-open-orders`, payload, {
      headers: {
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error checking open orders:', error.response?.data || error.message);
    throw error;
  }
}

// กลยุทธ์ Mini-Scalping
async function executeStrategy() {
  try {
    // ตรวจสอบยอดเงิน
    const wallet = await checkWalletBalance();
    console.log('Wallet Balance:', wallet.THB, 'THB');
    
    if (wallet.THB < TRADE_AMOUNT) {
      console.log('ไม่มียอดเงินเพียงพอสำหรับการเทรด');
      return;
    }

    // ตรวจสอบคำสั่งซื้อที่เปิดอยู่
    const openOrders = await checkOpenOrders();
    if (openOrders.length > 0) {
      console.log('มีคำสั่งซื้อที่ยังไม่เสร็จสิ้น รอการดำเนินการ...');
      return;
    }

    // ตรวจสอบราคาปัจจุบัน
    const currentPrice = await getCurrentPrice();
    console.log('Current Price:', currentPrice, 'THB');

    // ตรวจสอบว่ามี DOGE ในพอร์ตหรือไม่
    const dogeBalance = wallet.DOGE || 0;
    
    if (dogeBalance > 0) {
      // ถ้ามี DOGE ให้ตรวจสอบเพื่อขาย
      const sellPrice = (currentPrice * (1 + (SELL_GAIN_PERCENT/100))).toFixed(6);
      console.log(`Attempting to sell DOGE at ${sellPrice} THB (${SELL_GAIN_PERCENT}% gain)`);
      
      const sellResult = await placeSellOrder(dogeBalance, sellPrice);
      console.log('Sell Order Result:', sellResult);
    } else {
      // ถ้าไม่มี DOGE ให้ตรวจสอบเพื่อซื้อ
      const buyPrice = (currentPrice * (1 - (BUY_DIP_PERCENT/100))).toFixed(6);
      console.log(`Attempting to buy DOGE at ${buyPrice} THB (${BUY_DIP_PERCENT}% dip)`);
      
      const buyResult = await placeBuyOrder(buyPrice);
      console.log('Buy Order Result:', buyResult);
    }
  } catch (error) {
    console.error('Strategy execution error:', error);
  }
}

// เรียกใช้งาน
(async () => {
  console.log('Starting DOGE Mini-Scalping Bot...');
  console.log('Configuration:', {
    symbol: TRADE_SYMBOL,
    buyDip: `${BUY_DIP_PERCENT}%`,
    sellGain: `${SELL_GAIN_PERCENT}%`,
    amount: `${TRADE_AMOUNT} THB`
  });
  
  await executeStrategy();
})();
