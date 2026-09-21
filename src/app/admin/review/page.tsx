'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import { supabase } from '@/lib/supabase';

const tables = [
  'daily_readings',
  'liturgical_days',
  'saints',
  'prayers',
  'audio_assets',
  'editorial_sources',
  'formation_tracks',
  'formation_lessons',
  'pastoral_entities',
  'pastoral_schedules',
  'pastoral_public_events',
  'pastoral_announcements',
  'spiritual_series',
  'spiritual_series_days',
] as const;

type Policy = {
  item_kind: string;
  require_sources: boolean;
  require_doctrinal_review: boolean;
};

type Item = {
  table: string;
  id: string;
  title: string;
  status: string;
  masterStatus: string;
  requireSources: boolean;
  requireDoctrinal: boolean;
  sourceLinks: number;
  verifiedSourceLinks: number;
  doctrinalApproved: boolean;
  videoRequired: boolean;
  videoReady: boolean;
  raw: Record<string, unknown>;
};

type Filter = 'all' | 'review' | 'draft';

const routeByTable: Record<string, string> = {
  daily_readings: '/admin/liturgy',
  liturgical_days: '/admin/calendar',
  saints: '/admin/saints',
  prayers: '/admin/prayers',
  audio_assets: '/admin/audio',
  editorial_sources: '/admin/sources',
  formation_tracks: '/admin/formation',
  formation_lessons: '/admin/formation',
  pastoral_entities: '/admin/pastoral',
  pastoral_schedules: '/admin/pastoral',
  pastoral_public_events: '/admin/pastoral',
  pastoral_announcements: '/admin/pastoral',
  spiritual_series: '/admin/san-miguel',
  spiritual_series_days: '/admin/san-miguel',
};

const tableLabel: Record<string, string> = {
  daily_readings: 'Liturgia diaria',
  liturgical_days: 'Calendario litúrgico',
  saints: 'Santoral',
  prayers: 'Oraciones',
  audio_assets: 'Audio',
  editorial_sources: 'Fuentes',
  formation_tracks: 'Formación · Rutas',
  formation_lessons: 'Formación · Lecciones',
  pastoral_entities: 'Pastoral · Entidades',
  pastoral_schedules: 'Pastoral · Horarios',
  pastoral_public_events: 'Pastoral · Eventos',
  pastoral_announcements: 'Pastoral · Avisos',
  spiritual_series: 'San Miguel · Serie',
  spiritual_series_days: 'San Miguel · Jornadas',
};

const masterLabel: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  doctrinal_review: 'Revisión doctrinal',
  approved: 'Aprobado',
  scheduled: 'Programado',
  published: 'Publicado',
  archived: 'Archivado',
  rejected: 'Rechazado',
};

function keyOf(row: Record<string, unknown>) {
  return String(row.id ?? row.date ?? row.slug ?? '');
}

function titleOf(row: Record<string, unknown>) {
  return String(row.title ?? row.name ?? row.date ?? row.slug ?? keyOf(row));
}

function fallbackMaster(status: string) {
  if (status === 'review') return 'in_review';
  if (status === 'published') return 'published';
  if (status === 'archived') return 'archived';
  return 'draft';
}

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setMsg('');
    setError(false);
    const all: Item[] = [];
    const errors: string[] = [];

    const policyResult = await supabase
      .from('editorial_content_policy')
      .select('item_kind,require_sources,require_doctrinal_review');

    const policies = new Map<string, Policy>();
    if (policyResult.error) {
      errors.push('Políticas editoriales: ' + policyResult.error.message);
    } else {
      for (const row of (policyResult.data ?? []) as Policy[]) policies.set(row.item_kind, row);
    }

    for (const table of tables) {
      const result = await supabase
        .from(table)
        .select('*')
        .in('review_status', ['draft', 'review'])
        .limit(250);

      if (result.error) {
        errors.push(table + ': ' + result.error.message);
        continue;
      }

      const sourceRows = (result.data ?? []) as Record<string, unknown>[];
      const ids = sourceRows.map(keyOf).filter(Boolean);
      const stateById = new Map<string, string>();
      const sourceCounts = new Map<string, { total: number; verified: number }>();
      const doctrinalApproved = new Set<string>();

      if (ids.length) {
        const [stateResult, sourceResult, doctrinalResult] = await Promise.all([
          supabase
            .from('editorial_item_state')
            .select('item_id,status_id')
            .eq('item_kind', table)
            .in('item_id', ids),
          supabase
            .from('content_source')
            .select('item_id,verified')
            .eq('item_kind', table)
            .in('item_id', ids),
          supabase
            .from('doctrinal_review')
            .select('item_id,status')
            .eq('item_kind', table)
            .in('item_id', ids)
            .in('status', ['APPROVED', 'APPROVED_WITH_NOTES']),
        ]);

        if (!stateResult.error) {
          for (const row of (stateResult.data ?? []) as Array<{ item_id: string; status_id: string }>) {
            stateById.set(String(row.item_id), String(row.status_id));
          }
        }

        if (!sourceResult.error) {
          for (const row of (sourceResult.data ?? []) as Array<{ item_id: string; verified: boolean }>) {
            const id = String(row.item_id);
            const current = sourceCounts.get(id) ?? { total: 0, verified: 0 };
            current.total += 1;
            if (row.verified) current.verified += 1;
            sourceCounts.set(id, current);
          }
        }

        if (!doctrinalResult.error) {
          for (const row of (doctrinalResult.data ?? []) as Array<{ item_id: string; status: string }>) {
            doctrinalApproved.add(String(row.item_id));
          }
        }
      }

      const policy = policies.get(table);
      for (const row of sourceRows) {
        const id = keyOf(row);
        const status = String(row.review_status ?? 'draft');
        const sources = sourceCounts.get(id) ?? { total: 0, verified: 0 };
        all.push({
          table,
          id,
          title: titleOf(row),
          status,
          masterStatus: stateById.get(id) ?? fallbackMaster(status),
          requireSources: Boolean(policy?.require_sources),
          requireDoctrinal: Boolean(policy?.require_doctrinal_review),
          sourceLinks: sources.total,
          verifiedSourceLinks: sources.verified,
          doctrinalApproved: doctrinalApproved.has(id),
          videoRequired: table === 'spiritual_series_days',
          videoReady: table !== 'spiritual_series_days' || (Boolean(String(row.youtube_url ?? '').trim()) && Boolean(String(row.youtube_video_id ?? '').trim())),
          raw: row,
        });
      }
    }

    all.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'review' ? -1 : 1;
      return a.title.localeCompare(b.title, 'es');
    });

    setItems(all);
    if (errors.length) {
      setError(true);
      setMsg('Algunas comprobaciones no pudieron completarse: ' + errors.join(' · '));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    total: items.length,
    review: items.filter(item => item.status === 'review').length,
    draft: items.filter(item => item.status === 'draft').length,
    doctrinal: items.filter(item => item.masterStatus === 'doctrinal_review').length,
    approved: items.filter(item => ['approved', 'scheduled'].includes(item.masterStatus)).length,
  }), [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(item => item.status === filter);
  }, [items, filter]);

  function keyField(item: Item) {
    if ('id' in item.raw) return 'id';
    if ('date' in item.raw) return 'date';
    if ('slug' in item.raw) return 'slug';
    return 'id';
  }

  async function sendToReview(item: Item) {
    const opKey = item.table + ':' + item.id;
    setBusyKey(opKey);
    setMsg('');
    setError(false);

    const payload: Record<string, unknown> = { review_status: 'review' };
    if ('revision' in item.raw) payload.revision = Number(item.raw.revision ?? 0) + 1;
    if ('updated_at' in item.raw) payload.updated_at = new Date().toISOString();

    const result = await supabase
      .from(item.table)
      .update(payload)
      .eq(keyField(item), item.id);

    if (result.error) {
      setError(true);
      setMsg(result.error.message);
    } else {
      setMsg('Contenido enviado a revisión. Gobierno Editorial lo ha situado en “En revisión”.');
      await load();
    }
    setBusyKey('');
  }

  async function transition(item: Item, nextStatus: string) {
    const opKey = item.table + ':' + item.id;
    setBusyKey(opKey);
    setMsg('');
    setError(false);

    const result = await supabase.rpc('editorial_set_master_status', {
      p_item_kind: item.table,
      p_item_id: item.id,
      p_next_status: nextStatus,
      p_notes: 'Transición ejecutada desde Cola de Revisión',
    });

    if (result.error) {
      setError(true);
      setMsg(result.error.message);
    } else {
      setMsg('Estado maestro actualizado a “' + (masterLabel[nextStatus] ?? nextStatus) + '”.');
      await load();
    }
    setBusyKey('');
  }

  async function publish(item: Item) {
    const readiness = await supabase.rpc('editorial_publication_readiness', {
      p_item_kind: item.table,
      p_item_id: item.id,
    });

    if (readiness.error) {
      setError(true);
      setMsg(readiness.error.message);
      return;
    }

    const check = (readiness.data ?? {}) as Record<string, unknown>;
    if (check.ready !== true) {
      const blockers = Array.isArray(check.blockers) ? check.blockers.map(String) : ['El contenido todavía no cumple el Gobierno Editorial.'];
      setError(true);
      setMsg(blockers.join(' · '));
      return;
    }

    if (!window.confirm('¿Publicar este contenido aprobado en CAMINO?')) return;

    const opKey = item.table + ':' + item.id;
    setBusyKey(opKey);
    setMsg('');
    setError(false);

    const payload: Record<string, unknown> = {
      review_status: 'published',
      published_at: new Date().toISOString(),
    };
    if ('verified' in item.raw) payload.verified = true;
    if ('readings_verified' in item.raw) payload.readings_verified = true;
    if ('technical_verified' in item.raw) payload.technical_verified = true;
    if ('revision' in item.raw) payload.revision = Number(item.raw.revision ?? 0) + 1;
    if ('updated_at' in item.raw) payload.updated_at = new Date().toISOString();

    const result = await supabase
      .from(item.table)
      .update(payload)
      .eq(keyField(item), item.id);

    if (result.error) {
      setError(true);
      setMsg(result.error.message);
    } else {
      setMsg('Publicado correctamente. El estado maestro quedó sincronizado como Publicado.');
      await load();
    }
    setBusyKey('');
  }

  function actionFor(item: Item, busy: boolean) {
    if (item.status === 'draft') {
      return (
        <button className="btn-primary" disabled={busy} onClick={() => void sendToReview(item)}>
          {busy ? 'Enviando…' : 'Enviar a revisión'}
        </button>
      );
    }

    if (item.masterStatus === 'in_review') {
      if (item.requireDoctrinal) {
        return (
          <button className="btn-primary" disabled={busy} onClick={() => void transition(item, 'doctrinal_review')}>
            {busy ? 'Enviando…' : 'Enviar a revisión doctrinal'}
          </button>
        );
      }
      return (
        <button className="btn-primary" disabled={busy} onClick={() => void transition(item, 'approved')}>
          {busy ? 'Aprobando…' : 'Aprobar'}
        </button>
      );
    }

    if (item.masterStatus === 'doctrinal_review') {
      if (item.doctrinalApproved) {
        return (
          <button className="btn-primary" disabled={busy} onClick={() => void transition(item, 'approved')}>
            {busy ? 'Aprobando…' : 'Aprobar tras revisión doctrinal'}
          </button>
        );
      }
      return <Link className="btn-primary" href={'/admin/governance?kind=' + encodeURIComponent(item.table) + '&id=' + encodeURIComponent(item.id)}>Abrir Candado Católico</Link>;
    }

    if (item.masterStatus === 'approved' || item.masterStatus === 'scheduled') {
      return (
        <button className="btn-primary" disabled={busy} onClick={() => void publish(item)}>
          {busy ? 'Publicando…' : 'Publicar en CAMINO'}
        </button>
      );
    }

    return <Link className="btn-primary" href={'/admin/governance?kind=' + encodeURIComponent(item.table) + '&id=' + encodeURIComponent(item.id)}>Resolver en Gobierno Editorial</Link>;
  }

  return (
    <AdminFrame
      title="Cola de Revisión"
      subtitle="Revisión editorial · Candado Católico · aprobación · publicación"
      badge={counts.review + ' en revisión'}
    >
      <section className="review-command-hero">
        <div>
          <p className="eyebrow">REVISIÓN · GOBIERNO · PUBLICACIÓN</p>
          <h2>Guardar prepara. Revisar discierne. Aprobar autoriza. Publicar entrega a CAMINO.</h2>
          <p>
            La publicación ya no depende únicamente de un botón. Gobierno Editorial comprueba estado maestro,
            fuentes verificadas y revisión doctrinal cuando la política del contenido lo exige.
          </p>
        </div>
        <div className="review-flow">
          <span>Borrador</span><b>→</b><span>Revisión</span><b>→</b><span>Aprobación</span><b>→</b><span>Publicado</span>
        </div>
      </section>

      <section className="review-kpi-grid">
        <article><span>Pendientes</span><strong>{counts.total}</strong><small>Total visible</small></article>
        <article><span>En revisión</span><strong>{counts.review}</strong><small>Flujo editorial</small></article>
        <article><span>Revisión doctrinal</span><strong>{counts.doctrinal}</strong><small>Candado Católico</small></article>
        <article><span>Aprobados</span><strong>{counts.approved}</strong><small>Listos para publicar</small></article>
      </section>

      <div className="review-toolbar">
        <div className="review-filter-group">
          {([
            ['all', 'Todos', counts.total],
            ['review', 'En revisión', counts.review],
            ['draft', 'Borradores', counts.draft],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'review-filter active' : 'review-filter'}
              onClick={() => setFilter(value)}
            >
              {label} · {count}
            </button>
          ))}
        </div>
        <button className="btn" type="button" disabled={loading} onClick={() => void load()}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {msg ? <div className={'message ' + (error ? 'error' : '')}>{msg}</div> : null}

      <section className="review-professional-list">
        {loading ? <div className="empty">Consultando flujo editorial y Gobierno V2…</div> : null}
        {!loading && visible.length === 0 ? (
          <div className="review-empty-professional">
            <span>✓</span>
            <strong>No hay contenido en este estado</strong>
            <p>La cola está limpia para el filtro seleccionado.</p>
          </div>
        ) : null}

        {!loading && visible.map((item) => {
          const opKey = item.table + ':' + item.id;
          const busy = busyKey === opKey;
          const inReview = item.status === 'review';

          return (
            <article className={'review-professional-row ' + (inReview ? 'ready' : 'draft')} key={opKey}>
              <div className="review-row-icon">{inReview ? '✓' : '✎'}</div>
              <div className="review-row-main">
                <div className="review-row-heading">
                  <div>
                    <span className="review-area">{tableLabel[item.table] ?? item.table}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <span className={'review-state ' + (inReview ? 'ready' : 'draft')}>
                    {masterLabel[item.masterStatus] ?? item.masterStatus}
                  </span>
                </div>
                <p>{item.id}</p>
                <div className="review-governance-meta">
                  <span>Estado maestro: <strong>{masterLabel[item.masterStatus] ?? item.masterStatus}</strong></span>
                  {item.requireSources ? (
                    <span className={item.verifiedSourceLinks > 0 ? 'ok' : 'warn'}>
                      Fuentes verificadas: <strong>{item.verifiedSourceLinks}</strong>
                    </span>
                  ) : <span>Fuente obligatoria: no</span>}
                  {item.requireDoctrinal ? (
                    <span className={item.doctrinalApproved ? 'ok' : 'warn'}>
                      Revisión doctrinal: <strong>{item.doctrinalApproved ? 'aprobada' : 'pendiente'}</strong>
                    </span>
                  ) : <span>Revisión doctrinal: según criterio editorial</span>}
                  {item.videoRequired ? (
                    <span className={item.videoReady ? 'ok' : 'warn'}>
                      Video: <strong>{item.videoReady ? 'listo' : 'falta URL / ID'}</strong>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="review-row-actions">
                <Link className="btn" href={routeByTable[item.table] ?? '/admin/editions'}>Editar</Link>
                {actionFor(item, busy)}
              </div>
            </article>
          );
        })}
      </section>
    </AdminFrame>
  );
}
