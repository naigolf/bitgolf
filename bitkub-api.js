async _placeOrder(path, symbol, price, amount) {
  const method = 'POST';
  const ts = Date.now();

  console.log('\n========== Place Order Start ==========');
  console.log('Raw Input:', { symbol, price, amount });

  // 1. Validate input
  if (!symbol || isNaN(price) || isNaN(amount)) {
    console.error('❌ Invalid input parameter(s)');
    throw new Error('Invalid parameters: symbol, price or amount is incorrect');
  }

  // 2. Format symbol
  const formattedSymbol = symbol.trim().toUpperCase(); // Bitkub requires UPPERCASE
  console.log('Formatted Symbol:', formattedSymbol);

  // 3. Build body
  const bodyObj = {
    sym: formattedSymbol,
    amt: parseFloat(amount),
    rat: parseFloat(price),
    typ: 'limit',
  };
  console.log('Body Object:', bodyObj);

  // 4. Sign payload
  const bodyStr = JSON.stringify(bodyObj);
  const stringToSign = ts + method + path + bodyStr;
  const signature = this.signPayload(stringToSign);

  console.log('Timestamp:', ts);
  console.log('Signature:', signature);
  console.log('String to Sign:', stringToSign);

  // 5. Call API
  try {
    const resp = await axios.post(
      `${API_BASE}${path}`,
      bodyObj,
      {
        headers: {
          'X-BTK-TIMESTAMP': ts.toString(),
          'X-BTK-APIKEY': this.apiKey,
          'X-BTK-SIGN': signature,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('✅ API Response:', resp.data);
    console.log('========== Place Order Done ==========');
    return resp.data;

  } catch (e) {
    console.error('❌ API Error Response:', e.response?.data || e.message);
    console.log('========== Place Order Failed ==========');
    throw new Error(`Failed to place order: ${JSON.stringify(e.response?.data || e.message)}`);
  }
}
