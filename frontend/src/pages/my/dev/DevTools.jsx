import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase.js';

export function Stub() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div style={{ padding: 24 }}>
      <p>이동한 경로: {location.pathname + location.search}</p>
      <button type="button" onClick={() => navigate('/')}>
        마이로 돌아가기
      </button>
    </div>
  );
}

export function DevLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithPassword(form);
    setMessage(error ? error.message : '로그인됨');
  };
  return (
    <form
      onSubmit={submit}
      style={{ display: 'flex', gap: 6, padding: 8, fontSize: 12, background: '#fff' }}
    >
      <input
        placeholder="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        placeholder="password"
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button type="submit">dev 로그인</button>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        로그아웃
      </button>
      <span>{message}</span>
    </form>
  );
}
