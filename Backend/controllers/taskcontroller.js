const mongoose = require('mongoose');
const Task = require('../model/taskSchema');

const allowed = new Set(['title', 'description', 'priority', 'dueDate', 'completed', 'estimatedMinutes']);
const send = (res, status, data) => res.status(status).json({ success: true, data });
function badRequest(message) { const error = new Error(message); error.status = 400; return error; }
function validDate(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw badRequest('date must use YYYY-MM-DD');
  return value;
}
function validId(id) { if (!mongoose.isValidObjectId(id)) { const error = new Error('Invalid task id'); error.status = 400; throw error; } }

async function createTask(req, res) {
  const body = req.body || {};
  if (typeof body.title !== 'string' || !body.title.trim()) throw badRequest('title is required and must be non-empty');
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw badRequest(`Unknown field: ${key}`);
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) throw badRequest('description must be a string up to 2000 characters');
  if (body.priority !== undefined && !['low', 'medium', 'high'].includes(body.priority)) throw badRequest('priority must be low, medium, or high');
  if (body.completed !== undefined && typeof body.completed !== 'boolean') throw badRequest('completed must be a boolean');
  if (body.estimatedMinutes !== undefined && body.estimatedMinutes !== null && (!Number.isInteger(body.estimatedMinutes) || body.estimatedMinutes < 1 || body.estimatedMinutes > 1440)) throw badRequest('estimatedMinutes must be an integer from 1 to 1440');
  if (body.dueDate !== undefined && body.dueDate !== null) body.dueDate = new Date(`${validDate(body.dueDate)}T00:00:00.000Z`);
  const task = await Task.create(body);
  return send(res, 201, task);
}

async function listTasks(req, res) {
  const filter = {};
  if (req.query.date) {
    const date = validDate(req.query.date);
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    filter.dueDate = { $gte: start, $lt: end };
  }
  return send(res, 200, await Task.find(filter).sort({ createdAt: -1 }));
}

async function getTask(req, res) {
  validId(req.params.id);
  const task = await Task.findById(req.params.id);
  if (!task) { const error = new Error('Task not found'); error.status = 404; throw error; }
  return send(res, 200, task);
}

async function updateTask(req, res) {
  validId(req.params.id);
  const body = req.body || {};
  if (!Object.keys(body).length) throw badRequest('At least one field is required');
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw badRequest(`Unknown field: ${key}`);
  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) throw badRequest('title must be a non-empty string');
  if ('description' in body && (typeof body.description !== 'string' || body.description.length > 2000)) throw badRequest('description must be a string up to 2000 characters');
  if ('priority' in body && !['low', 'medium', 'high'].includes(body.priority)) throw badRequest('priority must be low, medium, or high');
  if ('completed' in body && typeof body.completed !== 'boolean') throw badRequest('completed must be a boolean');
  if ('estimatedMinutes' in body && body.estimatedMinutes !== null && (!Number.isInteger(body.estimatedMinutes) || body.estimatedMinutes < 1 || body.estimatedMinutes > 1440)) throw badRequest('estimatedMinutes must be an integer from 1 to 1440');
  if ('dueDate' in body && body.dueDate !== null) body.dueDate = new Date(`${validDate(body.dueDate)}T00:00:00.000Z`);
  if (body.dueDate === null) body.dueDate = null;
  const task = await Task.findByIdAndUpdate(req.params.id, body, { returnDocument: 'after', runValidators: true });
  if (!task) { const error = new Error('Task not found'); error.status = 404; throw error; }
  return send(res, 200, task);
}

async function deleteTask(req, res) {
  validId(req.params.id);
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) { const error = new Error('Task not found'); error.status = 404; throw error; }
  return send(res, 200, { id: task.id, deleted: true });
}

module.exports = { createTask, listTasks, getTask, updateTask, deleteTask };
