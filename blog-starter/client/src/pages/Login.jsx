import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';

export function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@blog.local', password: 'Admin123!' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page narrow">
      <form className="panel" onSubmit={submit}>
        <h1>Yayımcı Girişi</h1>
        <label>E-posta<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Şifre<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
      </form>
    </section>
  );
}
