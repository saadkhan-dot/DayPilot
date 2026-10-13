const test = require('node:test');
const assert = require('node:assert/strict');
require('../config/env')();
const mongoose = require('mongoose');
const Task = require('../model/taskSchema');
const Habit = require('../model/habitSchema');
const Plan = require('../model/planSchema');
const taskController = require('../controllers/taskcontroller');
const habitController = require('../controllers/habitcontroller');
const planController = require('../controllers/plancontroller');
const ai = require('../services/aiService');
const { calculateProgress } = require('../services/progressService');

function response() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function request(body = {}, params = {}, query = {}) { return { body, params, query }; }

test('task input validation rejects missing titles, invalid fields, and unknown fields', async () => {
  await assert.rejects(taskController.createTask(request({ title: '  ' }), response()), (error) => error.status === 400 && /title is required/.test(error.message));
  await assert.rejects(taskController.createTask(request({ title: 'Study', estimatedMinutes: 1.5 }), response()), (error) => error.status === 400 && /estimatedMinutes/.test(error.message));
  await assert.rejects(taskController.createTask(request({ title: 'Study', unrelated: true }), response()), (error) => error.status === 400 && /Unknown field: unrelated/.test(error.message));
  await assert.rejects(taskController.createTask(request({ title: 'Study', priority: 'urgent' }), response()), (error) => error.status === 400 && /priority/.test(error.message));
  await assert.rejects(taskController.createTask(request({ title: 'Study', dueDate: '2026-02-30' }), response()), (error) => error.status === 400 && /YYYY-MM-DD/.test(error.message));
  await assert.rejects(taskController.createTask(request({ title: 'Study', description: 22 }), response()), (error) => error.status === 400 && /description/.test(error.message));
  await assert.rejects(new Task({ title: 'Study', estimatedMinutes: 1.5 }).validate(), /estimatedMinutes must be an integer/);
  await new Task({ title: 'Study', estimatedMinutes: null }).validate();
});

test('progress percentages are deterministic and zero-safe', () => {
  assert.deepEqual(calculateProgress('2026-10-13', [], []), {
    date: '2026-10-13', tasks: { total: 0, completed: 0, pending: 0, completionPercentage: 0 },
    habits: { active: 0, completed: 0, pending: 0, completionPercentage: 0 }
  });
  const summary = calculateProgress('2026-10-13', [{ completed: true }, { completed: false }], [{ completions: [{ date: '2026-10-13' }] }, { completions: [] }]);
  assert.equal(summary.tasks.completionPercentage, 50);
  assert.equal(summary.habits.completionPercentage, 50);
});

test('AI rejects invalid proposals and unavailable credentials clearly', async () => {
  assert.throws(() => ai.validateProposal({ summary: 'x', tasks: [{ title: 'x' }] }, 30), /invalid proposal/);
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(ai.openAIModel([]), (error) => error.status === 503 && /OPENAI_API_KEY/.test(error.message));
  if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
});

test('agent allowlists tools, validates arguments, and stops at its limit', async () => {
  const toolResponse = (name, args) => ({ content: null, tool_calls: [{ id: 'call_1', function: { name, arguments: JSON.stringify(args) } }] });
  await assert.rejects(ai.runAgent({ request: 'plan', date: '2026-10-13', availableMinutes: 60, callModel: async () => toolResponse('executeShell', {}) }), /not allowed/);
  await assert.rejects(ai.runAgent({ request: 'plan', date: '2026-10-13', availableMinutes: 60, callModel: async () => toolResponse('getTasks', { date: '2026-10-13', extra: true }) }), /invalid tool arguments/);
  let calls = 0;
  await assert.rejects(ai.runAgent({ request: 'plan', date: '2026-10-13', availableMinutes: 60, maxIterations: 2, callModel: async () => { calls += 1; return { content: null, tool_calls: [] }; } }), /did not submit a task proposal/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(ai.runAgent({ request: 'plan', date: '2026-10-13', availableMinutes: 60, maxIterations: 2, execute: async () => [], callModel: async () => { calls += 1; return { content: 'still thinking', tool_calls: [{ id: `c${calls}`, function: { name: 'getHabits', arguments: '{"date":"2026-10-13"}' } }] }; } }), /step limit/);
  assert.equal(calls, 2);
  calls = 0;
  const proposal = { summary: 'A realistic start', tasks: [{ title: 'Draft outline', description: '', priority: 'high', estimatedMinutes: 30, suggestedOrder: 1, timeSlot: 'Morning', reasoning: 'Start with the key deliverable.' }] };
  const result = await ai.runAgent({ request: 'Plan my work', date: '2026-10-13', availableMinutes: 60, execute: async (name, args, context) => ai.executeTool(name, args, context), callModel: async () => {
    calls += 1;
    if (calls === 1) return toolResponse('proposeTasks', proposal);
    return { content: 'I kept the work focused.', tool_calls: undefined };
  } });
  assert.equal(result.proposal.tasks[0].title, 'Draft outline');
});

test('MongoDB task, habit, progress, and approval integration', async (t) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/daypilot_test', { serverSelectionTimeoutMS: 1000 });
  } catch (error) {
    t.skip(`MongoDB is unavailable: ${error.message}`);
    return;
  }
  const marker = `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ids = { tasks: [], habits: [], plans: [] };
  t.after(async () => {
    if (ids.tasks.length) await Task.deleteMany({ _id: { $in: ids.tasks } });
    if (ids.habits.length) await Habit.deleteMany({ _id: { $in: ids.habits } });
    if (ids.plans.length) await Plan.deleteMany({ _id: { $in: ids.plans } });
    await mongoose.disconnect();
  });

  const created = response();
  await taskController.createTask(request({ title: `${marker}-task`, description: 'Revise normalization', priority: 'high', estimatedMinutes: 60, dueDate: '2026-10-13' }), created);
  assert.equal(created.statusCode, 201);
  const taskId = created.body.data._id; ids.tasks.push(taskId);
  assert.equal(created.body.data.title, `${marker}-task`);
  assert.equal(created.body.data.description, 'Revise normalization');
  assert.equal(created.body.data.priority, 'high');
  assert.equal(created.body.data.estimatedMinutes, 60);
  assert.equal(new Date(created.body.data.dueDate).toISOString().slice(0, 10), '2026-10-13');
  const persistedTask = await Task.findById(taskId).lean();
  assert.ok(persistedTask, 'Task.create persisted the document in MongoDB');
  assert.equal(persistedTask.estimatedMinutes, 60);
  assert.equal(persistedTask.priority, 'high');
  assert.equal(persistedTask.description, 'Revise normalization');
  const listed = response(); await taskController.listTasks(request({}, {}, { date: '2026-10-13' }), listed);
  assert.ok(listed.body.data.some((task) => String(task._id) === String(taskId)));
  const updated = response(); await taskController.updateTask(request({ completed: true, estimatedMinutes: 75 }, { id: String(taskId) }), updated);
  assert.equal(updated.body.data.completed, true);
  assert.equal(updated.body.data.estimatedMinutes, 75);

  const habitRes = response(); await habitController.createHabit(request({ name: `${marker}-habit` }), habitRes);
  const habitId = habitRes.body.data._id; ids.habits.push(habitId);
  const first = response(); await habitController.completeHabit(request({}, { id: String(habitId), date: '2026-10-13' }), first);
  const duplicate = response(); await habitController.completeHabit(request({}, { id: String(habitId), date: '2026-10-13' }), duplicate);
  assert.equal(duplicate.body.data.alreadyCompleted, true);
  const history = response(); await habitController.completionHistory(request({}, { id: String(habitId) }, { from: '2026-10-13', to: '2026-10-13' }), history);
  assert.equal(history.body.data.completions.length, 1);
  const progress = response(); await require('../controllers/progressController').dailyProgress(request({}, {}, { date: '2026-10-13' }), progress);
  assert.ok(progress.body.data.tasks.total >= 1);
  assert.ok(progress.body.data.habits.active >= 1);

  const plan = await Plan.create({ request: 'integration test plan', date: '2026-10-13', availableMinutes: 30, tasks: [{ title: `${marker}-planned`, description: '', priority: 'medium', estimatedMinutes: 20, suggestedOrder: 1, timeSlot: '', reasoning: 'Fits available time' }], summary: 'One small task' });
  ids.plans.push(plan._id);
  const firstApproval = response(); await planController.approveProposal(request({}, { id: String(plan._id) }), firstApproval);
  const secondApproval = response(); await planController.approveProposal(request({}, { id: String(plan._id) }), secondApproval);
  assert.equal(firstApproval.body.data.alreadyApproved, false);
  assert.equal(secondApproval.body.data.alreadyApproved, true);
  assert.equal(await Task.countDocuments({ planId: plan._id }), 1);

  const deleted = response(); await taskController.deleteTask(request({}, { id: String(taskId) }), deleted);
  assert.equal(deleted.body.data.deleted, true);
  ids.tasks = ids.tasks.filter((id) => String(id) !== String(taskId));
});
