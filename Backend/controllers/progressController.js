const { getDailyProgress } = require('../services/progressService');
async function dailyProgress(req, res) {
  const data = await getDailyProgress(req.query.date);
  return res.json({ success: true, data });
}
module.exports = { dailyProgress };
