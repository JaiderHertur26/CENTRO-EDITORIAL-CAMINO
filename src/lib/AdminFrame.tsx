'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AdminSessionBar from '@/lib/AdminSessionBar';

const navGroups = [
  {
    label: 'Centro Editorial',
    items: [
      ['/admin', '⌂', 'Inicio'],
      ['/admin/editions', '✎', 'Ediciones'],
      ['/admin/liturgy', '✠', 'Liturgia diaria'],
      ['/admin/calendar', '◫', 'Calendario litúrgico'],
    ],
  },
  {
    label: 'Contenido',
    items: [
      ['/admin/saints', '☆', 'Santoral'],
      ['/admin/prayers', '☼', 'Oraciones'],
      ['/admin/audio', '♫', 'Audio'],
      ['/admin/formation', '▤', 'Formación'],
      ['/admin/pastoral', '⌖', 'Pastoral'],
      ['/admin/san-miguel', '⚔', 'San Miguel'],
      ['/admin/homilies', '◉', 'Homilías'],
      ['/admin/sources', '◇', 'Fuentes'],
    ],
  },  {
    label: 'Gobierno editorial',
    items: [
      ['/admin/review', '✓', 'Cola de revisión'],
      ['/admin/governance', '✠', 'Gobierno Editorial'],
      ['/admin/control', '◎', 'Control de calidad'],
      ['/admin/status', '●', 'Estado editorial'],
    ],
  },
] as const;

export default function AdminFrame({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <img className="brand-cross" src="/centro-editorial-icon.svg?v=20260921" alt="" aria-hidden="true" />
          <span>
            <strong>CAMINO</strong>
            <small>Centro Editorial</small>
          </span>
        </Link>        <div className="sidebar-source">
          <span className="source-kicker">FUENTE DE VERDAD</span>
          <strong>Supabase</strong>
          <small>El Centro Editorial administra, revisa y publica.</small>
        </div>

        <div className="sidebar-nav-groups">
          {navGroups.map((group) => (
            <section className="sidebar-nav-group" key={group.label}>
              <p className="sidebar-nav-label">{group.label}</p>
              <nav>
                {group.items.map(([href, icon, label]) => {
                  const active = pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="nav-glyph">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>

        <div className="sidebar-footer">
          <span><span className="quality-dot ok" />Flujo editorial activo</span>
          <small>Borrador → revisión → aprobación → publicación</small>
        </div>
      </aside>      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-copy">
            <p className="eyebrow">CAMINO · CENTRO EDITORIAL</p>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="topbar-actions">
            {badge ? <span className="status-pill">{badge}</span> : null}
            <Link className="btn topbar-status-link" href="/admin/status">Estado</Link>
            <AdminSessionBar />
          </div>
        </header>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
