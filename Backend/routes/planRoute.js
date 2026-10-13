const express = require('express');
const controller = require('../controllers/plancontroller');
const router = express.Router();
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.post('/api/ai/plan', asyncRoute(controller.createProposal));
router.get('/api/ai/plan/:id', asyncRoute(controller.getProposal));
router.post('/api/ai/plan/:id/approve', asyncRoute(controller.approveProposal));
module.exports = router;
