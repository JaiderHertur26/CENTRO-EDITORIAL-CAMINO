'use client';

import { useEffect } from 'react';

export default function ConfirmedEmailPage() {
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const openCamino = () => {
    window.location.href = 'caminov1:///account';
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 20px',
        background: 'linear-gradient(160deg, #f6f1e7 0%, #ffffff 52%, #edf5f7 100%)',
        color: '#18324A',
      }}
    >
      <section
        style={{
          width: 'min(560px, 100%)',
          border: '1px solid rgba(24,50,74,.12)',
          borderRadius: 28,
          background: 'rgba(255,255,255,.94)',
          boxShadow: '0 24px 70px rgba(24,50,74,.12)',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 18 }}>✓</div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#A27B35',
          }}
        >
          CAMINO · CUENTA Y RESPALDO
        </p>
        <h1
          style={{
            margin: '14px 0 10px',
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(30px, 6vw, 42px)',
            lineHeight: 1.08,
          }}
        >
          Correo confirmado
        </h1>
        <p
          style={{
            margin: '0 auto',
            maxWidth: 430,
            fontSize: 17,
            lineHeight: 1.65,
            color: '#536577',
          }}
        >
          Tu dirección de correo quedó verificada correctamente. Ya puedes volver a CAMINO e ingresar con tu correo y contraseña.
        </p>

        <button
          type="button"
          onClick={openCamino}
          style={{
            marginTop: 28,
            minHeight: 52,
            width: '100%',
            border: 0,
            borderRadius: 16,
            background: '#18324A',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Volver a CAMINO
        </button>

        <p style={{ margin: '18px 0 0', fontSize: 13, lineHeight: 1.5, color: '#7A8792' }}>
          Si estás en un computador, puedes cerrar esta ventana y continuar en la aplicación del teléfono.
        </p>
      </section>
    </main>
  );
}
