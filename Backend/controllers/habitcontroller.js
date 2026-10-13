const mongoose = require('mongoose');
const Habit = require('../model/habitSchema');
const send = (res, status, data) => res.status(status).json({ success: true, data });
function badRequest(message) { const error = new Error(message); error.status = 400; return error; }
function dateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('date must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw badRequest('date is invalid');
  return value;
}
function validId(id) { if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid habit id'); }

async function createHabit(req, res) {
  const body = req.body || {};
  if (typeof body.name !== 'string' || !body.name.trim()) throw badRequest('name is required and must be non-empty');
  for (const key of Object.keys(body)) if (!['name', 'description', 'active'].includes(key)) throw badRequest(`Unknown field: ${key}`);
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 1000)) throw badRequest('description must be a string up to 1000 characters');
  if (body.active !== undefined && typeof body.active !== 'boolean') throw badRequest('active must be a boolean');
  return send(res, 201, await Habit.create(body));
}
async function listHabits(req, res) { return send(res, 200, await Habit.find(req.query.includeInactive === 'true' ? {} : { active: true }).sort({ createdAt: -1 })); }
async function updateHabit(req, res) {
  validId(req.params.id);
  const body = req.body || {};
  if (!Object.keys(body).length) throw badRequest('At least one field is required');
  for (const key of Object.keys(body)) if (!['name', 'description', 'active'].includes(key)) throw badRequest(`Unknown field: ${key}`);
  if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) throw badRequest('name must be a non-empty string');
  if ('description' in body && (typeof body.description !== 'string' || body.description.length > 1000)) throw badRequest('description must be a string up to 1000 characters');
  if ('active' in body && typeof body.active !== 'boolean') throw badRequest('active must be a boolean');
  const habit = await Habit.findByIdAndUpdate(req.params.id, body, { returnDocument: 'after', runValidators: true });
  if (!habit) { const error = new Error('Habit not found'); error.status = 404; throw error; }
  return send(res, 200, habit);
}
async function completeHabit(req, res) {
  validId(req.params.id);
  const date = dateString(req.params.date);
  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, 'completions.date': { $ne: date } },
    { $push: { completions: { date, completedAt: new Date() } } },
    { returnDocument: 'after', runValidators: true }
  );
  if (habit) return send(res, 200, { habit, date, completed: true, alreadyCompleted: false });
  const existing = await Habit.findById(req.params.id);
  if (!existing) { const error = new Error('Habit not found'); error.status = 404; throw error; }
  return send(res, 200, { habit: existing, date, completed: true, alreadyCompleted: true });
}
async function completionHistory(req, res) {
  validId(req.params.id);
  const from = req.query.from ? dateString(req.query.from) : '0000-01-01';
  const to = req.query.to ? dateString(req.query.to) : '9999-12-31';
  if (from > to) throw badRequest('from must be on or before to');
  const habit = await Habit.findById(req.params.id).select('name completions');
  if (!habit) { const error = new Error('Habit not found'); error.status = 404; throw error; }
  return send(res, 200, { habitId: habit.id, name: habit.name, completions: habit.completions.filter((entry) => entry.date >= from && entry.date <= to) });
}

module.exports = { createHabit, listHabits, updateHabit, completeHabit, completionHistory };
