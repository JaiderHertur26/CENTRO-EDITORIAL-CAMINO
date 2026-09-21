'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
export default function Login(){
 const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMsg('');if(!isSupabaseConfigured){setMsg('Falta configurar .env.local con las claves públicas de Supabase.');setBusy(false);return;} const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)setMsg(error.message); else router.replace('/admin'); setBusy(false)}
 return <main className="login-shell"><form className="login-card" onSubmit={submit}><p className="eyebrow">CAMINO · CENTRO EDITORIAL</p><h1>Bienvenido</h1><p>Acceso al espacio de edición, revisión y publicación de CAMINO.</p><div className="stack"><label className="form-field"><span className="form-label">Correo</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label className="form-field"><span className="form-label">Contraseña</span><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{msg?<div className="message error">{msg}</div>:null}<button className="btn-primary" disabled={busy}>{busy?'Entrando…':'Entrar al Centro Editorial'}</button></div></form></main>
}
