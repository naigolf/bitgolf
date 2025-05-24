const crypto = require('crypto');
const axios = require('axios');

function sign(params, secret) {
  return crypto.createHmac('sha256', secret).update(new URLSearchParams(params).toString()).digest('hex');
}

class BitkubAPI {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiUrl = "https://api.bitkub.com";
  }

  async request(endpoint, params = {}, method = "POST") {
    params.ts = Date.now();
    params.sig = sign(params, this.apiSecret);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BTK-APIKEY': this.apiKey
    };

    const res = await axios({
      method,
      url: this.apiUrl + endpoint,
      data: new URLSearchParams(params),
      headers
    });

    return res.data.result;
  }

  async ticker(symbol) {
    const res = await axios.get(`${this.apiUrl}/api/market/ticker?sym=${symbol}`);
    return res.data[symbol];
  }

  async wallet() {
    return await this.request("/api/market/wallet");
  }

  async placeBuyOrder(symbol, amount, rate) {
    return await this.request("/api/market/place-bid", {
      sym: symbol,
      amt: amount,
      rat: rate,
      typ: "limit"
    });
  }

  async placeSellOrder(symbol, amount, rate) {
    return await this.request("/api/market/place-ask", {
      sym: symbol,
      amt: amount,
      rat: rate,
      typ: "limit"
    });
  }
}

module.exports = BitkubAPI;
