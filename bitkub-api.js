const axios = require('axios');
const crypto = require('crypto');

const API_BASE = 'https://api.bitkub.com';

class BitkubAPI {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  signPayload(stringToSign) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(stringToSign)
      .digest('hex');
  }
/*
  async getTicker(symbol) {
    try {
      const resp = await axios.get(`${API_BASE}/api/v3/market/ticker`);
      if (!resp.data[symbol]) {
        throw new Error(`Ticker data for symbol ${symbol} not found`);
      }
      console.log(`Bitkub Ticker Response for ${symbol}:`, resp.data[symbol]);
      return resp.data[symbol];
    } catch (e) {
      throw new Error('Failed to get ticker: ' + e.message);
    }
  }
*/


  async getTicker(symbol) {
  try {
    const resp = await axios.get(`${API_BASE}/api/market/ticker`);
    console.log('Available symbols:', Object.keys(resp.data));
    
    if (!resp.data[symbol]) {
      throw new Error(`Ticker data for symbol ${symbol} not found`);
    }

    console.log(`Bitkub Ticker Response for ${symbol}:`, resp.data[symbol]);
    return resp.data[symbol];
  } catch (e) {
    throw new Error('Failed to get ticker: ' + e.message);
  }
}

  
  async getWallet() {
  const path = '/api/v3/market/wallet'; // ใช้ secure endpoint v3
  const method = 'POST';
  const timestamp = Date.now().toString();

  const bodyObj = { ts: Number(timestamp) };
  const body = JSON.stringify(bodyObj);

  const stringToSign = timestamp + method + path + body;
  const signature = this.signPayload(stringToSign);

  try {
    const resp = await axios.post(
      `${API_BASE}${path}`,
      body,
      {
        headers: {
          'X-BTK-TIMESTAMP': timestamp,
          'X-BTK-APIKEY': this.apiKey,
          'X-BTK-SIGN': signature,
          'Content-Type': 'application/json',
        },
      }
    );
    return resp.data;
  } catch (e) {
    if (e.response) {
      console.error('Wallet API response error:', e.response.status, e.response.data);
    } else {
      console.error('Wallet API error:', e.message);
    }
    throw new Error('Failed to get wallet: ' + e.message);
  }
}




  async placeOrder(side, symbol, price, amount) {
    if (side === 'ask') {
      return this.placeSellOrder(symbol, price, amount);
    } else if (side === 'bid') {
      return this.placeBuyOrder(symbol, price, amount);
    } else {
      throw new Error(`Invalid order side: ${side}. Use 'bid' or 'ask'.`);
    }
  }

  async placeBuyOrder(symbol, price, amount) {
    const path = '/api/v3/market/place-bid';
    const method = 'POST';
    const timestamp = Date.now().toString();

    const bodyObj = {
      sym: symbol.toLowerCase(),
      amt: String(amount),
      rat: String(price),
      typ: 'limit',
    };
    const body = JSON.stringify(bodyObj);

    const stringToSign = timestamp + method + path + body;
    const signature = this.signPayload(stringToSign);

    try {
      const resp = await axios.post(
        `${API_BASE}${path}`,
        body,
        {
          headers: {
            'X-BTK-TIMESTAMP': timestamp,
            'X-BTK-APIKEY': this.apiKey,
            'X-BTK-SIGN': signature,
            'Content-Type': 'application/json',
          },
        }
      );
      return resp.data;
    } catch (e) {
      if (e.response) {
        console.error('Place Buy Order response error:', e.response.status, e.response.data);
      } else {
        console.error('Place Buy Order error:', e.message);
      }
      throw new Error('Failed to place buy order: ' + e.message);
    }
  }

  async placeSellOrder(symbol, price, amount) {
    const path = '/api/v3/market/place-ask';
    const method = 'POST';
    const timestamp = Date.now().toString();

    const bodyObj = {
      sym: symbol.toLowerCase(),
      amt: String(amount),
      rat: String(price),
      typ: 'limit',
    };
    const body = JSON.stringify(bodyObj);

    const stringToSign = timestamp + method + path + body;
    const signature = this.signPayload(stringToSign);

    try {
      const resp = await axios.post(
        `${API_BASE}${path}`,
        body,
        {
          headers: {
            'X-BTK-TIMESTAMP': timestamp,
            'X-BTK-APIKEY': this.apiKey,
            'X-BTK-SIGN': signature,
            'Content-Type': 'application/json',
          },
        }
      );
      return resp.data;
    } catch (e) {
      if (e.response) {
        console.error('Place Sell Order response error:', e.response.status, e.response.data);
      } else {
        console.error('Place Sell Order error:', e.message);
      }
      throw new Error('Failed to place sell order: ' + e.message);
    }
  }
}

module.exports = BitkubAPI;
