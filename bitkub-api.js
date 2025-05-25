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

  formatSymbol(symbol) {
    if (!symbol.includes('_')) return symbol.toLowerCase();
    const [base, coin] = symbol.toLowerCase().split('_');
    return `${coin}_${base}`; // THB_DOGE → doge_thb
  }

  async getTicker(symbol) {
  try {
    const formattedSymbol = this.formatSymbol(symbol); // ไม่แปลงเป็น uppercase
    const resp = await axios.get(`${API_BASE}/api/market/ticker`);
    if (!resp.data[formattedSymbol]) {
      console.error('❌ Symbol not found in ticker:', formattedSymbol);
      throw new Error(`Ticker data for symbol ${formattedSymbol} not found`);
    }
    return resp.data[formattedSymbol];
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

    const formattedSymbol = this.formatSymbol(symbol);
    console.log('\n===== NEW ORDER =====');
    console.log('Raw Params:', { symbol, price, amount });
    console.log('Formatted Symbol:', formattedSymbol);

    if (!formattedSymbol || isNaN(price) || isNaN(amount)) {
      console.error('❌ Invalid parameters:', { formattedSymbol, price, amount });
      throw new Error('Invalid parameters: symbol, price or amount is incorrect');
    }

    const bodyObj = {
      sym: formattedSymbol,
      amt: parseFloat(amount),
      rat: parseFloat(price),
      typ: 'limit',
    };

    const bodyStr = JSON.stringify(bodyObj);
    const stringToSign = ts + method + path + bodyStr;
    const signature = this.signPayload(stringToSign);

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
