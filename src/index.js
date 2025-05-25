require('dotenv').config();
const { executeStrategy } = require('./strategy');

(async () => {
  try {
    await executeStrategy();
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
  }
})();
