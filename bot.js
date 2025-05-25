require('dotenv').config();
const axios = require('axios');
const CryptoJS = require('crypto-js');

// ตั้งค่าจาก .env
const {
  BITKUB_API_KEY,
  BITKUB_API_SECRET,
  TRADE_SYMBOL = 'THB_DOGE',
  BUY_DIP_PERCENT = 2,
  SELL_GAIN_PERCENT = 3,
  TRADE_AMOUNT = 50
} = process.env;

const BASE_URL = 'https://api.bitkub.com';

// ฟังก์ชันดึงเวลาปัจจุบันจากเซิร์ฟเวอร์ Bitkub
async function getServerTime() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/servertime`);
    return response.data;
  } catch (error) {
    console.error('Error getting server time:', error.message);
    return Date.now(); // Fallback to local time if API fails
  }
}

// ฟังก์ชันสร้างลายเซ็นแบบใหม่ตามเอกสาร Bitkub
async function generateSignature(httpMethod, endpoint, payload = null) {
  const timestamp = await getServerTime();
  let message = `${timestamp}${httpMethod}${endpoint}`;
  
  if (httpMethod === 'POST' && payload) {
    message += JSON.stringify(payload);
  } else if (httpMethod === 'GET' && payload) {
    const queryString = new URLSearchParams(payload).toString();
    if (queryString) {
      message += `?${queryString}`;
    }
  }
  
  return {
    signature: CryptoJS.HmacSHA256(message, BITKUB_API_SECRET).toString(CryptoJS.enc.Hex),
    timestamp: timestamp
  };
}

// ตรวจสอบยอดเงินใน wallet
async function checkWalletBalance() {
  try {
    const endpoint = '/api/v3/market/wallet';
    const { signature, timestamp } = await generateSignature('GET', endpoint);
    
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature,
        'X-BTK-TIMESTAMP': timestamp.toString()
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error checking wallet:', error.response?.data || error.message);
    throw error;
  }
}

// ตรวจสอบราคาปัจจุบัน (public API ไม่ต้องใช้ signature)
async function getCurrentPrice(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/market/ticker?sym=${symbol}`);
    return response.data[symbol].last;
  } catch (error) {
    console.error('Error getting price:', error.message);
    throw error;
  }
}

// สั่งซื้อ
async function placeBuyOrder(symbol, amount, price) {
  try {
    const endpoint = '/api/v3/market/place-bid';
    const payload = {
      sym: symbol.toLowerCase(),
      amt: amount,
      rat: price,
      typ: 'limit'
    };
    
    const { signature, timestamp } = await generateSignature('POST', endpoint, payload);
    
    const response = await axios.post(`${BASE_URL}${endpoint}`, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature,
        'X-BTK-TIMESTAMP': timestamp.toString()
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error placing buy order:', error.response?.data || error.message);
    throw error;
  }
}

// สั่งขาย
async function placeSellOrder(symbol, amount, price) {
  try {
    const endpoint = '/api/v3/market/place-ask';
    const payload = {
      sym: symbol.toLowerCase(),
      amt: amount,
      rat: price,
      typ: 'limit'
    };
    
    const { signature, timestamp } = await generateSignature('POST', endpoint, payload);
    
    const response = await axios.post(`${BASE_URL}${endpoint}`, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature,
        'X-BTK-TIMESTAMP': timestamp.toString()
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error placing sell order:', error.response?.data || error.message);
    throw error;
  }
}

// ตรวจสอบคำสั่งซื้อที่เปิดอยู่
async function checkOpenOrders(symbol) {
  try {
    const endpoint = '/api/v3/market/my-open-orders';
    const payload = { sym: symbol };
    const { signature, timestamp } = await generateSignature('GET', endpoint, payload);
    
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: payload,
      headers: {
        'Accept': 'application/json',
        'X-BTK-APIKEY': BITKUB_API_KEY,
        'X-BTK-SIGN': signature,
        'X-BTK-TIMESTAMP': timestamp.toString()
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
    console.log('Starting DOGE Mini-Scalping Bot...');
    console.log('Configuration:', {
      symbol: TRADE_SYMBOL,
      buyDip: `${BUY_DIP_PERCENT}%`,
      sellGain: `${SELL_GAIN_PERCENT}%`,
      amount: `${TRADE_AMOUNT} THB`
    });

    // ตรวจสอบยอดเงิน
    const wallet = await checkWalletBalance();
    console.log('Wallet Balance:', wallet.THB, 'THB');
    
    if (wallet.THB < TRADE_AMOUNT) {
      console.log('Not enough THB balance for trading');
      return;
    }

    // ตรวจสอบคำสั่งซื้อที่เปิดอยู่
    const openOrders = await checkOpenOrders(TRADE_SYMBOL);
    if (openOrders && openOrders.length > 0) {
      console.log('There are pending orders, skipping...');
      return;
    }

    // ตรวจสอบราคาปัจจุบัน
    const currentPrice = await getCurrentPrice(TRADE_SYMBOL);
    console.log('Current Price:', currentPrice, 'THB');

    // ตรวจสอบว่ามี DOGE ในพอร์ตหรือไม่
    const dogeBalance = wallet.DOGE || 0;
    
    if (dogeBalance > 0) {
      // ถ้ามี DOGE ให้ตรวจสอบเพื่อขาย
      const sellPrice = (currentPrice * (1 + (SELL_GAIN_PERCENT/100))).toFixed(6);
      console.log(`Attempting to sell DOGE at ${sellPrice} THB (${SELL_GAIN_PERCENT}% gain)`);
      
      const sellResult = await placeSellOrder(TRADE_SYMBOL, dogeBalance, sellPrice);
      console.log('Sell Order Result:', sellResult);
    } else {
      // ถ้าไม่มี DOGE ให้ตรวจสอบเพื่อซื้อ
      const buyPrice = (currentPrice * (1 - (BUY_DIP_PERCENT/100))).toFixed(6);
      console.log(`Attempting to buy DOGE at ${buyPrice} THB (${BUY_DIP_PERCENT}% dip)`);
      
      const buyAmount = (TRADE_AMOUNT / buyPrice).toFixed(2);
      const buyResult = await placeBuyOrder(TRADE_SYMBOL, buyAmount, buyPrice);
      console.log('Buy Order Result:', buyResult);
    }
  } catch (error) {
    console.error('Strategy execution error:', error);
  }
}

// เรียกใช้งาน
executeStrategy();
