const Task = require('../model/taskSchema');
const Habit = require('../model/habitSchema');
const { getDailyProgress, parseDate } = require('./progressService');

const MAX_ITERATIONS = 5;
const MAX_TASKS = 8;
const TOOL_DEFINITIONS = [
  { type: 'function', function: { name: 'getTasks', description: 'Retrieve scheduled tasks for one calendar date.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'], additionalProperties: false } } },
  { type: 'function', function: { name: 'getHabits', description: 'Retrieve active habits and completion status for a calendar date.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'], additionalProperties: false } } },
  { type: 'function', function: { name: 'getDailyProgress', description: 'Get computed task and habit progress for one calendar date.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'], additionalProperties: false } } },
  { type: 'function', function: { name: 'proposeTasks', description: 'Submit the final task proposal for the user to review. This does not create tasks.', parameters: { type: 'object', properties: { summary: { type: 'string' }, tasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, estimatedMinutes: { type: 'integer' }, suggestedOrder: { type: 'integer' }, timeSlot: { type: 'string' }, reasoning: { type: 'string' } }, required: ['title', 'description', 'priority', 'estimatedMinutes', 'suggestedOrder', 'timeSlot', 'reasoning'], additionalProperties: false } } }, required: ['summary', 'tasks'], additionalProperties: false } } }
];

function unavailable() { return Object.assign(new Error('AI planning is unavailable. Set OPENAI_API_KEY in .env to enable the assistant.'), { status: 503 }); }
function exactKeys(obj, keys) { return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((key) => keys.includes(key)); }
function validateProposal(value, availableMinutes) {
  if (!exactKeys(value, ['summary', 'tasks']) || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 1000 || !Array.isArray(value.tasks) || value.tasks.length < 1 || value.tasks.length > MAX_TASKS) throw new Error('AI returned an invalid proposal. Please try again.');
  const tasks = value.tasks.map((task, index) => {
    const keys = ['title', 'description', 'priority', 'estimatedMinutes', 'suggestedOrder', 'timeSlot', 'reasoning'];
    if (!exactKeys(task, keys) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 160 || typeof task.description !== 'string' || task.description.length > 1000 || !['low', 'medium', 'high'].includes(task.priority) || !Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes < 5 || task.estimatedMinutes > 480 || !Number.isInteger(task.suggestedOrder) || task.suggestedOrder < 1 || task.suggestedOrder > MAX_TASKS || typeof task.timeSlot !== 'string' || task.timeSlot.length > 60 || typeof task.reasoning !== 'string' || !task.reasoning.trim() || task.reasoning.length > 400) throw new Error('AI returned an invalid proposal. Please try again.');
    return { title: task.title.trim(), description: task.description, priority: task.priority, estimatedMinutes: task.estimatedMinutes, suggestedOrder: task.suggestedOrder || index + 1, timeSlot: task.timeSlot, reasoning: task.reasoning };
  });
  if (tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) > availableMinutes) throw new Error('AI proposed more work than the available time. Please try again.');
  return { summary: value.summary.trim(), tasks };
}

async function openAIModel(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw unavailable();
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages, tools: TOOL_DEFINITIONS, tool_choice: 'auto', temperature: 0.3, max_tokens: 1800 })
    });
  } catch (error) { throw Object.assign(new Error('AI provider could not be reached. Please try again.'), { status: 502 }); }
  if (!response.ok) throw Object.assign(new Error('AI provider request failed. Check your AI configuration and try again.'), { status: 502 });
  const payload = await response.json();
  const message = payload.choices && payload.choices[0] && payload.choices[0].message;
  if (!message) throw Object.assign(new Error('AI provider returned an invalid response.'), { status: 502 });
  return message;
}

async function executeTool(name, args, context) {
  if (!exactKeys(args, name === 'proposeTasks' ? ['summary', 'tasks'] : ['date'])) throw Object.assign(new Error('Tool arguments are invalid.'), { status: 400 });
  if (name === 'getTasks') {
    const date = parseDate(args.date); const start = new Date(`${date}T00:00:00.000Z`); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    return (await Task.find({ dueDate: { $gte: start, $lt: end } }).select('title description priority completed dueDate').limit(100)).map((task) => task.toObject());
  }
  if (name === 'getHabits') {
    const date = parseDate(args.date);
    return (await Habit.find({ active: true }).select('name description completions').limit(100)).map((habit) => ({ name: habit.name, description: habit.description, completedOnDate: habit.completions.some((entry) => entry.date === date) }));
  }
  if (name === 'getDailyProgress') return getDailyProgress(parseDate(args.date));
  if (name === 'proposeTasks') { context.proposal = validateProposal(args, context.availableMinutes); return { accepted: true, taskCount: context.proposal.tasks.length, totalMinutes: context.proposal.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) }; }
  throw new Error('Tool is not allowed.');
}

async function runAgent({ request, date, availableMinutes, priorities = '', callModel = openAIModel, execute = executeTool, maxIterations = MAX_ITERATIONS }) {
  const safeDate = parseDate(date);
  const context = { availableMinutes, proposal: null };
  const messages = [
    { role: 'system', content: `You are DayPilot, a practical daily planner. The user is planning for ${safeDate} and has ${availableMinutes} minutes. Use getTasks and getHabits or getDailyProgress when current data is relevant. Never invent existing data. Fit any proposed work within available time. Finish by calling proposeTasks with 1-${MAX_TASKS} specific tasks and a concise summary, then give a short user-facing explanation. Current priorities/constraints: ${priorities || 'none provided'}.` },
    { role: 'user', content: request }
  ];
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const message = await callModel(messages);
    if (!message || !message.tool_calls || message.tool_calls.length === 0) {
      if (!context.proposal) throw new Error('AI did not submit a task proposal. Please try again.');
      return { proposal: context.proposal, response: typeof message.content === 'string' ? message.content.slice(0, 2000) : '' };
    }
    if (message.tool_calls.length > 8) throw new Error('AI requested too many tools in one step. Please try again.');
    messages.push({ role: 'assistant', content: message.content || null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      const name = call && call.function && call.function.name;
      if (!TOOL_DEFINITIONS.some((tool) => tool.function.name === name)) throw new Error('AI requested a tool that is not allowed.');
      let args;
      try { args = JSON.parse(call.function.arguments); } catch (error) { throw new Error('AI sent malformed tool arguments. Please try again.'); }
      let result;
      try { result = await execute(name, args, context); } catch (error) { throw new Error(error.status === 400 ? 'AI sent invalid tool arguments. Please try again.' : error.message); }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw Object.assign(new Error(`AI agent reached its ${maxIterations}-step limit before finishing.`), { status: 502 });
}

module.exports = { runAgent, executeTool, validateProposal, openAIModel, TOOL_DEFINITIONS, MAX_ITERATIONS };
