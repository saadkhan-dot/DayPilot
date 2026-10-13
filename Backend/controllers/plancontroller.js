const mongoose = require('mongoose');
const Plan = require('../model/planSchema');
const Task = require('../model/taskSchema');
const { runAgent } = require('../services/aiService');

const send = (res, status, data) => res.status(status).json({ success: true, data });
function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }
function validateRequest(body) {
  const keys = ['goals', 'request', 'date', 'availableMinutes', 'priorities'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !keys.includes(key))) throw badRequest('Request contains unsupported fields');
  const request = body.goals === undefined ? body.request : body.goals;
  if (typeof request !== 'string' || !request.trim() || request.length > 3000) throw badRequest('goals must be a non-empty string up to 3000 characters');
  if (!Number.isInteger(body.availableMinutes) || body.availableMinutes < 5 || body.availableMinutes > 1440) throw badRequest('availableMinutes must be an integer from 5 to 1440');
  if (body.priorities !== undefined && (typeof body.priorities !== 'string' || body.priorities.length > 1000)) throw badRequest('priorities must be a string up to 1000 characters');
  const date = body.date || new Date().toISOString().slice(0, 10);
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw badRequest('date must be a valid YYYY-MM-DD date');
  return { request: request.trim(), date, availableMinutes: body.availableMinutes, priorities: body.priorities || '' };
}

async function createProposal(req, res) {
  const input = validateRequest(req.body);
  const result = await runAgent(input);
  const plan = await Plan.create({ ...input, tasks: result.proposal.tasks, summary: result.proposal.summary });
  return send(res, 201, { plan, response: result.response });
}

async function getProposal(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw badRequest('Invalid plan id');
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  return send(res, 200, plan);
}

async function approveProposal(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw badRequest('Invalid plan id');
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  const alreadyApproved = plan.status === 'approved';
  const dueDate = new Date(`${plan.date}T00:00:00.000Z`);
  const tasks = [];
  for (let index = 0; index < plan.tasks.length; index += 1) {
    const proposed = plan.tasks[index].toObject ? plan.tasks[index].toObject() : plan.tasks[index];
    let task;
    try {
      task = await Task.findOneAndUpdate(
        { planId: plan._id, planIndex: index },
        { $setOnInsert: { title: proposed.title, description: proposed.description, priority: proposed.priority, estimatedMinutes: proposed.estimatedMinutes, dueDate, completed: false, planId: plan._id, planIndex: index } },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      task = await Task.findOne({ planId: plan._id, planIndex: index });
    }
    tasks.push(task);
  }
  if (!alreadyApproved) {
    plan.status = 'approved';
    plan.approvedAt = new Date();
    await plan.save();
  }
  return send(res, 200, { planId: plan.id, status: 'approved', alreadyApproved, tasks });
}

module.exports = { createProposal, getProposal, approveProposal, validateRequest };
