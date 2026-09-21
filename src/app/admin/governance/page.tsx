'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminFrame from '@/lib/AdminFrame';
import { supabase } from '@/lib/supabase';

type Row = Record<string, any>;
type Probe = { table: string; label: string; ok: boolean; count: number | null; error: string | null };

const layers = [
  ['editorial_status','Estados maestros'],
  ['editorial_item_state','Estado por contenido'],
  ['source_reference','Referencias exactas'],
  ['content_source','Contenido ↔ fuente'],
  ['editorial_content_policy','Política por contenido'],
  ['doctrinal_level','Niveles doctrinales'],
  ['doctrinal_review','Revisión doctrinal'],
  ['content_revision','Historial de versiones'],
  ['audit_log','Auditoría'],
  ['role','Catálogo de roles'],
  ['permission','Permisos'],
  ['role_permission','Rol ↔ permiso'],
] as const;

const statusLabel: Record<string,string> = {
  draft:'Borrador',
  in_review:'En revisión',
  doctrinal_review:'Revisión doctrinal',
  approved:'Aprobado',
  scheduled:'Programado',
  published:'Publicado',
  archived:'Archivado',
  rejected:'Rechazado',
};

const reviewLabel: Record<string,string> = {
  PENDING:'Pendiente',
  APPROVED:'Aprobada',
  APPROVED_WITH_NOTES:'Aprobada con notas',
  REJECTED:'Rechazada',
  REQUIRES_REVISION:'Requiere revisión',
};

async function probe(table:string,label:string): Promise<Probe> {
  const result = await supabase.from(table).select('*', { count:'exact', head:true });
  return { table,label,ok:!result.error,count:result.count ?? null,error:result.error?.message ?? null };
}

async function rows(table:string, order:string, limit=12) {
  let query = supabase.from(table).select('*');
  query = query.order(order,{ascending:false}).limit(limit);
  const result = await query;
  return { data:(result.data ?? []) as Row[], error:result.error?.message ?? null };
}

export default function Page() {
  const [probes,setProbes] = useState<Probe[]>([]);
  const [statuses,setStatuses] = useState<Row[]>([]);
  const [levels,setLevels] = useState<Row[]>([]);
  const [states,setStates] = useState<Row[]>([]);
  const [reviews,setReviews] = useState<Row[]>([]);
  const [revisions,setRevisions] = useState<Row[]>([]);
  const [audits,setAudits] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [message,setMessage] = useState('');
  const [selected,setSelected] = useState<Row|null>(null);
  const [nextStatus,setNextStatus] = useState('');
  const [notes,setNotes] = useState('');
  const [doctrinalLevel,setDoctrinalLevel] = useState('');
  const [doctrinalStatus,setDoctrinalStatus] = useState('PENDING');
  const [doctrinalComments,setDoctrinalComments] = useState('');
  const [saving,setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    const nextProbes = await Promise.all(layers.map(([table,label]) => probe(table,label)));
    setProbes(nextProbes);

    const available = new Set(nextProbes.filter(x=>x.ok).map(x=>x.table));
    const [s,l,st,dr,cr,al,legacyAl] = await Promise.all([
      available.has('editorial_status') ? supabase.from('editorial_status').select('*').order('sort_order',{ascending:true}) : Promise.resolve({data:[],error:null}),
      available.has('doctrinal_level') ? supabase.from('doctrinal_level').select('*').order('priority',{ascending:false}) : Promise.resolve({data:[],error:null}),
      available.has('editorial_item_state') ? rows('editorial_item_state','assigned_at',24) : Promise.resolve({data:[],error:null}),
      available.has('doctrinal_review') ? rows('doctrinal_review','created_at',12) : Promise.resolve({data:[],error:null}),
      available.has('content_revision') ? rows('content_revision','created_at',12) : Promise.resolve({data:[],error:null}),
      available.has('audit_log') ? rows('audit_log','created_at',16) : Promise.resolve({data:[],error:null}),
      rows('editorial_audit_log','created_at',16),
    ]);

    setStatuses((s.data ?? []) as Row[]);
    setLevels((l.data ?? []) as Row[]);

    let stateRows = (st.data ?? []) as Row[];
    let requestedState: Row | null = null;
    if (available.has('editorial_item_state') && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedKind = params.get('kind');
      const requestedId = params.get('id');
      if (requestedKind && requestedId) {
        const exact = await supabase
          .from('editorial_item_state')
          .select('*')
          .eq('item_kind', requestedKind)
          .eq('item_id', requestedId)
          .maybeSingle();
        if (!exact.error && exact.data) {
          requestedState = exact.data as Row;
          if (!stateRows.some(row => row.item_kind === requestedKind && row.item_id === requestedId)) {
            stateRows = [requestedState, ...stateRows];
          }
        }
      }
    }
    setStates(stateRows);
    setReviews((dr.data ?? []) as Row[]);
    setRevisions((cr.data ?? []) as Row[]);
    const currentAudits: Row[] = ((al.data ?? []) as Row[]).map(row => ({ ...row, audit_origin:'V2' }));
    const legacyAudits: Row[] = ((legacyAl.data ?? []) as Row[]).map(row => ({
      id:'legacy-'+String(row.id),
      user_id:row.actor_user_id ?? null,
      action:row.action,
      entity_type:row.table_name,
      entity_id:row.row_id,
      metadata:{ actor_role:row.actor_role, old_data:row.old_data, new_data:row.new_data },
      created_at:row.created_at,
      audit_origin:'Histórica',
    }));
    const combinedAudits: Row[] = [...currentAudits,...legacyAudits];
    setAudits(combinedAudits
      .sort((a,b)=>String(b.created_at??'').localeCompare(String(a.created_at??'')))
      .slice(0,16));
    if (requestedState) setSelected(requestedState);
    else if (!selected && stateRows[0]) setSelected(stateRows[0]);
    setLoading(false);
  }

  useEffect(()=>{ void load(); },[]);

  const summary = useMemo(()=>{
    const available=probes.filter(x=>x.ok).length;
    return { available, pending:Math.max(0,layers.length-available), pct:probes.length ? Math.round(available/layers.length*100) : 0 };
  },[probes]);

  const infrastructureReady = probes.length>0 && probes.every(x=>x.ok);
  const materializedTotal = probes.find(row => row.table === 'editorial_item_state')?.count ?? states.length;

  async function changeStatus() {
    if (!selected || !nextStatus) return;
    setSaving(true); setMessage('');
    const result = await supabase.rpc('editorial_set_master_status',{
      p_item_kind:String(selected.item_kind),
      p_item_id:String(selected.item_id),
      p_next_status:nextStatus,
      p_notes:notes || null,
    });
    if (result.error) setMessage('No fue posible cambiar el estado: '+result.error.message);
    else {
      setMessage('Estado maestro actualizado correctamente.');
      setNextStatus(''); setNotes('');
      await load();
    }
    setSaving(false);
  }

  async function addDoctrinalReview() {
    if (!selected) return;
    setSaving(true); setMessage('');
    const payload = {
      item_kind:String(selected.item_kind),
      item_id:String(selected.item_id),
      doctrinal_level_id:doctrinalLevel || null,
      status:doctrinalStatus,
      comments:doctrinalComments || null,
      reviewed_at:doctrinalStatus==='PENDING' ? null : new Date().toISOString(),
      updated_at:new Date().toISOString(),
    };
    const result = await supabase.from('doctrinal_review').insert(payload);
    if (result.error) setMessage('No fue posible registrar la revisión doctrinal: '+result.error.message);
    else {
      setMessage('Revisión doctrinal registrada.');
      setDoctrinalComments('');
      await load();
    }
    setSaving(false);
  }

  return (
    <AdminFrame
      title="Gobierno Editorial"
      subtitle="Estados maestros · Candado Católico · trazabilidad · auditoría"
      badge={loading ? 'Comprobando…' : infrastructureReady ? 'V2 disponible' : 'Migración pendiente'}
    >
      <section className="governance-hero">
        <div>
          <p className="eyebrow">MODELO MAESTRO · GOBIERNO EDITORIAL V2</p>
          <h2>Verdad, revisión y trazabilidad antes de publicar.</h2>
          <p>
            Esta capa no sustituye el flujo editorial que ya alimenta CAMINO. Lo amplía con estados maestros,
            revisión doctrinal, referencias exactas, historial de versiones y auditoría.
          </p>
        </div>
        <div className="governance-score">
          <span>Infraestructura maestra</span>
          <strong>{loading ? '…' : summary.pct+'%'}</strong>
          <small>{loading ? 'Consultando Supabase…' : summary.available+' de '+layers.length+' capas disponibles'}</small>
        </div>
      </section>

      <section className="governance-kpis">
        <article><span>Capas V2</span><strong>{layers.length}</strong><small>Modelo fundacional</small></article>
        <article><span>Disponibles</span><strong>{loading?'…':summary.available}</strong><small>Detectadas en Supabase</small></article>
        <article className={summary.pending ? 'governance-warning' : ''}><span>Pendientes</span><strong>{loading?'…':summary.pending}</strong><small>{summary.pending?'Requieren migración':'Infraestructura completa'}</small></article>
        <article><span>Estados materializados</span><strong>{loading?'…':materializedTotal.toLocaleString('es-CO')}</strong><small>Total real en Supabase</small></article>
      </section>

      {!loading && !infrastructureReady ? (
        <section className="governance-migration">
          <div>
            <p className="eyebrow dark">MIGRACIÓN PREPARADA</p>
            <h3>La interfaz está lista; falta autorización de Supabase para crear la infraestructura.</h3>
            <p>
              Gobierno Editorial se instala mediante migraciones versionadas en <code>supabase/migrations/</code>.
              Si una capa falta, aplica únicamente las migraciones pendientes desde una sesión Supabase autorizada.
            </p>
          </div>
          <Link className="btn" href="/admin/control">Ver conformidad</Link>
        </section>
      ) : null}

      <section className="quality-table-card governance-layer-card">
        <div className="quality-table-head">
          <div>
            <h3>Capas del Gobierno Editorial</h3>
            <p>Estado real leído desde Supabase.</p>
          </div>
          <button className="btn-primary" disabled={loading} onClick={()=>void load()}>{loading?'Comprobando…':'Recomprobar'}</button>
        </div>
        <div className="quality-table">
          {probes.map(row=>(
            <div className="quality-table-row" key={row.table}>
              <div className="quality-table-name">
                <span className={'quality-status-dot '+(row.ok?'ok':'bad')} />
                <div><strong>{row.label}</strong><small>{row.table}</small></div>
              </div>
              <div className="quality-table-count"><span>Registros</span><strong>{row.ok ? (row.count ?? 0).toLocaleString('es-CO') : '—'}</strong></div>
              <div className={'quality-table-state '+(row.ok?'ok':'bad')}>{row.ok?'Disponible':'Pendiente'}</div>
            </div>
          ))}
        </div>
      </section>

      {infrastructureReady ? (
        <>
          <section className="governance-workbench">
            <div className="governance-panel governance-items">
              <div className="governance-panel-head">
                <div><p className="eyebrow dark">ESTADOS MAESTROS</p><h3>Contenido materializado</h3></div>
                <span>{states.length}</span>
              </div>
              <div className="governance-item-list">
                {states.length ? states.map(row=>(
                  <button key={String(row.item_kind)+'|'+String(row.item_id)} className={'governance-item '+(selected?.item_kind===row.item_kind && selected?.item_id===row.item_id?'active':'')} onClick={()=>setSelected(row)}>
                    <span><strong>{String(row.item_kind)}</strong><small>{String(row.item_id)}</small></span>
                    <em>{statusLabel[String(row.status_id)] ?? String(row.status_id)}</em>
                  </button>
                )) : <div className="empty">Todavía no hay estados materializados.</div>}
              </div>
            </div>

            <div className="governance-panel">
              <div className="governance-panel-head"><div><p className="eyebrow dark">TRANSICIÓN</p><h3>Estado maestro</h3></div></div>
              {selected ? (
                <div className="governance-form">
                  <div className="governance-selected"><strong>{String(selected.item_kind)}</strong><span>{String(selected.item_id)}</span><small>Actual · {statusLabel[String(selected.status_id)] ?? String(selected.status_id)}</small>{selected.notes ? <em className="governance-selected-note">{String(selected.notes)}</em> : null}</div>
                  <label><span>Siguiente estado</span><select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}><option value="">Seleccionar…</option>{statuses.filter(s=>String(s.id)!==String(selected.status_id)).map(s=><option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}</select></label>
                  <label><span>Nota de transición</span><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Motivo o nota editorial…" /></label>
                  <button className="btn-primary" disabled={saving||!nextStatus} onClick={()=>void changeStatus()}>{saving?'Aplicando…':'Aplicar transición'}</button>
                </div>
              ) : <div className="empty">Selecciona una pieza editorial.</div>}
            </div>

            <div className="governance-panel">
              <div className="governance-panel-head"><div><p className="eyebrow dark">CANDADO CATÓLICO</p><h3>Revisión doctrinal</h3></div></div>
              {selected ? (
                <div className="governance-form">
                  <label><span>Nivel doctrinal</span><select value={doctrinalLevel} onChange={e=>setDoctrinalLevel(e.target.value)}><option value="">Sin clasificar todavía</option>{levels.map(l=><option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>)}</select></label>
                  <label><span>Resultado</span><select value={doctrinalStatus} onChange={e=>setDoctrinalStatus(e.target.value)}>{Object.entries(reviewLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Comentarios</span><textarea rows={5} value={doctrinalComments} onChange={e=>setDoctrinalComments(e.target.value)} placeholder="Fundamento, observaciones o correcciones requeridas…" /></label>
                  <button className="btn-primary" disabled={saving} onClick={()=>void addDoctrinalReview()}>{saving?'Guardando…':'Registrar revisión doctrinal'}</button>
                </div>
              ) : <div className="empty">Selecciona una pieza editorial.</div>}
            </div>
          </section>

          {message ? <div className="governance-message">{message}</div> : null}

          <section className="governance-history-grid">
            <article className="governance-panel">
              <div className="governance-panel-head"><div><p className="eyebrow dark">REVISIÓN</p><h3>Revisiones doctrinales recientes</h3></div><span>{reviews.length}</span></div>
              <div className="governance-history-list">{reviews.length?reviews.map(r=><div key={String(r.id)}><strong>{String(r.item_kind)} · {String(r.item_id)}</strong><span>{reviewLabel[String(r.status)]??String(r.status)}</span><small>{r.comments?String(r.comments):'Sin comentarios'}</small></div>):<div className="empty">Sin revisiones doctrinales.</div>}</div>
            </article>
            <article className="governance-panel">
              <div className="governance-panel-head"><div><p className="eyebrow dark">VERSIONES</p><h3>Cambios recientes</h3></div><span>{revisions.length}</span></div>
              <div className="governance-history-list">{revisions.length?revisions.map(r=><div key={String(r.id)}><strong>{String(r.item_kind)} · {String(r.item_id)}</strong><span>Rev. {String(r.revision_number)}</span><small>{String(r.change_summary??'Actualización')}</small></div>):<div className="empty">Sin revisiones registradas.</div>}</div>
            </article>
            <article className="governance-panel">
              <div className="governance-panel-head"><div><p className="eyebrow dark">AUDITORÍA</p><h3>Actividad reciente</h3></div><span>{audits.length}</span></div>
              <div className="governance-history-list">{audits.length?audits.map(r=><div key={String(r.id)}><strong>{String(r.entity_type)} · {String(r.entity_id??'—')}</strong><span>{String(r.action)} · {String(r.audit_origin??'V2')}</span><small>{r.created_at?new Date(String(r.created_at)).toLocaleString('es-CO'):'—'}</small></div>):<div className="empty">Sin actividad registrada.</div>}</div>
            </article>
          </section>
        </>
      ) : null}

      <aside className="editorial-principle">
        <div>
          <span className="principle-mark">✠</span>
          <div>
            <strong>La publicación no sustituye el discernimiento</strong>
            <p>La infraestructura ayuda a registrar procedencia, revisión y responsabilidad. La verdad doctrinal sigue requiriendo fuentes y revisión humana autorizada.</p>
          </div>
        </div>
        <Link href="/admin/sources">Revisar fuentes →</Link>
      </aside>
    </AdminFrame>
  );
}
