import { Hono } from 'hono';
import Database from 'bun:sqlite';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });

const db = new Database(process.env.DATABASE_URL || './data/expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const app = new Hono();

app.get('/', async (c) => {
  const html = await Bun.file(`${import.meta.dir}/public/index.html`).text();
  return c.html(html);
});

app.get('/api/expenses', (c) => {
  const expenses = db.query('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all();
  return c.json(expenses);
});

app.post('/api/expenses', async (c) => {
  const body = await c.req.json();
  const { amount, category, description, date } = body;
  if (!amount || !category || !date) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  const r = db.prepare(
    'INSERT INTO expenses (amount, category, description, date) VALUES (?, ?, ?, ?)'
  ).run(Number(amount), category, description || '', date);
  return c.json({ id: r.lastInsertRowid, amount: Number(amount), category, description: description || '', date }, 201);
});

app.delete('/api/expenses/:id', (c) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(c.req.param('id'));
  return c.json({ ok: true });
});

app.get('/api/summary', (c) => {
  const total = (db.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses").get() as any).total;
  const thisMonth = (db.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')"
  ).get() as any).total;
  const count = (db.query("SELECT COUNT(*) as count FROM expenses").get() as any).count;
  const byCategory = db.query(
    'SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses GROUP BY category ORDER BY total DESC'
  ).all();
  return c.json({ total, thisMonth, count, byCategory });
});

export default { port: process.env.PORT || 3000, fetch: app.fetch };
