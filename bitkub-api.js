const axios = require('axios');
const crypto = require('crypto');

const API_BASE = 'https://api.bitkub.com/api/v3/market';

class BitkubAPI {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  signPayload(payload) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  async getTicker(symbol) {
    try {
      const resp = await axios.get(`${API_BASE}/ticker`);
      console.log('Bitkub Ticker Response:', resp.data);
      if (!resp.data[symbol]) {
        throw new Error(`Ticker data for symbol ${symbol} not found`);
      }
      return resp.data[symbol];
    } catch (e) {
      throw new Error('Failed to get ticker: ' + e.message);
    }
  }

  async getWallet() {
    const path = '/wallet';
    const ts = Date.now();
    const payload = `access_key=${this.apiKey}&created=${ts}`;
    const signature = this.signPayload(payload);

    try {
      const resp = await axios.post(`${API_BASE}${path}`, null, {
        params: {
          access_key: this.apiKey,
          created: ts,
          signature: signature,
        },
        headers: { 'X-API-KEY': this.apiKey },
      });
      return resp.data;
    } catch (e) {
      throw new Error('Failed to get wallet: ' + e.message);
    }
  }

  async placeOrder(side, symbol, price, amount) {
    if (side === 'ask') {
      return this.placeSellOrder(symbol, price, amount);
    } else {
      return this.placeBuyOrder(symbol, price, amount);
    }
  }

  async placeBuyOrder(symbol, price, amount) {
    const path = '/place-bid';
    const ts = Date.now();
    const payload = `access_key=${this.apiKey}&amount=${amount}&price=${price}&symbol=${symbol}&created=${ts}`;
    const signature = this.signPayload(payload);

    try {
      const resp = await axios.post(`${API_BASE}${path}`, null, {
        params: {
          access_key: this.apiKey,
          amount,
          price,
          symbol,
          created: ts,
          signature,
        },
        headers: { 'X-API-KEY': this.apiKey },
      });
      return resp.data;
    } catch (e) {
      throw new Error('Failed to place buy order: ' + e.message);
    }
  }

  async placeSellOrder(symbol, price, amount) {
    const path = '/place-ask';
    const ts = Date.now();
    const payload = `access_key=${this.apiKey}&amount=${amount}&price=${price}&symbol=${symbol}&created=${ts}`;
    const signature = this.signPayload(payload);

    try {
      const resp = await axios.post(`${API_BASE}${path}`, null, {
        params: {
          access_key: this.apiKey,
          amount,
          price,
          symbol,
          created: ts,
          signature,
        },
        headers: { 'X-API-KEY': this.apiKey },
      });
      return resp.data;
    } catch (e) {
      throw new Error('Failed to place sell order: ' + e.message);
    }
  }
}

module.exports = BitkubAPI;
