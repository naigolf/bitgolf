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

  async getTicker(symbol) {
    try {
      const resp = await axios.get(`${API_BASE}/api/market/ticker`);
      if (!resp.data[symbol]) {
        console.error('❌ Symbol not found in ticker:', symbol);
        throw new Error(`Ticker data for symbol ${symbol} not found`);
      }
      return resp.data[symbol];
    } catch (e) {
      console.error('❌ Failed to get ticker:', e.message);
      throw new Error('Failed to get ticker: ' + e.message);
    }
  }

  async getWallet() {
    const path = '/api/v3/market/wallet';
    const method = 'POST';
    const ts = Date.now();

    const bodyObj = { ts };
    const bodyStr = JSON.stringify(bodyObj);
    const stringToSign = ts + method + path + bodyStr;
    const signature = this.signPayload(stringToSign);

    try {
      const resp = await axios.post(`${API_BASE}${path}`, bodyObj, {
        headers: {
          'X-BTK-TIMESTAMP': ts.toString(),
          'X-BTK-APIKEY': this.apiKey,
          'X-BTK-SIGN': signature,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Wallet Data:', resp.data);
      return resp.data;
    } catch (e) {
      console.error('❌ Failed to get wallet:', e.response?.data || e.message);
      throw new Error('Failed to get wallet: ' + (e.response?.data?.error || e.message));
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

  cleanNumber(num) {
    return parseFloat(num).toString();
  }

  async placeBuyOrder(symbol, price, amount) {
    const path = '/api/v3/market/place-bid';
    return this._placeOrder(path, symbol, price, amount);
  }

  async placeSellOrder(symbol, price, amount) {
    const path = '/api/v3/market/place-ask';
    return this._placeOrder(path, symbol, price, amount);
  }

  async _placeOrder(path, symbol, price, amount) {
    const method = 'POST';
    const ts = Date.now();

    console.log('\n===== NEW ORDER =====');
    console.log('Raw Params:', { symbol, price, amount });

    if (!symbol || isNaN(price) || isNaN(amount)) {
      console.error('❌ Invalid parameters:', { symbol, price, amount });
      throw new Error('Invalid parameters: symbol, price or amount is incorrect');
    }

    const formattedSymbol = symbol.trim().toUpperCase();
    const bodyObj = {
      sym: formattedSymbol,
      amt: parseFloat(amount),
      rat: parseFloat(price),
      typ: 'limit',
    };

    const bodyStr = JSON.stringify(bodyObj);
    const stringToSign = ts + method + path + bodyStr;
    const signature = this.signPayload(stringToSign);

    console.log('Formatted Symbol:', formattedSymbol);
    console.log('String to Sign:', stringToSign);
    console.log('Signature:', signature);

    try {
      const resp = await axios.post(`${API_BASE}${path}`, bodyObj, {
        headers: {
          'X-BTK-TIMESTAMP': ts.toString(),
          'X-BTK-APIKEY': this.apiKey,
          'X-BTK-SIGN': signature,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log('✅ Order Response:', resp.data);
      console.log('===== ORDER SUCCESS =====\n');
      return resp.data;
    } catch (e) {
      console.error('❌ Order Error:', e.response?.data || e.message);
      console.log('===== ORDER FAILED =====\n');
      throw new Error(`Failed to place order: ${JSON.stringify(e.response?.data || e.message)}`);
    }
  }
}

module.exports = BitkubAPI;
