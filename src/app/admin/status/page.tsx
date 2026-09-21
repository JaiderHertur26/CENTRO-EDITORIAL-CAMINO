'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import { editorialTables, tableCount } from '@/lib/tableStats';
import { isSupabaseConfigured } from '@/lib/supabase';

type Stat = { table: string; count: number; error: string | null };

export default function Page() {
  const [rows, setRows] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setRows(await Promise.all(editorialTables.map(tableCount)));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const available = rows.filter(row => !row.error).length;
    const issues = rows.filter(row => row.error).length;
    const records = rows.reduce((sum, row) => sum + (row.error ? 0 : row.count), 0);
    return { available, issues, records };
  }, [rows]);

  return (
    <AdminFrame
      title="Estado editorial"
      subtitle="Conexión, cobertura y disponibilidad del Centro Editorial"
      badge={isSupabaseConfigured ? 'Supabase configurado' : 'Configurar .env.local'}
    >
      <section className="status-command-hero">
        <div>
          <p className="eyebrow">DIAGNÓSTICO · CAMINO</p>
          <h2>El Centro Editorial debe saber siempre de dónde lee y qué puede alcanzar.</h2>
          <p>
            Esta pantalla verifica la configuración local y realiza lecturas no destructivas sobre
            las colecciones editoriales de Supabase.
          </p>
        </div>
        <div className={'status-connection ' + (isSupabaseConfigured ? 'ok' : 'bad')}>
          <span className="status-connection-dot" />
          <div>
            <small>Configuración</small>
            <strong>{isSupabaseConfigured ? 'Supabase conectado' : 'Supabase no configurado'}</strong>
            <span>{isSupabaseConfigured ? '.env.local disponible' : 'Revisar variables de entorno'}</span>
          </div>
        </div>
      </section>

      <section className="status-kpi-grid">
        <article><span>Colecciones</span><strong>{editorialTables.length}</strong><small>Esperadas por el Centro</small></article>
        <article><span>Disponibles</span><strong>{loading ? '…' : summary.available}</strong><small>Lectura correcta</small></article>
        <article><span>Registros</span><strong>{loading ? '…' : summary.records.toLocaleString('es-CO')}</strong><small>Contenido accesible</small></article>
        <article className={summary.issues ? 'status-alert' : ''}><span>Incidencias</span><strong>{loading ? '…' : summary.issues}</strong><small>{summary.issues ? 'Revisar conexión o políticas' : 'Sin errores de acceso'}</small></article>
      </section>

      <div className="status-actions">
        <div>
          <strong>Diagnóstico no destructivo</strong>
          <p>Actualizar vuelve a consultar Supabase sin modificar ninguna fila.</p>
        </div>
        <div>
          <Link className="btn" href="/admin/control">Control de calidad</Link>
          <button className="btn-primary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Consultando…' : 'Actualizar diagnóstico'}
          </button>
        </div>
      </div>

      <section className="quality-table-card">
        <div className="quality-table-head">
          <div>
            <h3>Colecciones editoriales</h3>
            <p>Estado técnico de acceso desde el Centro Editorial.</p>
          </div>
          <span>{summary.available}/{editorialTables.length}</span>
        </div>
        <div className="quality-table">
          {loading ? <div className="empty">Consultando Supabase…</div> : rows.map((row) => (
            <div className="quality-table-row" key={row.table}>
              <div className="quality-table-name">
                <span className={'quality-status-dot ' + (row.error ? 'bad' : 'ok')} />
                <div>
                  <strong>{row.table}</strong>
                  <small>Supabase · lectura editorial</small>
                </div>
              </div>
              <div className="quality-table-count">
                <span>Registros</span>
                <strong>{row.error ? '—' : row.count.toLocaleString('es-CO')}</strong>
              </div>
              <div className={'quality-table-state ' + (row.error ? 'bad' : 'ok')}>
                {row.error ? row.error : 'Disponible'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminFrame>
  );
}
