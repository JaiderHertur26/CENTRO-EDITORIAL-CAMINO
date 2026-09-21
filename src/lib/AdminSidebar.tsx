'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const groups = [
  {
    label: 'Centro Editorial',
    items: [
      { href: '/admin', label: 'Puente CAMINO', icon: '⇄' },
      { href: '/admin/liturgy', label: 'Liturgia Diaria', icon: '✠' },
      { href: '/admin/calendar', label: 'Calendario Litúrgico', icon: '◷' },
      { href: '/admin/saints', label: 'Santoral', icon: '☆' },
      { href: '/admin/prayers', label: 'Oraciones', icon: '☼' },
      { href: '/admin/audio', label: 'Audio', icon: '♫' },
      { href: '/admin/review', label: 'Cola de Revisión', icon: '✓' },
      { href: '/admin/control', label: 'Control Editorial', icon: '⌘' },
      { href: '/admin/status', label: 'Estado Editorial', icon: '◎' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { href: '/admin/formation', label: 'Formación', icon: '▤' },
      { href: '/admin/pastoral', label: 'Pastoral', icon: '⌖' },
      { href: '/admin/san-miguel', label: 'San Miguel', icon: '⚔' },
      { href: '/admin/homilies', label: 'Homilías', icon: '◉' },
      { href: '/admin/sources', label: 'Fuentes', icon: '◇' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar editorial-sidebar">
      <div className="brand">
        <div className="brand-mark">✠</div>
        <h1>CAMINO</h1>
        <p>Centro Editorial<br />Supabase ↔ CAMINO</p>
      </div>
      {groups.map((group) => (
        <nav className="nav nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            return (
              <Link className={'nav-item nav-link' + (active ? ' active' : '')} href={item.href} key={item.href}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ))}
      <div className="sidebar-note">
        Publica y valida exactamente los catálogos que consume la aplicación móvil.
      </div>
    </aside>
  );
}
