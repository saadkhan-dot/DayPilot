const express = require('express');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const taskRoutes = require('./routes/taskRoute');
const habitRoutes = require('./routes/habitRoute');
const progressRoutes = require('./routes/progressRoute');
const planRoutes = require('./routes/planRoute');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use(taskRoutes);
app.use(habitRoutes);
app.use(progressRoutes);
app.use(planRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
