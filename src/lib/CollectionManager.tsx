'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EditorField = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' | 'url' | 'json';
  readOnly?: boolean;
};

type Row = Record<string, any>;

export default function CollectionManager(props: {
  table: string;
  title: string;
  subtitle?: string;
  fields: EditorField[];
  titleKey?: string;
  secondaryKey?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  keyField?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const titleKey = props.titleKey ?? 'title';
  const secondaryKey = props.secondaryKey ?? 'slug';
  const keyField = props.keyField ?? 'id';

  async function load() {
    setLoading(true);
    setMessage('');
    let query = supabase.from(props.table).select('*').limit(props.limit ?? 500);
    if (props.orderBy) query = query.order(props.orderBy, { ascending: props.ascending ?? true });
    const result = await query;
    if (result.error) {
      setMessage(result.error.message);
      setRows([]);
    } else {
      setRows((result.data ?? []) as Row[]);
      const selectedKey = selected?.[keyField];
      if (selectedKey != null) {
        const fresh = (result.data ?? []).find((item: Row) => item[keyField] === selectedKey) as Row | undefined;
        if (fresh) choose(fresh);
      }
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [props.table]);

  function choose(row: Row) {
    setSelected(row);
    const next: Row = {};
    for (const field of props.fields) {
      const value = row[field.key];
      next[field.key] = field.type === 'json' && value != null
        ? JSON.stringify(value, null, 2)
        : value ?? (field.type === 'boolean' ? false : '');
    }
    setDraft(next);
    setMessage('');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('es');
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [row[titleKey], row[secondaryKey], row[keyField], row.date, row.category, row.review_status]
        .filter(Boolean).join(' ').toLocaleLowerCase('es');
      return haystack.includes(q);
    });
  }, [rows, search, titleKey, secondaryKey]);

  const published = rows.filter((r) => r.review_status === 'published' || r.published_at).length;
  const verified = rows.filter((r) => r.verified === true || r.calendar_verified === true).length;

  async function persist(payload: Row, successMessage: string) {
    const selectedKey = selected?.[keyField];
    if (selectedKey == null) return;
    setSaving(true);
    setMessage('');
    try {
      if ('revision' in (selected ?? {}) && payload.revision == null) {
        payload.revision = Number(selected?.revision ?? 0) + 1;
      }
      const result = await supabase.from(props.table).update(payload).eq(keyField, selectedKey).select('*').single();
      if (result.error) throw result.error;
      const saved = result.data as Row;
      setRows((current) => current.map((item) => item[keyField] === saved[keyField] ? saved : item));
      choose(saved);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!selected) return;
    const payload: Row = {};
    for (const field of props.fields) {
      if (field.readOnly) continue;
      let value = draft[field.key];
      if (field.type === 'number') value = value === '' || value == null ? null : Number(value);
      if (field.type === 'json') value = value === '' ? null : JSON.parse(value);
      payload[field.key] = value;
    }
    await persist(payload, 'Cambios guardados correctamente.');
  }

  function openReviewQueue() {
    window.location.href = '/admin/review';
  }

  async function verify() {
    if (!selected) return;
    if ('verified' in selected) {
      await persist({ verified: true }, 'Contenido marcado como verificado.');
    } else if ('calendar_verified' in selected) {
      await persist({ calendar_verified: true }, 'Calendario marcado como verificado.');
    }
  }

  return (
    <section className="manager-card">
      <div className="manager-head">
        <div>
          <p className="eyebrow dark">Tabla · {props.table}</p>
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>
        <button className="btn" type="button" onClick={() => void load()} disabled={loading}>Recargar</button>
      </div>

      <div className="meta-grid manager-meta">
        <div className="meta-card"><span>Total</span><strong>{rows.length}</strong></div>
        <div className="meta-card"><span>Publicados</span><strong>{published}</strong></div>
        <div className="meta-card"><span>Verificados</span><strong>{verified}</strong></div>
        <div className="meta-card"><span>Vista</span><strong>{filtered.length}</strong></div>
      </div>

      <div className="manager-toolbar">
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, slug, id, fecha o estado…" />
      </div>

      {message ? <div className="message message-info">{message}</div> : null}

      <div className="manager-grid">
        <div className="record-list">
          {loading ? <div className="empty-state">Cargando contenido editorial…</div> : null}
          {!loading && filtered.length === 0 ? <div className="empty-state">No hay registros para mostrar.</div> : null}
          {filtered.map((row) => (
            <button type="button" className={'record-row' + (selected?.[keyField] === row[keyField] ? ' selected' : '')} key={String(row[keyField])} onClick={() => choose(row)}>
              <strong>{String(row[titleKey] ?? row.name ?? row[keyField])}</strong>
              <span>{String(row[secondaryKey] ?? row.date ?? row.category ?? '')}</span>
              <small>{row.review_status ?? (row.published_at ? 'publicado' : '')}</small>
            </button>
          ))}
        </div>

        <div className="editor-panel">
          {!selected ? (
            <div className="empty-state">
              <strong>Selecciona un registro</strong>
              Podrás revisar y editar sus campos editoriales.
            </div>
          ) : (
            <>
              <div className="editor-panel-head">
                <div>
                  <p className="eyebrow dark">Edición segura</p>
                  <h3>{String(selected[titleKey] ?? selected.name ?? selected[keyField])}</h3>
                  <small>{keyField}: {String(selected[keyField])}</small>
                </div>
              </div>
              <div className="editor-fields">
                {props.fields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    {field.type === 'textarea' || field.type === 'json' ? (
                      <textarea className="textarea textarea-short" readOnly={field.readOnly} value={String(draft[field.key] ?? '')} onChange={(e) => setDraft((x) => ({ ...x, [field.key]: e.target.value }))} />
                    ) : field.type === 'boolean' ? (
                      <input type="checkbox" checked={Boolean(draft[field.key])} disabled={field.readOnly} onChange={(e) => setDraft((x) => ({ ...x, [field.key]: e.target.checked }))} />
                    ) : (
                      <input className="input" type={field.type === 'datetime' ? 'datetime-local' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} readOnly={field.readOnly} value={String(draft[field.key] ?? '')} onChange={(e) => setDraft((x) => ({ ...x, [field.key]: e.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
              <div className="editor-actions">
                <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                {'review_status' in selected && selected.review_status !== 'published' ? (
                  <button className="btn" type="button" onClick={openReviewQueue} disabled={saving}>Revisar / publicar</button>
                ) : null}
                {(('verified' in selected && !selected.verified) || ('calendar_verified' in selected && !selected.calendar_verified)) ? (
                  <button className="btn" type="button" onClick={() => void verify()} disabled={saving}>Marcar verificado</button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
