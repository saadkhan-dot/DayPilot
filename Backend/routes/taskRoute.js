const express = require('express');
const controller = require('../controllers/taskcontroller');

const router = express.Router();
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.post('/api/tasks', asyncRoute(controller.createTask));
router.get('/api/tasks', asyncRoute(controller.listTasks));
router.get('/api/tasks/:id', asyncRoute(controller.getTask));
router.patch('/api/tasks/:id', asyncRoute(controller.updateTask));
router.delete('/api/tasks/:id', asyncRoute(controller.deleteTask));
module.exports = router;
