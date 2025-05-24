const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'trades.json');

// โหลดข้อมูลเทรด
function loadTrades() {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// บันทึกเทรดใหม่
function saveTrade(trade) {
  const trades = loadTrades();
  trades.push(trade);
  fs.writeFileSync(filePath, JSON.stringify(trades, null, 2));
}

// คำนวณกำไรรวมของวันนี้
function getTodayProfit() {
  const trades = loadTrades();
  const today = new Date().toISOString().slice(0, 10);
  return trades
    .filter(t => t.date.startsWith(today))
    .reduce((sum, t) => sum + (t.profit || 0), 0);
}

module.exports = { saveTrade, getTodayProfit };
