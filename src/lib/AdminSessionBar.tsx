'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminSessionBar() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setUserEmail(session?.user?.email ?? null);
    if (!session) {
      setRole(null);
      return;
    }
    const result = await supabase.rpc('editorial_current_role');
    setRole(result.error ? null : (result.data as string | null));
  }

  useEffect(() => {
    void refreshSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void refreshSession(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setBusy(true);
    setMessage('');
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }
    await refreshSession();
    setMessage('Sesión editorial iniciada.');
    setBusy(false);
    window.location.reload();
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      setMessage('Escribe el correo editorial.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setMessage(result.error ? result.error.message : 'Enlace de acceso enviado al correo.');
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
    setUserEmail(null);
    window.location.reload();
  }

  if (userEmail) {
    return (
      <div className="admin-session">
        <div className="admin-session-copy">
          <span>Sesión editorial</span>
          <strong>{role ? role.toUpperCase() : 'SIN ROL'}</strong>
          <small>{userEmail}</small>
        </div>
        <button className="btn btn-compact" type="button" onClick={() => void signOut()}>
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="admin-session">
      <div className="admin-session-copy">
        <span>Vista pública</span>
        <strong>Solo publicados</strong>
        <small>Inicia sesión para ver borradores y revisión.</small>
      </div>
      <button className="btn btn-compact" type="button" onClick={() => setOpen((x) => !x)}>
        Acceso editorial
      </button>
      {open ? (
        <div className="admin-login-popover">
          <strong>Acceso al Centro Editorial</strong>
          <input className="input" type="email" placeholder="Correo editorial" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
          {message ? <small>{message}</small> : null}
          <div className="admin-login-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void signIn()}>Entrar</button>
            <button className="btn" type="button" disabled={busy} onClick={() => void sendMagicLink()}>Enviar enlace</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
