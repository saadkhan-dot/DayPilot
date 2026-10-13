const express = require('express');
const { dailyProgress } = require('../controllers/progressController');
const router = express.Router();
router.get('/api/progress', (req, res, next) => Promise.resolve(dailyProgress(req, res)).catch(next));
module.exports = router;
