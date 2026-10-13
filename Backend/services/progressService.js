const Task = require('../model/taskSchema');
const Habit = require('../model/habitSchema');

function parseDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('date must use YYYY-MM-DD'), { status: 400 });
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Object.assign(new Error('date is invalid'), { status: 400 });
  return value;
}

function calculateProgress(date, tasks, habits) {
  const taskTotal = tasks.length;
  const taskCompleted = tasks.filter((task) => task.completed).length;
  const activeHabits = habits.length;
  const habitsCompleted = habits.filter((habit) => habit.completions.some((entry) => entry.date === date)).length;
  return {
    date,
    tasks: { total: taskTotal, completed: taskCompleted, pending: taskTotal - taskCompleted, completionPercentage: taskTotal ? Math.round(taskCompleted / taskTotal * 100) : 0 },
    habits: { active: activeHabits, completed: habitsCompleted, pending: activeHabits - habitsCompleted, completionPercentage: activeHabits ? Math.round(habitsCompleted / activeHabits * 100) : 0 }
  };
}

async function getDailyProgress(value) {
  const date = parseDate(value);
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const [tasks, habits] = await Promise.all([
    Task.find({ dueDate: { $gte: start, $lt: end } }).select('title completed priority dueDate'),
    Habit.find({ active: true }).select('name completions')
  ]);
  return calculateProgress(date, tasks, habits);
}

module.exports = { getDailyProgress, parseDate, calculateProgress };
