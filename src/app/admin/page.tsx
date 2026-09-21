'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import { editorialTables, tableCount } from '@/lib/tableStats';

type Stat = { table: string; count: number; error: string | null };

const primaryModules = [
  ['/admin/liturgy', '✠', 'Liturgia diaria', 'Lecturas, Salmo responsorial, aclamación y Evangelio.', 'Diario'],
  ['/admin/saints', '☆', 'Santoral', 'Biografías, imágenes, procedencia, créditos y licencias.', 'Catálogo'],
  ['/admin/prayers', '☼', 'Oraciones', 'Contenido de oración, reflexión y propósito.', 'Catálogo'],
  ['/admin/san-miguel', '⚔', '365 días con San Miguel', 'Serie diaria, videos, publicación y progresión.', 'Serie'],
] as const;

const governanceModules = [
  ['/admin/review', '✓', 'Cola de revisión', 'Control humano antes de publicar contenido a CAMINO.'],
  ['/admin/control', '◎', 'Control de calidad', 'Integridad de tablas y accesibilidad editorial.'],
  ['/admin/sources', '◇', 'Fuentes', 'Trazabilidad y procedencia de cada pieza editorial.'],
] as const;

export default function Page() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all(editorialTables.map(tableCount))
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const available = stats.filter((row) => !row.error).length;
    const records = stats.reduce((sum, row) => sum + (row.error ? 0 : row.count), 0);
    const issues = stats.filter((row) => row.error).length;
    return { available, records, issues };
  }, [stats]);  return (
    <AdminFrame
      title="Centro Editorial"
      subtitle="Edición, revisión y publicación del contenido que nutre CAMINO"
      badge="Supabase ↔ CAMINO"
    >
      <section className="editorial-command-hero">
        <div className="editorial-command-copy">
          <p className="eyebrow">CENTRO EDITORIAL · CAMINO</p>
          <h2>Una mesa de trabajo para cuidar todo lo que CAMINO comunica.</h2>
          <p>
            Supabase conserva la información. Este Centro Editorial la organiza para trabajarla con criterio:
            editar, revisar, validar y publicar sin duplicar la fuente de datos.
          </p>
          <div className="editorial-command-actions">
            <Link className="btn-primary" href="/admin/editions">Abrir Ediciones</Link>
            <Link className="btn" href="/admin/review">Ir a Revisión</Link>
          </div>
        </div>

        <div className="editorial-flow-panel">
          <p className="flow-label">FLUJO EDITORIAL</p>
          <div className="editorial-flow-step"><span>01</span><div><strong>Editar</strong><small>Preparar contenido</small></div></div>
          <div className="editorial-flow-line" />
          <div className="editorial-flow-step"><span>02</span><div><strong>Revisar</strong><small>Comprobar calidad</small></div></div>
          <div className="editorial-flow-line" />
          <div className="editorial-flow-step"><span>03</span><div><strong>Publicar</strong><small>Entregar a CAMINO</small></div></div>
        </div>
      </section>

      <section className="editorial-kpi-grid" aria-label="Estado editorial">
        <article className="editorial-kpi"><span>Tablas editoriales</span><strong>{editorialTables.length}</strong><small>Estructura esperada</small></article>
        <article className="editorial-kpi"><span>Disponibles</span><strong>{loading ? '…' : summary.available}</strong><small>Lectura desde Supabase</small></article>
        <article className="editorial-kpi"><span>Registros</span><strong>{loading ? '…' : summary.records.toLocaleString('es-CO')}</strong><small>Contenido consultable</small></article>
        <article className={'editorial-kpi ' + (summary.issues ? 'editorial-kpi-alert' : '')}><span>Incidencias</span><strong>{loading ? '…' : summary.issues}</strong><small>{summary.issues ? 'Requieren revisión' : 'Sin errores de acceso'}</small></article>
      </section>
      <section className="editorial-section">
        <div className="editorial-section-head">
          <div>
            <p className="eyebrow">TRABAJO PRINCIPAL</p>
            <h3>Contenido que nutre la aplicación</h3>
            <p>Accesos directos a los catálogos de mayor uso editorial.</p>
          </div>
          <Link className="text-link" href="/admin/editions">Ver todos los editores →</Link>
        </div>

        <div className="editorial-module-grid">
          {primaryModules.map(([href, icon, title, copy, badge]) => (
            <Link className="editorial-module-card" href={href} key={href}>
              <div className="editorial-module-top">
                <span className="module-icon">{icon}</span>
                <span className="module-badge">{badge}</span>
              </div>
              <div>
                <h4>{title}</h4>
                <p>{copy}</p>
              </div>
              <span className="module-open">Abrir editor <b>→</b></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <div className="editorial-section-head">
          <div>
            <p className="eyebrow">GOBIERNO EDITORIAL</p>
            <h3>Calidad antes de llegar a CAMINO</h3>
            <p>Revisión humana, integridad técnica y trazabilidad de fuentes.</p>
          </div>
        </div>

        <div className="editorial-governance-grid">
          {governanceModules.map(([href, icon, title, copy]) => (
            <Link className="editorial-governance-card" href={href} key={href}>
              <span className="module-icon compact">{icon}</span>
              <div><h4>{title}</h4><p>{copy}</p></div>
              <span>→</span>
            </Link>
          ))}
        </div>
      </section>
      <aside className="editorial-principle">
        <div>
          <span className="principle-mark">✦</span>
          <div>
            <strong>Principio de operación</strong>
            <p>Guardar conserva el trabajo en Supabase. Publicar es una decisión editorial separada y controlada.</p>
          </div>
        </div>
        <Link href="/admin/status">Comprobar estado →</Link>
      </aside>
    </AdminFrame>
  );
}
