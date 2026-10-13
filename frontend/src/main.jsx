import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const today = new Date().toISOString().slice(0, 10);
async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error?.message || 'Something went wrong.');
  return json.data;
}

function App() {
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [progress, setProgress] = useState(null);
  const [title, setTitle] = useState('');
  const [habitName, setHabitName] = useState('');
  const [goals, setGoals] = useState('');
  const [minutes, setMinutes] = useState(240);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await Promise.all([api('/api/tasks?date=' + date), api('/api/habits'), api('/api/progress?date=' + date)]);
      setTasks(result[0]); setHabits(result[1]); setProgress(result[2]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);

  async function run(action, successText) {
    setError(''); setMessage('');
    try { await action(); if (successText) setMessage(successText); }
    catch (err) { setError(err.message); }
  }
  async function addTask(event) {
    event.preventDefault(); if (!title.trim()) return;
    await run(async () => { await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: title.trim(), dueDate: date }) }); setTitle(''); await refresh(); }, 'Task added.');
  }
  async function toggleTask(task) {
    await run(async () => { await api('/api/tasks/' + task._id, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }); await refresh(); });
  }
  async function editTask(task) {
    const nextTitle = window.prompt('Update task title', task.title);
    if (nextTitle === null || !nextTitle.trim()) return;
    await run(async () => { await api('/api/tasks/' + task._id, { method: 'PATCH', body: JSON.stringify({ title: nextTitle.trim() }) }); await refresh(); }, 'Task updated.');
  }
  async function deleteTask(task) {
    await run(async () => { await api('/api/tasks/' + task._id, { method: 'DELETE' }); await refresh(); }, 'Task deleted.');
  }
  async function addHabit(event) {
    event.preventDefault(); if (!habitName.trim()) return;
    await run(async () => { await api('/api/habits', { method: 'POST', body: JSON.stringify({ name: habitName.trim() }) }); setHabitName(''); await refresh(); }, 'Habit added.');
  }
  async function completeHabit(habit) {
    await run(async () => { await api('/api/habits/' + habit._id + '/completions/' + date, { method: 'PUT' }); await refresh(); }, 'Habit marked complete.');
  }
  async function makePlan(event) {
    event.preventDefault(); setProposal(null);
    await run(async () => {
      const data = await api('/api/ai/plan', { method: 'POST', body: JSON.stringify({ goals, date, availableMinutes: Number(minutes) }) });
      setProposal(data.plan); setMessage(data.response || 'Your plan is ready to review.');
    });
  }
  async function approvePlan() {
    if (!proposal) return;
    await run(async () => { await api('/api/ai/plan/' + proposal._id + '/approve', { method: 'POST' }); setProposal(null); setGoals(''); await refresh(); }, 'Plan approved and tasks added.');
  }

  const taskPercent = progress ? progress.tasks.completionPercentage : 0;
  const habitPercent = progress ? progress.habits.completionPercentage : 0;
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">d</span> daypilot</a><label className="date-control">Planning for <input aria-label="Planning date" type="date" value={date} onChange={event => setDate(event.target.value)} /></label></header>
    <section className="welcome" id="top"><div><p className="eyebrow">YOUR DAY, IN FOCUS</p><h1>A little progress<br /><em>goes a long way.</em></h1><p className="subhead">A clear plan for today, one step at a time.</p></div><div className="welcome-stamp"><span>DAY</span><strong>{date.slice(-2)}</strong><span>BY DAY</span></div></section>
    {(error || message) && <div className={'notice ' + (error ? 'notice-error' : 'notice-ok')} role="status">{error || message}<button onClick={() => { setError(''); setMessage(''); }} aria-label="Dismiss">×</button></div>}
    <section className="summary-grid" aria-label="Daily progress">
      <article className="summary-card summary-dark"><div className="card-label">TASKS COMPLETE <span>↗</span></div><strong>{progress ? progress.tasks.completed + '/' + progress.tasks.total : '—'}</strong><div className="meter"><i style={{ width: taskPercent + '%' }} /></div><small>{taskPercent}% of your tasks</small></article>
      <article className="summary-card"><div className="card-label">HABITS TODAY <span>✳</span></div><strong>{progress ? progress.habits.completed + '/' + progress.habits.active : '—'}</strong><div className="meter meter-light"><i style={{ width: habitPercent + '%' }} /></div><small>{habitPercent}% checked in</small></article>
      <article className="quote-card"><span className="quote-mark">“</span><p>Small steps every day add up to big change.</p><small>— James Clear</small></article>
    </section>
    <div className="content-grid">
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">MAKE IT COUNT</p><h2>Today's tasks <span className="count-pill">{tasks.length}</span></h2></div><span className="heading-icon">↗</span></div>
        <form className="inline-form" onSubmit={addTask}><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Add something to your day..." aria-label="New task" /><button className="add-button" type="submit" disabled={!title.trim()}>＋</button></form>
        {loading && !progress ? <p className="empty-state">Loading your day…</p> : tasks.length === 0 ? <p className="empty-state">Nothing on the list yet. Add your first task above.</p> : <ul className="task-list">{tasks.map(task => <li className={'task-row ' + (task.completed ? 'is-complete' : '')} key={task._id}><button className="check-button" aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'} onClick={() => toggleTask(task)}>{task.completed ? '✓' : ''}</button><div className="task-copy"><span>{task.title}</span><small className={'priority priority-' + task.priority}>{task.priority}</small></div><button className="text-button" onClick={() => editTask(task)}>Edit</button><button className="icon-button" aria-label={'Delete ' + task.title} onClick={() => deleteTask(task)}>×</button></li>)}</ul>}
        <div className="panel-footer"><span>{progress ? progress.tasks.pending : 0} left to do</span><span className="footer-spark">✳</span></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">SHOW UP FOR YOURSELF</p><h2>Daily habits</h2></div><span className="heading-icon">✳</span></div>
        <form className="inline-form" onSubmit={addHabit}><input value={habitName} onChange={event => setHabitName(event.target.value)} placeholder="Add a habit to track..." aria-label="New habit" /><button className="add-button" type="submit" disabled={!habitName.trim()}>＋</button></form>
        {habits.length === 0 ? <p className="empty-state">No habits yet. Add one small thing you want to do regularly.</p> : <ul className="habit-list">{habits.map((habit, index) => {
          const done = habit.completions?.some(completion => completion.date === date);
          return <li className="habit-row" key={habit._id}><span className={'habit-glyph glyph-' + (index % 3)}>{['✳', '◌', '↗'][index % 3]}</span><span className="habit-name">{habit.name}</span><button className={'habit-check ' + (done ? 'done' : '')} disabled={done} onClick={() => completeHabit(habit)}>{done ? 'Done ✓' : 'Check in'}</button></li>;
        })}</ul>}
        <div className="panel-footer"><span>{progress ? progress.habits.completed : 0} of {progress ? progress.habits.active : 0} completed</span><span className="footer-spark">✳</span></div>
      </section>
      <section className="panel assistant-panel">
        <div className="assistant-intro"><div className="assistant-icon">✦</div><div><p className="eyebrow">A THOUGHTFUL CO-PILOT</p><h2>Plan with DayPilot</h2><p>Tell me what matters today. I’ll shape it into a realistic plan using your tasks and habits.</p></div></div>
        <form onSubmit={makePlan} className="ai-form"><label htmlFor="goals">What would you like to get done?</label><textarea id="goals" rows="3" value={goals} onChange={event => setGoals(event.target.value)} placeholder="e.g. Prepare for my presentation and get outside for a walk" /><div className="ai-form-bottom"><label className="minutes-label">Time available <input type="number" min="5" max="1440" value={minutes} onChange={event => setMinutes(event.target.value)} /> min</label><button className="primary-button" disabled={!goals.trim() || loading}>{loading ? 'Thinking…' : 'Build my plan'} <span>↗</span></button></div></form>
        {proposal && <div className="proposal"><div className="proposal-title"><div><p className="eyebrow">READY FOR YOUR REVIEW</p><h3>{proposal.summary}</h3></div><span className="pending-tag">DRAFT</span></div><ol>{proposal.tasks.map((task, index) => <li key={task.title + index}><div><strong>{task.title}</strong><small>{task.reasoning}</small></div><span>{task.estimatedMinutes}m</span></li>)}</ol><button className="primary-button approve-button" onClick={approvePlan}>Approve and add tasks <span>✓</span></button></div>}
      </section>
    </div>
    <footer className="page-footer"><span>Made for today. Ready for tomorrow.</span><span>DAYPILOT · DAILY, BY DESIGN</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
