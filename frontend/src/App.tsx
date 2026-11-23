import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, LayoutDashboard, Receipt, LogOut, Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
type User = { id: number; username: string; email: string };
type Tx = { id: number; amount: string; description: string; category: string; type: 'income'|'expense'; created_at: string };
type Summary = { income: string; expenses: string; balance: string };

function money(value: string | number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(value));
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('bf_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: '0', expenses: '0', balance: '0' });
  const [authMode, setAuthMode] = useState<'login'|'register'>('login');
  const [auth, setAuth] = useState({ username: '', email: '', password: '' });
  const [form, setForm] = useState({ amount: '', description: '', category: 'Еда', type: 'expense' as 'income'|'expense' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Что-то пошло не так');
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function loadData() {
    const [me, tx, totals] = await Promise.all([
      request('/auth/me'), request('/transactions'), request('/summary')
    ]);
    setUser(me); setTransactions(tx); setSummary(totals);
  }

  useEffect(() => {
    if (token) loadData().catch(() => { localStorage.removeItem('bf_token'); setToken(''); setUser(null); });
  }, [token]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (authMode === 'register') {
        await fetch(`${API}/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: auth.username, email: auth.email, password: auth.password }),
        }).then(async r => { if (!r.ok) { const b = await r.json(); throw new Error(b.detail || 'Ошибка регистрации'); } });
      }
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auth.email, password: auth.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Ошибка входа');
      localStorage.setItem('bf_token', data.access_token); setToken(data.access_token);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
    finally { setBusy(false); }
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      await request('/transactions', { method: 'POST', body: JSON.stringify({ ...form, amount: form.amount.replace(',', '.') }) });
      setForm({ amount: '', description: '', category: 'Еда', type: 'expense' });
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
  }

  async function removeTransaction(id: number) {
    try { await request(`/transactions/${id}`, { method: 'DELETE' }); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
  }

  function logout() {
    localStorage.removeItem('bf_token'); setToken(''); setUser(null); setTransactions([]);
    setSummary({ income: '0', expenses: '0', balance: '0' });
  }

  const recent = useMemo(() => transactions.slice(0, 8), [transactions]);

  if (!token || !user) return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="brand"><span className="brand-icon"><Wallet size={22}/></span><b>BudgetFlow</b></div>
        <p className="eyebrow">ЛИЧНЫЕ ФИНАНСЫ БЕЗ ХАОСА</p>
        <h1>{authMode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h1>
        <p className="muted">Управляй доходами и расходами в одном месте.</p>
        {authMode === 'register' && <label>Имя пользователя<input required minLength={3} value={auth.username} onChange={e=>setAuth({...auth,username:e.target.value})} placeholder="например, alex"/></label>}
        <label>Email<input required type="email" value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} placeholder="you@example.com"/></label>
        <label>Пароль<input required minLength={8} type="password" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})} placeholder="Минимум 8 символов"/></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Подождите…' : authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        <p className="switch">{authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('')}}>{authMode==='login'?'Регистрация':'Войти'}</button></p>
      </form>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon"><Wallet size={22}/></span><b>BudgetFlow</b></div>
        <nav><a className="active"><LayoutDashboard size={18}/>Главная</a><a><Receipt size={18}/>Транзакции</a></nav>
        <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{user.username[0]?.toUpperCase()}</div><div><b>{user.username}</b><small>{user.email}</small></div></div><button type="button" className="logout" onClick={logout}><LogOut size={17}/>Выйти</button></div>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">ОБЗОР ФИНАНСОВ</p><h1>Привет, {user.username} 👋</h1><p className="muted">Вот что происходит с твоими финансами.</p></div><div className="date-chip">Личный кабинет</div></header>
        {error && <p className="error">{error}</p>}
        <section className="stats">
          <article className="stat-card"><div className="stat-top"><span>Общий баланс</span><Wallet/></div><strong>{money(summary.balance)}</strong><small>Доходы минус расходы</small></article>
          <article className="stat-card"><div className="stat-top"><span>Доходы</span><TrendingUp/></div><strong className="green">{money(summary.income)}</strong><small>Все поступления</small></article>
          <article className="stat-card"><div className="stat-top"><span>Расходы</span><TrendingDown/></div><strong className="red">{money(summary.expenses)}</strong><small>Все списания</small></article>
        </section>
        <section className="lower">
          <article className="panel transactions">
            <div className="panel-heading"><div><h2>Последние операции</h2><p className="muted">Твои доходы и расходы</p></div><span className="count">{transactions.length} всего</span></div>
            {recent.length === 0 ? <div className="empty">Пока нет операций. Добавь первую справа →</div> : recent.map(tx=><div className="tx-row" key={tx.id}><div className={`tx-icon ${tx.type}`}>{tx.type==='income'?<ArrowDownRight/>:<ArrowUpRight/>}</div><div className="tx-info"><b>{tx.description}</b><small>{tx.category} · {new Date(tx.created_at).toLocaleString('ru-RU')}</small></div><strong className={tx.type==='income'?'green':'red'}>{tx.type==='income'?'+':'−'}{money(tx.amount)}</strong><button className="icon-btn" title="Удалить" onClick={()=>removeTransaction(tx.id)}><Trash2 size={16}/></button></div>)}
          </article>
          <article className="panel add-panel">
            <div className="panel-heading"><div><h2><Plus size={19}/> Добавить операцию</h2><p className="muted">Запиши новую транзакцию</p></div></div>
            <form onSubmit={addTransaction}>
              <div className="segmented"><button type="button" className={form.type==='expense'?'selected':''} onClick={()=>setForm({...form,type:'expense'})}>Расход</button><button type="button" className={form.type==='income'?'selected':''} onClick={()=>setForm({...form,type:'income'})}>Доход</button></div>
              <label>Сумма, ₽<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></label>
              <label>Описание<input required maxLength={200} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Например, продукты"/></label>
              <label>Категория<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Еда','Транспорт','Жильё','Развлечения','Здоровье','Зарплата','Другое'].map(c=><option key={c}>{c}</option>)}</select></label>
              <button className="primary"><Plus size={17}/>Добавить операцию</button>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}
