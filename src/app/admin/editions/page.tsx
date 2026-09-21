'use client';

import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import styles from './EditorialHub.module.css';

const contentModules = [
  ['/admin/liturgy', '✠', 'Liturgia diaria', 'Texto completo de la Biblia CAMINO Latinoamericana, Salmo estructurado, aclamación y verificación.', 'Diario'],
  ['/admin/saints', '☆', 'Santoral', 'Biografía, imagen, procedencia, crédito y licencia.', 'Catálogo'],
  ['/admin/prayers', '☼', 'Oraciones', 'Contenido estructurado, Escritura, reflexión y propósito.', 'Catálogo'],
  ['/admin/audio', '♫', 'Audio', 'Asset, almacenamiento, loop, fallback y revisión editorial.', 'Media'],
  ['/admin/formation', '▤', 'Formación', 'Rutas, lecciones, Catecismo y fuentes.', 'Catequesis'],
  ['/admin/san-miguel', '⚔', '365 días con San Miguel', 'Serie, jornadas, release_date, video y progresión.', 'Serie'],
] as const;

const operationsModules = [
  ['/admin/pastoral', '⌖', 'Pastoral', 'Comunidades, horarios, eventos, avisos y solicitud de push.', 'Operación'],
  ['/admin/homilies', '◉', 'Homilías', 'Contenido audiovisual activo y destacado.', 'Media'],
  ['/admin/sources', '◇', 'Fuentes', 'Trazabilidad editorial compartida por todo CAMINO.', 'Gobierno'],
  ['/admin/review', '✓', 'Cola de Revisión', 'Validar, aprobar y publicar sin saltarse el workflow de Supabase.', 'Publicación'],
] as const;

function Card({ item, review = false }: { item: readonly [string, string, string, string, string], review?: boolean }) {
  const [href, icon, title, description, badge] = item;
  return (
    <Link className={`${styles.card} ${review ? styles.reviewCard : ''}`} href={href}>
      <div>
        <div className={styles.cardTop}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.badge}>{badge}</span>
        </div>
        <div style={{ marginTop: 16 }}>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>
      <span className={styles.open}><span>Abrir editor</span><span>→</span></span>
    </Link>
  );
}

export default function Page() {
  return (
    <AdminFrame title="Ediciones" subtitle="Centro de trabajo editorial de CAMINO" badge="Supabase ↔ CAMINO">
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>CENTRO EDITORIAL</p>
            <h2>Edita una vez. Publica con control.</h2>
            <p>
              Aquí se prepara el contenido que se guarda en Supabase y luego consume la aplicación.
              Los formularios están organizados por trabajo real, no por estructura técnica de la base de datos.
            </p>
          </div>
          <div className={styles.flow} aria-label="Flujo editorial">
            <div className={styles.flowStep}><strong>Editar</strong><span>Contenido</span></div>
            <span className={styles.arrow}>→</span>
            <div className={styles.flowStep}><strong>Revisar</strong><span>Calidad</span></div>
            <span className={styles.arrow}>→</span>
            <div className={styles.flowStep}><strong>Publicar</strong><span>CAMINO</span></div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><h3>Contenido principal</h3><p>Lo que las personas leen, rezan, escuchan y siguen en CAMINO.</p></div>
          </div>
          <div className={styles.grid}>{contentModules.map(item => <Card item={item} key={item[0]} />)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><h3>Operación y gobierno</h3><p>Pastoral, audiovisual, trazabilidad y publicación.</p></div>
          </div>
          <div className={styles.grid}>
            {operationsModules.map(item => <Card item={item} review={item[0] === '/admin/review'} key={item[0]} />)}
          </div>
        </section>

        <div className={styles.note}>
          <strong>Regla editorial:</strong> guardar no significa publicar. Los cambios se conservan en Supabase y la salida hacia la aplicación se controla desde la revisión correspondiente.
        </div>
      </div>
    </AdminFrame>
  );
}
