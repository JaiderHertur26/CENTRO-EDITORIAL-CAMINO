'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import { editorialTables, tableCount } from '@/lib/tableStats';
import { supabase } from '@/lib/supabase';

type Stat = { table: string; count: number; error: string | null };
type MasterFeature = { table: string; label: string; purpose: string; bridge: string };
type MasterStat = MasterFeature & { available: boolean; error: string | null };

const masterFeatures: MasterFeature[] = [
  { table: 'editorial_sources', label: 'Fuentes editoriales', purpose: 'Procedencia base del contenido.', bridge: 'Fuente canónica operativa de CAMINO.' },
  { table: 'source_reference', label: 'Referencias exactas', purpose: 'Cita concreta: número, sección, página o pasaje.', bridge: 'V2.1 activo; incluye referencias generales migradas desde las fuentes existentes.' },
  { table: 'content_source', label: 'Contenido ↔ fuente', purpose: 'Relación normalizada y verificable entre cada contenido y su sustento.', bridge: 'V2.1 activo; materializa source_ids/source_id sin eliminar los campos heredados.' },
  { table: 'editorial_content_policy', label: 'Política por contenido', purpose: 'Define cuándo son obligatorias fuentes y revisión doctrinal.', bridge: 'V2.1 activo; gobierna aprobación y publicación.' },
  { table: 'editorial_status', label: 'Catálogo de estados editoriales', purpose: 'DRAFT · IN_REVIEW · DOCTRINAL_REVIEW · APPROVED · SCHEDULED · PUBLISHED…', bridge: 'V2 activo; convive con review_status para compatibilidad.' },
  { table: 'editorial_item_state', label: 'Estado maestro por contenido', purpose: 'Puente entre las tablas especializadas actuales y el flujo maestro.', bridge: 'V2 activo; conserva estados avanzados durante ediciones normales.' },
  { table: 'doctrinal_level', label: 'Nivel doctrinal', purpose: 'Distingue enseñanza definida, magisterial, opinión legítima, devoción privada o incertidumbre.', bridge: 'V2 activo con seis niveles.' },
  { table: 'doctrinal_review', label: 'Revisión doctrinal', purpose: 'Decisión del revisor autorizado con comentarios y fecha.', bridge: 'V2 activo; requerido por política para contenido doctrinal sensible.' },
  { table: 'content_revision', label: 'Historial de versiones', purpose: 'Conserva antes/después y resumen de cada cambio importante.', bridge: 'V2 activo; complementa el contador revision heredado.' },
  { table: 'audit_log', label: 'Auditoría V2', purpose: 'Registra transiciones maestras y actividad de gobierno.', bridge: 'Se presenta junto con editorial_audit_log histórico sin duplicarlo.' },
  { table: 'role', label: 'Roles', purpose: 'Autor · Editor · Revisor doctrinal · Publicador · Administrador…', bridge: 'Catálogo formal conectado al sistema editorial operativo.' },
  { table: 'permission', label: 'Permisos granulares', purpose: 'Permisos declarativos separados de condiciones codificadas.', bridge: 'V2 activo.' },
  { table: 'role_permission', label: 'Rol ↔ permiso', purpose: 'Matriz declarativa de capacidades por rol.', bridge: 'V2 activo; complementa editorial_current_role/editorial_has_role.' },
];

const labels: Record<string, string> = {
  daily_readings: 'Lecturas diarias',
  liturgical_days: 'Calendario litúrgico',
  saints: 'Santoral',
  prayers: 'Oraciones',
  audio_assets: 'Audio',
  editorial_sources: 'Fuentes editoriales',
  formation_tracks: 'Rutas de formación',
  formation_lessons: 'Lecciones de formación',
  pastoral_entities: 'Entidades pastorales',
  pastoral_schedules: 'Horarios pastorales',
  pastoral_public_events: 'Eventos pastorales',
  pastoral_announcements: 'Avisos pastorales',
  spiritual_series: 'Series espirituales',
  spiritual_series_days: 'Jornadas de series',
  weekly_homilies: 'Homilías',
};

export default function Page() {
  const [rows, setRows] = useState<Stat[]>([]);
  const [masterRows, setMasterRows] = useState<MasterStat[]>([]);
  const [loading, setLoading] = useState(true);

  async function checkMasterFeature(feature: MasterFeature): Promise<MasterStat> {
    const result = await supabase.from(feature.table).select('*').limit(1);
    return { ...feature, available: !result.error, error: result.error?.message ?? null };
  }

  async function load() {
    setLoading(true);
    const [editorial, master] = await Promise.all([
      Promise.all(editorialTables.map(tableCount)),
      Promise.all(masterFeatures.map(checkMasterFeature)),
    ]);
    setRows(editorial);
    setMasterRows(master);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const available = rows.filter(row => !row.error).length;
    const issues = rows.filter(row => row.error).length;
    const records = rows.reduce((sum, row) => sum + (row.error ? 0 : row.count), 0);
    const health = rows.length ? Math.round((available / rows.length) * 100) : 0;
    return { available, issues, records, health };
  }, [rows]);

  const masterSummary = useMemo(() => {
    const available = masterRows.filter(row => row.available).length;
    const pending = Math.max(0, masterRows.length - available);
    const progress = masterRows.length ? Math.round((available / masterRows.length) * 100) : 0;
    return { available, pending, progress };
  }, [masterRows]);

  return (
    <AdminFrame
      title="Control de calidad"
      subtitle="Integridad operativa de las colecciones que alimentan CAMINO"
      badge={summary.issues ? summary.issues + ' incidencias' : 'Estructura disponible'}
    >
      <section className="quality-command-hero">
        <div>
          <p className="eyebrow">CALIDAD · TRAZABILIDAD</p>
          <h2>Antes de publicar, comprobar que el puente está sano.</h2>
          <p>
            Esta vista consulta Supabase de forma no destructiva y comprueba que cada colección editorial
            necesaria para CAMINO esté disponible.
          </p>
        </div>
        <div className="quality-score">
          <span>Salud editorial</span>
          <strong>{loading ? '…' : summary.health + '%'}</strong>
          <small>{loading ? 'Consultando…' : summary.available + ' de ' + editorialTables.length + ' colecciones disponibles'}</small>
        </div>
      </section>

      <section className="quality-kpi-grid">
        <article><span>Colecciones</span><strong>{editorialTables.length}</strong><small>Estructura esperada</small></article>
        <article><span>Disponibles</span><strong>{loading ? '…' : summary.available}</strong><small>Acceso correcto</small></article>
        <article><span>Registros</span><strong>{loading ? '…' : summary.records.toLocaleString('es-CO')}</strong><small>Contenido consultable</small></article>
        <article className={summary.issues ? 'quality-alert' : ''}><span>Incidencias</span><strong>{loading ? '…' : summary.issues}</strong><small>{summary.issues ? 'Requieren atención' : 'Sin errores de acceso'}</small></article>
      </section>

      <div className="quality-actions">
        <div>
          <p className="eyebrow dark">PUERTAS CRÍTICAS</p>
          <strong>Operación editorial</strong>
        </div>
        <div>
          <Link className="btn" href="/admin/liturgy">Liturgia diaria</Link>
          <Link className="btn" href="/admin/review">Cola de Revisión</Link>
          <Link className="btn" href="/admin/sources">Fuentes</Link>
          <button className="btn-primary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Comprobando…' : 'Comprobar de nuevo'}
          </button>
        </div>
      </div>

      <section className="quality-table-card">
        <div className="quality-table-head">
          <div>
            <h3>Cobertura de Supabase</h3>
            <p>Lectura no destructiva de las colecciones editoriales registradas.</p>
          </div>
          <span>{summary.available}/{editorialTables.length}</span>
        </div>

        <div className="quality-table">
          {loading ? <div className="empty">Consultando Supabase…</div> : rows.map((row) => (
            <div className="quality-table-row" key={row.table}>
              <div className="quality-table-name">
                <span className={'quality-status-dot ' + (row.error ? 'bad' : 'ok')} />
                <div>
                  <strong>{labels[row.table] ?? row.table}</strong>
                  <small>{row.table}</small>
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

      <section className="quality-table-card master-compliance-card">
        <div className="quality-table-head">
          <div>
            <p className="eyebrow dark">ARQUITECTURA MAESTRA</p>
            <h3>Conformidad con el Modelo Maestro</h3>
            <p>Comprobación no destructiva de las piezas de gobierno editorial previstas para CAMINO.</p>
          </div>
          <span>{loading ? '…' : masterSummary.available + '/' + masterFeatures.length}</span>
        </div>

        <div className="master-compliance-summary">
          <div><span>Implementado</span><strong>{loading ? '…' : masterSummary.available}</strong></div>
          <div><span>Pendiente estructural</span><strong>{loading ? '…' : masterSummary.pending}</strong></div>
          <div><span>Avance estructural</span><strong>{loading ? '…' : masterSummary.progress + '%'}</strong></div>
        </div>

        <div className="quality-table">
          {loading ? <div className="empty">Contrastando Supabase con el Modelo Maestro…</div> : masterRows.map((row) => (
            <div className="quality-table-row master-compliance-row" key={row.table}>
              <div className="quality-table-name">
                <span className={'quality-status-dot ' + (row.available ? 'ok' : 'bad')} />
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.table}</small>
                </div>
              </div>
              <div className="master-compliance-purpose">
                <span>{row.purpose}</span>
                <small>{row.bridge}</small>
              </div>
              <div className={'quality-table-state ' + (row.available ? 'ok' : 'bad')}>
                {row.available ? 'Implementado en Supabase' : 'Pendiente estructural'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="editorial-principle">
        <div>
          <span className="principle-mark">◎</span>
          <div>
            <strong>Este control no modifica contenido</strong>
            <p>Los conteos y estados se leen directamente desde Supabase. Las decisiones editoriales se realizan en sus módulos y en la Cola de Revisión.</p>
          </div>
        </div>
        <Link href="/admin/status">Ver diagnóstico →</Link>
      </aside>
    </AdminFrame>
  );
}
