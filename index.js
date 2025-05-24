const WebSocket = require('ws');
const { onPriceUpdate } = require('./tradeLogic');

const symbol = process.env.SYMBOL.toLowerCase();
const ws = new WebSocket(`wss://api.bitkub.com/websocket-api/market.ticker`);

ws.on('open', () => {
  console.log('[WS] Connected to Bitkub WebSocket');
  ws.send(JSON.stringify({ event: 'subscribe', channel: `market.ticker.${symbol}` }));
});

ws.on('message', (data) => {
  const res = JSON.parse(data);
  if (res?.data?.last) {
    const price = res.data.last;
    onPriceUpdate(price);
  }
});
