'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GovernanceSourceLinks from './GovernanceSourceLinks';
import styles from './EditorialStudio.module.css';

type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'url' | 'json' | 'date' | 'datetime';
export type BridgeField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  readOnly?: boolean;
  help?: string;
  preview?: 'youtube';
  relation?: {
    table: string;
    valueKey?: string;
    labelKey: string;
    secondaryKey?: string;
    locale?: string | null;
    orderBy?: string;
    filters?: Record<string, string | number | boolean>;
    multiple?: boolean;
    allowUnresolved?: boolean;
  };
  options?: Array<{ value: string | number; label: string; detail?: string }>;
};

export type BridgeCreateConfig = {
  keyStrategy: 'slug' | 'prefixed-slug' | 'uuid' | 'prefixed-uuid' | 'series-day';
  keyPrefix?: string;
  slugSource?: string;
  slugField?: string | null;
  defaults?: Record<string, unknown>;
  buttonLabel?: string;
  helper?: string;
};

type Row = Record<string, any>;
type StatusFilter = 'all' | 'draft' | 'review' | 'published' | 'archived';

const statusLabel: Record<StatusFilter, string> = {
  all: 'Todos',
  draft: 'Borrador',
  review: 'Revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

function statusClass(status: string | null | undefined) {
  if (status === 'published') return styles.statusPublished;
  if (status === 'review') return styles.statusReview;
  if (status === 'archived') return styles.statusArchived;
  return styles.statusDraft;
}

function reviewStatusLabel(status: string | null | undefined) {
  if (status === 'published') return 'Publicado';
  if (status === 'review') return 'En revisión';
  if (status === 'archived') return 'Archivado';
  return 'Borrador';
}

function masterStatusLabel(status: string | null | undefined) {
  if (status === 'in_review') return 'En revisión';
  if (status === 'doctrinal_review') return 'Revisión doctrinal';
  if (status === 'approved') return 'Aprobado';
  if (status === 'scheduled') return 'Programado';
  if (status === 'published') return 'Publicado';
  if (status === 'archived') return 'Archivado';
  if (status === 'rejected') return 'Rechazado';
  return 'Borrador';
}

function effectiveStatus(row: Row) {
  if (row.review_status) return String(row.review_status);
  if (row.is_active === true || row.published_at) return 'published';
  return 'draft';
}

function normalizeDateTime(value: unknown) {
  if (!value || typeof value !== 'string') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function slugify(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function extractYouTubeVideoId(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);
  return match?.[1] ?? null;
}

export default function BridgeCollectionEditor(props: {
  table: string;
  title: string;
  subtitle: string;
  appContract: string;
  fields: BridgeField[];
  titleKey?: string;
  secondaryKey?: string;
  keyField?: string;
  orderBy?: string;
  ascending?: boolean;
  locale?: string | null;
  create?: BridgeCreateConfig;
}) {
  const {
    table,
    title,
    subtitle,
    appContract,
    fields,
    titleKey = 'title',
    secondaryKey = 'slug',
    keyField = 'id',
    orderBy = 'updated_at',
    ascending = false,
    locale = 'es-CO',
    create,
  } = props;

  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [relationOptions, setRelationOptions] = useState<Record<string, Row[]>>({});
  const [relationErrors, setRelationErrors] = useState<Record<string, string>>({});
  const [masterStatus, setMasterStatus] = useState('');
  const [masterNotes, setMasterNotes] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error'>('info');
  const [publicationConfirmation, setPublicationConfirmation] = useState('');

  const toDraft = (row: Row) => Object.fromEntries(fields.map(field => {
    const value = row?.[field.key];
    if (field.type === 'json') return [field.key, value == null ? '' : JSON.stringify(value, null, 2)];
    if (field.type === 'boolean') return [field.key, Boolean(value)];
    if (field.type === 'datetime') return [field.key, normalizeDateTime(value)];
    return [field.key, value ?? ''];
  }));

  const choose = (row: Row) => {
    setCreating(false);
    setSelected(row);
    setDraft(toDraft(row));
    setPublicationConfirmation('');
    setMessage('');
  };

  function startCreate() {
    if (!create) return;
    const next: Row = {};
    for (const field of fields) {
      const seeded = create.defaults?.[field.key];
      if (field.type === 'boolean') next[field.key] = Boolean(seeded ?? false);
      else if (field.type === 'json') next[field.key] = seeded == null ? '' : JSON.stringify(seeded, null, 2);
      else next[field.key] = seeded ?? '';
    }
    setSelected(null);
    setCreating(true);
    setDraft(next);
    setPublicationConfirmation('');
    setMessageKind('info');
    setMessage(create.helper || 'Completa los campos obligatorios. El registro se creará como borrador en Supabase.');
  }

  const relationSignature = JSON.stringify(fields.filter(field => field.relation).map(field => ({ key: field.key, ...field.relation })));

  async function loadRelations() {
    const relationFields = fields.filter(field => field.relation);
    if (!relationFields.length) {
      setRelationOptions({});
      setRelationErrors({});
      return;
    }

    const options: Record<string, Row[]> = {};
    const errors: Record<string, string> = {};
    await Promise.all(relationFields.map(async field => {
      const relation = field.relation!;
      let query = supabase.from(relation.table).select('*');
      if (relation.locale !== null) query = query.eq('locale', relation.locale ?? 'es-CO');
      for (const [key, value] of Object.entries(relation.filters ?? {})) query = query.eq(key, value);
      if (relation.orderBy) query = query.order(relation.orderBy, { ascending: true });
      const result = await query.limit(1000);
      if (result.error) errors[field.key] = result.error.message;
      else options[field.key] = (result.data ?? []) as Row[];
    }));
    setRelationOptions(options);
    setRelationErrors(errors);
  }

  async function load() {
    setLoading(true);
    setMessage('');
    let q = supabase.from(table).select('*');
    if (locale) q = q.eq('locale', locale);
    if (orderBy) q = q.order(orderBy, { ascending });
    const result = await q.limit(1000);

    if (result.error) {
      setRows([]);
      setSelected(null);
      setMessageKind('error');
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    const data = (result.data ?? []) as Row[];
    setRows(data);
    if (selected) {
      const fresh = data.find(x => x[keyField] === selected[keyField]);
      if (fresh) choose(fresh);
    } else if (data[0]) {
      choose(data[0]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [table]);
  useEffect(() => { void loadRelations(); }, [relationSignature]);
  useEffect(() => {
    if (!selected || creating) {
      setMasterStatus('');
      setMasterNotes('');
      return;
    }
    void (async () => {
      const result = await supabase
        .from('editorial_item_state')
        .select('status_id,notes')
        .eq('item_kind', table)
        .eq('item_id', String(selected[keyField] ?? ''))
        .maybeSingle();
      setMasterStatus(result.error ? '' : String(result.data?.status_id ?? ''));
      setMasterNotes(result.error ? '' : String(result.data?.notes ?? ''));
    })();
  }, [table, keyField, selected?.[keyField], selected?.review_status, creating]);

  const counts = useMemo(() => ({
    total: rows.length,
    published: rows.filter(x => effectiveStatus(x) === 'published').length,
    review: rows.filter(x => effectiveStatus(x) === 'review').length,
    draft: rows.filter(x => effectiveStatus(x) === 'draft').length,
    archived: rows.filter(x => effectiveStatus(x) === 'archived').length,
    verified: rows.filter(x => x.verified === true || x.calendar_verified === true || x.readings_verified === true).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return rows.filter(row => {
      if (status !== 'all' && effectiveStatus(row) !== status) return false;
      if (!query) return true;
      return [
        row[titleKey], row[secondaryKey], row[keyField], row.review_status,
        row.category, row.name, row.date,
      ].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(query);
    });
  }, [rows, search, status, titleKey, secondaryKey, keyField]);

  const missing = fields.filter(field => {
    if (!field.required || field.readOnly) return false;
    const value = draft[field.key];
    if (field.type === 'boolean') return value !== true;
    return value == null || String(value).trim() === '';
  });

  const relationIssues = fields.filter(field => {
    if (!field.relation || field.relation.allowUnresolved || relationErrors[field.key]) return false;
    const options = relationOptions[field.key];
    if (!options) return false;
    const valueKey = field.relation.valueKey ?? 'id';
    const known = new Set(options.map(option => String(option[valueKey] ?? '')));
    if (field.relation.multiple) {
      try {
        const raw = draft[field.key];
        const values = Array.isArray(raw) ? raw : raw ? JSON.parse(String(raw)) : [];
        return Array.isArray(values) && values.some(value => !known.has(String(value)));
      } catch {
        return true;
      }
    }
    const value = String(draft[field.key] ?? '').trim();
    return Boolean(value) && !known.has(value);
  });

  const requiredFields = fields.filter(field => field.required && !field.readOnly);
  const hasLegacySourceField = fields.some(field => field.key === 'source_ids' || field.key === 'source_id');
  const completedRequired = Math.max(0, requiredFields.length - missing.length);
  const completionPercent = requiredFields.length
    ? Math.round((completedRequired / requiredFields.length) * 100)
    : 100;

  const dirty = useMemo(() => {
    if (creating) return true;
    if (!selected) return false;
    return JSON.stringify(toDraft(selected)) !== JSON.stringify(draft);
  }, [selected, draft, fields, creating]);

  const homilyPublicationSignature = table === 'weekly_homilies'
    ? [draft.youtube_input, draft.liturgical_date, draft.speaker_name].map(value => String(value ?? '').trim()).join('|')
    : '';
  const homilyVideoId = table === 'weekly_homilies' ? extractYouTubeVideoId(draft.youtube_input) : null;
  const homilyPublicationIdentityChanged = table === 'weekly_homilies' && (
    creating ||
    !selected ||
    selected.is_active !== true ||
    ['youtube_input', 'liturgical_date', 'speaker_name'].some(key => String(selected?.[key] ?? '').trim() !== String(draft[key] ?? '').trim())
  );
  const homilyPublicationNeedsConfirmation = table === 'weekly_homilies' && Boolean(draft.is_active) && homilyPublicationIdentityChanged;
  const homilyPublicationConfirmed = Boolean(homilyVideoId) && publicationConfirmation === homilyPublicationSignature;

  const selectedIndex = selected ? filtered.findIndex(x => x[keyField] === selected[keyField]) : -1;
  const previous = selectedIndex > 0 ? filtered[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? filtered[selectedIndex + 1] : null;

  async function save() {
    if (!dirty || (!selected && !creating)) return;
    if (missing.length) {
      setMessageKind('error');
      setMessage('Faltan campos obligatorios: ' + missing.map(x => x.label).join(', '));
      return;
    }
    if (creating && relationIssues.length) {
      setMessageKind('error');
      setMessage('Corrige las relaciones antes de crear el borrador: ' + relationIssues.map(x => x.label).join(', '));
      return;
    }
    if (homilyPublicationNeedsConfirmation && !homilyPublicationConfirmed) {
      setMessageKind('error');
      setMessage(homilyVideoId
        ? 'Antes de activar esta homilía en CAMINO, reproduce la vista previa y confirma explícitamente que el video, la fecha litúrgica y el predicador corresponden.'
        : 'Antes de activar esta homilía en CAMINO, ingresa un enlace válido de YouTube y verifica su vista previa.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload: Row = creating ? { ...(create?.defaults ?? {}) } : {};
      for (const field of fields) {
        if (field.readOnly) continue;
        let value = draft[field.key];
        if (field.type === 'number') value = value === '' ? null : Number(value);
        else if (field.type === 'boolean') value = Boolean(value);
        else if (field.type === 'json') value = value === '' ? null : JSON.parse(String(value));
        else if (field.type === 'datetime') value = value ? new Date(String(value)).toISOString() : null;
        else if (typeof value === 'string') {
          value = value.trim();
          if (value === '') value = null;
        }
        payload[field.key] = value;
      }

      if (creating) {
        if (!create) throw new Error('Este catálogo no tiene creación configurada.');
        if (locale && payload.locale == null) payload.locale = locale;

        const sourceKey = create.slugSource ?? titleKey;
        const generatedSlug = slugify(payload[sourceKey] ?? draft[sourceKey]);
        let generatedKey = '';

        if (create.keyStrategy === 'uuid') generatedKey = crypto.randomUUID();
        else if (create.keyStrategy === 'prefixed-uuid') generatedKey = (create.keyPrefix ?? '') + crypto.randomUUID();
        else if (create.keyStrategy === 'slug') generatedKey = generatedSlug;
        else if (create.keyStrategy === 'prefixed-slug') generatedKey = (create.keyPrefix ?? '') + generatedSlug;
        else if (create.keyStrategy === 'series-day') {
          const series = slugify(payload.series_id);
          const day = Number(payload.day_number);
          if (!series || !Number.isFinite(day) || day < 1) throw new Error('Serie y número de día son obligatorios para generar el identificador.');
          generatedKey = series + '-' + String(Math.trunc(day)).padStart(3, '0');
        }

        if (!generatedKey) throw new Error('No fue posible generar un identificador válido. Completa el título o nombre.');
        payload[keyField] = generatedKey;

        const slugField = create.slugField === undefined ? 'slug' : create.slugField;
        if (slugField && payload[slugField] == null) payload[slugField] = generatedSlug;
        if ('updated_at' in (create.defaults ?? {})) payload.updated_at = new Date().toISOString();

        const result = await supabase.from(table).insert(payload).select('*').single();
        if (result.error) throw result.error;

        const saved = result.data as Row;
        setRows(current => [saved, ...current]);
        choose(saved);
        setMessageKind('info');
        setMessage('Nuevo contenido creado como borrador en Supabase. Revísalo antes de enviarlo a publicación.');
        return;
      }

      if (!selected) return;
      if ('revision' in selected) payload.revision = Number(selected.revision ?? 0) + 1;
      if ('updated_at' in selected) payload.updated_at = new Date().toISOString();

      const result = await supabase
        .from(table)
        .update(payload)
        .eq(keyField, selected[keyField])
        .select('*')
        .single();
      if (result.error) throw result.error;

      const saved = result.data as Row;
      setRows(current => current.map(x => x[keyField] === saved[keyField] ? saved : x));
      choose(saved);
      setMessageKind('info');
      setMessage('Guardado en Supabase. La publicación continúa desde la Cola de Revisión.');
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function requestReview() {
    if (!selected || !('review_status' in selected)) return;
    if (dirty) {
      setMessageKind('error');
      setMessage('Guarda los cambios antes de enviar este contenido a revisión.');
      return;
    }
    if (missing.length) {
      setMessageKind('error');
      setMessage('Completa los campos obligatorios antes de enviar a revisión: ' + missing.map(x => x.label).join(', '));
      return;
    }
    if (relationIssues.length) {
      setMessageKind('error');
      setMessage('Hay relaciones que ya no existen en el catálogo: ' + relationIssues.map(x => x.label).join(', '));
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload: Row = { review_status: 'review' };
      if ('revision' in selected) payload.revision = Number(selected.revision ?? 0) + 1;
      if ('updated_at' in selected) payload.updated_at = new Date().toISOString();
      const result = await supabase
        .from(table)
        .update(payload)
        .eq(keyField, selected[keyField])
        .select('*')
        .single();
      if (result.error) throw result.error;

      const saved = result.data as Row;
      setRows(current => current.map(x => x[keyField] === saved[keyField] ? saved : x));
      choose(saved);
      setMessageKind('info');
      setMessage('Contenido enviado a revisión. Ya aparece en la Cola de Revisión.');
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'No fue posible enviar a revisión.');
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: BridgeField) {
    if (field.options?.length) {
      const currentValue = String(draft[field.key] ?? '');
      const known = !currentValue || field.options.some(option => String(option.value) === currentValue);
      const selectedOption = field.options.find(option => String(option.value) === currentValue);
      return (
        <label className={styles.field} key={field.key}>
          <span className={styles.labelRow}>
            <span className={styles.label}>{field.label}{field.required ? <span className={styles.required}> *</span> : null}</span>
            <span className={styles.relationTag}>guiado</span>
          </span>
          {field.help ? <small className={styles.help}>{field.help}</small> : null}
          <select
            className={styles.input}
            value={currentValue}
            disabled={field.readOnly}
            onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {!known ? <option value={currentValue}>Valor actual · {currentValue}</option> : null}
            {field.options.map(option => (
              <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
          {selectedOption?.detail ? <small className={styles.optionDetail}>{selectedOption.detail}</small> : null}
          {!known ? <small className={styles.relationWarning}>Este valor existe en datos actuales pero no forma parte del catálogo guiado. Puedes conservarlo o normalizarlo.</small> : null}
        </label>
      );
    }

    if (field.relation) {
      const relation = field.relation;
      const options = relationOptions[field.key] ?? [];
      const valueKey = relation.valueKey ?? 'id';

      if (relation.multiple) {
        let selectedValues: string[] = [];
        try {
          const raw = draft[field.key];
          const parsed = Array.isArray(raw) ? raw : raw ? JSON.parse(String(raw)) : [];
          selectedValues = Array.isArray(parsed) ? parsed.map(value => String(value)) : [];
        } catch {
          selectedValues = [];
        }
        const selectedSet = new Set(selectedValues);
        const optionIds = new Set(options.map(option => String(option[valueKey] ?? '')));
        const unresolved = selectedValues.filter(value => !optionIds.has(value));
        const toggle = (value: string, checked: boolean) => {
          const next = new Set(selectedValues);
          if (checked) next.add(value); else next.delete(value);
          setDraft(current => ({ ...current, [field.key]: JSON.stringify([...next], null, 2) }));
        };
        return (
          <div className={`${styles.field} ${styles.fieldWide}`} key={field.key}>
            <span className={styles.labelRow}>
              <span className={styles.label}>{field.label}{field.required ? <span className={styles.required}> *</span> : null}</span>
              <span className={styles.relationTag}>fuentes</span>
            </span>
            {field.help ? <small className={styles.help}>{field.help}</small> : null}
            <div className={styles.multiRelation}>
              {options.length ? options.map(option => {
                const optionValue = String(option[valueKey] ?? '');
                const label = String(option[relation.labelKey] ?? optionValue);
                const secondary = relation.secondaryKey ? String(option[relation.secondaryKey] ?? '') : '';
                return (
                  <label className={styles.multiRelationOption} key={optionValue}>
                    <input type="checkbox" checked={selectedSet.has(optionValue)} disabled={field.readOnly} onChange={event => toggle(optionValue, event.target.checked)} />
                    <span><strong>{label}</strong>{secondary ? <small>{secondary}</small> : null}</span>
                  </label>
                );
              }) : <span className={styles.multiRelationEmpty}>No hay opciones disponibles.</span>}
            </div>
            {unresolved.length ? <small className={styles.relationWarning}>IDs históricos no encontrados en el catálogo: {unresolved.join(' · ')}</small> : null}
            {relationErrors[field.key] ? <small className={styles.relationError}>No fue posible cargar opciones: {relationErrors[field.key]}</small> : null}
          </div>
        );
      }

      const currentValue = String(draft[field.key] ?? '');
      const currentKnown = !currentValue || options.some(option => String(option[valueKey] ?? '') === currentValue);
      return (
        <label className={styles.field} key={field.key}>
          <span className={styles.labelRow}>
            <span className={styles.label}>{field.label}{field.required ? <span className={styles.required}> *</span> : null}</span>
            <span className={styles.relationTag}>selector</span>
          </span>
          {field.help ? <small className={styles.help}>{field.help}</small> : null}
          <select
            className={styles.input}
            value={currentValue}
            disabled={field.readOnly}
            onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {!currentKnown ? <option value={currentValue}>ID actual · {currentValue}</option> : null}
            {options.map(option => {
              const optionValue = String(option[valueKey] ?? '');
              const label = String(option[relation.labelKey] ?? optionValue);
              const secondaryRaw = relation.secondaryKey ? option[relation.secondaryKey] : '';
              const secondary = relation.secondaryKey === 'review_status'
                ? reviewStatusLabel(String(secondaryRaw ?? ''))
                : String(secondaryRaw ?? '');
              return <option key={optionValue} value={optionValue}>{secondary ? label + ' · ' + secondary : label}</option>;
            })}
          </select>
          {relationErrors[field.key] ? <small className={styles.relationError}>No fue posible cargar opciones: {relationErrors[field.key]}</small> : null}
          {!currentKnown ? <small className={styles.relationWarning}>La relación actual no aparece en el catálogo disponible. Puedes conservarla o seleccionar una válida.</small> : null}
        </label>
      );
    }

    if (field.type === 'boolean') {
      return (
        <label className={styles.toggleField} key={field.key}>
          <span className={styles.toggleCopy}>
            <strong>{field.label}{field.required ? ' *' : ''}</strong>
            <small>{field.help || (field.readOnly ? 'Campo de solo lectura.' : 'Activar o desactivar.')}</small>
          </span>
          <span className={styles.switch}>
            <input
              type="checkbox"
              checked={Boolean(draft[field.key])}
              disabled={field.readOnly}
              onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.checked }))}
            />
            <span className={styles.switchTrack} />
          </span>
        </label>
      );
    }

    const wide = field.type === 'textarea' || field.type === 'json';
    const inputType = field.type === 'number' ? 'number'
      : field.type === 'url' ? 'url'
      : field.type === 'date' ? 'date'
      : field.type === 'datetime' ? 'datetime-local'
      : 'text';
    const currentValue = String(draft[field.key] ?? '');
    const validUrl = field.type === 'url' && /^https?:\/\//i.test(currentValue);
    const imagePreview = validUrl && ['image_url', 'thumbnail_url', 'cover_image_url'].includes(field.key);
    const youtubeVideoId = field.preview === 'youtube' ? extractYouTubeVideoId(currentValue) : null;

    return (
      <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`} key={field.key}>
        <span className={styles.labelRow}>
          <span className={styles.label}>
            {field.label}{field.required ? <span className={styles.required}> *</span> : null}
          </span>
          {field.readOnly ? <span className={styles.readOnlyTag}>solo lectura</span> : null}
        </span>
        {field.help ? <small className={styles.help}>{field.help}</small> : null}
        {field.type === 'textarea' || field.type === 'json' ? (
          <textarea
            className={`${styles.textarea} ${field.type === 'json' ? styles.textareaJson : ''}`}
            rows={field.type === 'json' ? 10 : 6}
            value={String(draft[field.key] ?? '')}
            readOnly={field.readOnly}
            onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
          />
        ) : (
          <input
            className={styles.input}
            type={inputType}
            value={String(draft[field.key] ?? '')}
            readOnly={field.readOnly}
            onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
          />
        )}
        {validUrl ? <small className={styles.urlState}>✓ Enlace válido</small> : null}
        {imagePreview ? (
          <span className={styles.imagePreview}>
            <img src={currentValue} alt={`Vista previa · ${field.label}`} />
          </span>
        ) : null}
        {field.preview === 'youtube' ? (
          youtubeVideoId ? (
            <span className={styles.youtubePreview}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
                title={`Vista previa · ${field.label}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </span>
          ) : currentValue ? (
            <small className={styles.urlError}>No se reconoce un video de YouTube válido.</small>
          ) : null
        ) : null}
      </label>
    );
  }

  const statusCounts: Record<StatusFilter, number> = {
    all: counts.total,
    draft: counts.draft,
    review: counts.review,
    published: counts.published,
    archived: counts.archived,
  };

  return (
    <section className={styles.studio}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{table}</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <aside className={styles.contract}>
          <strong>Contrato con CAMINO</strong>
          <p>{appContract}</p>
        </aside>
      </header>

      <div className={styles.metrics}>
        <div className={styles.metric}><span>Total</span><strong>{counts.total}</strong><small>Registros</small></div>
        <div className={styles.metric}><span>Publicados</span><strong>{counts.published}</strong><small>Visibles para CAMINO</small></div>
        <div className={styles.metric}><span>En revisión</span><strong>{counts.review}</strong><small>Pendientes de decisión</small></div>
        <div className={styles.metric}><span>Verificados</span><strong>{counts.verified}</strong><small>Control editorial</small></div>
        <div className={styles.metric}><span>Ficha actual</span><strong>{selected || creating ? completionPercent + '%' : '—'}</strong><small>{selected || creating ? completedRequired + ' de ' + requiredFields.length + ' obligatorios' : 'Selecciona contenido'}</small></div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.search}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Buscar en ${title.toLocaleLowerCase('es')}…`}
          />
        </div>
        <div className={styles.statusTabs}>
          {(Object.keys(statusLabel) as StatusFilter[]).map(item => (
            <button
              className={`${styles.statusTab} ${status === item ? styles.statusTabActive : ''}`}
              key={item}
              type="button"
              onClick={() => setStatus(item)}
            >
              {statusLabel[item]} · {statusCounts[item]}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>
          {create ? (
            <button className={styles.newButton} type="button" onClick={startCreate} disabled={saving}>
              + {create.buttonLabel || 'Nuevo contenido'}
            </button>
          ) : null}
          <button className={styles.refresh} type="button" onClick={() => { void load(); void loadRelations(); }}>Actualizar</button>
        </div>
      </div>

      {message ? (
        <div className={`${styles.message} ${messageKind === 'error' ? styles.messageError : ''}`}>
          {message}
        </div>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.listPane}>
          <div className={styles.listHeader}>
            <strong>Contenido</strong>
            <span>{filtered.length} visibles</span>
          </div>
          <div className={styles.list}>
            {loading ? <div className={styles.empty}>Cargando desde Supabase…</div> : null}
            {!loading && filtered.length === 0 ? <div className={styles.empty}>No hay registros con este filtro.</div> : null}
            {filtered.map(row => (
              <button
                className={`${styles.row} ${selected?.[keyField] === row[keyField] ? styles.rowActive : ''}`}
                key={String(row[keyField])}
                type="button"
                onClick={() => choose(row)}
              >
                <span className={styles.rowTitle}>{String(row[titleKey] ?? row.name ?? row[keyField])}</span>
                <span className={styles.rowMeta}>
                  <span className={styles.rowSecondary}>{String(row[secondaryKey] ?? '')}</span>
                  <span className={`${styles.statusBadge} ${statusClass(effectiveStatus(row))}`}>{reviewStatusLabel(effectiveStatus(row))}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.editor}>
          {!selected && !creating ? <div className={styles.empty}>Selecciona un registro para editar o crea uno nuevo.</div> : (
            <>
              <div className={styles.editorHeader}>
                <div className={styles.editorTitle}>
                  <h3>{creating ? 'Nuevo contenido' : String(selected?.[titleKey] ?? selected?.name ?? selected?.[keyField] ?? '')}</h3>
                  <small>{creating ? 'Se guardará inicialmente como borrador' : keyField + ': ' + String(selected?.[keyField] ?? '')}</small>
                </div>
                <div className={styles.editorMeta}>
                  {creating ? <span className={styles.newRecord}>Nuevo</span> : null}
                  {dirty && !creating ? <span className={styles.dirty}>Cambios sin guardar</span> : null}
                  {selected && (selected.verified === true || selected.calendar_verified === true || selected.readings_verified === true)
                    ? <span className={styles.verified}>✓ Verificado</span> : null}
                  {selected ? (
                    <span className={`${styles.statusBadge} ${statusClass(effectiveStatus(selected))}`}>{reviewStatusLabel(effectiveStatus(selected))}</span>
                  ) : null}
                  {selected && masterStatus ? (
                    <span className={styles.masterBadge}>Gobierno · {masterStatusLabel(masterStatus)}</span>
                  ) : null}
                </div>
              </div>

              {masterNotes ? (
                <div className={styles.masterNotice}>
                  <strong>Gobierno Editorial · Atención</strong>
                  <span>{masterNotes}</span>
                </div>
              ) : null}

              <div className={styles.completionPanel}>
                <div className={styles.completionCopy}>
                  <div>
                    <span>Completitud editorial</span>
                    <strong>{completionPercent}%</strong>
                  </div>
                  <small>{missing.length
                    ? 'Pendiente: ' + missing.map(field => field.label).join(' · ')
                    : relationIssues.length
                      ? 'Relación por corregir: ' + relationIssues.map(field => field.label).join(' · ')
                      : 'Todos los campos obligatorios están completos.'}</small>
                </div>
                <div className={styles.completionTrack} aria-label={`Completitud ${completionPercent}%`}>
                  <span style={{ width: `${completionPercent}%` }} />
                </div>
              </div>

              <div className={styles.form}>{fields.map(renderField)}</div>

              {table === 'weekly_homilies' ? (
                <div className={`${styles.publicationGuard} ${homilyPublicationConfirmed || (selected?.is_active === true && !homilyPublicationIdentityChanged) ? styles.publicationGuardReady : ''}`}>
                  <div className={styles.publicationGuardCopy}>
                    <strong>Confirmación previa a publicación</strong>
                    <span>
                      {selected?.is_active === true && !homilyPublicationIdentityChanged
                        ? 'Esta homilía ya está activa con el mismo video, fecha litúrgica y predicador. Si cambias cualquiera de esos datos, se exigirá una nueva confirmación.'
                        : homilyVideoId
                          ? 'Reproduce la vista previa de YouTube que aparece arriba. Los enlaces de prueba pueden guardarse sin problema mientras la homilía permanezca inactiva.'
                          : 'Pega un enlace válido de YouTube para habilitar la verificación. Puedes conservar el registro como borrador mientras preparas el video definitivo.'}
                    </span>
                  </div>
                  {selected?.is_active === true && !homilyPublicationIdentityChanged ? (
                    <span className={styles.publicationGuardBadge}>✓ Publicación vigente verificada</span>
                  ) : (
                    <label className={styles.publicationCheck}>
                      <input
                        type="checkbox"
                        checked={homilyPublicationConfirmed}
                        disabled={!homilyVideoId}
                        onChange={event => setPublicationConfirmation(event.target.checked ? homilyPublicationSignature : '')}
                      />
                      <span>He reproducido la vista previa y confirmo que video, fecha litúrgica y predicador corresponden a la homilía que deseo publicar en CAMINO.</span>
                    </label>
                  )}
                  {homilyPublicationNeedsConfirmation && !homilyPublicationConfirmed ? (
                    <small className={styles.publicationGuardWarning}>La homilía está marcada como activa, pero no se guardará así hasta completar esta confirmación.</small>
                  ) : null}
                </div>
              ) : null}

              {!creating && selected ? (
                <GovernanceSourceLinks
                  itemKind={table}
                  itemId={String(selected[keyField] ?? '')}
                  editable={!hasLegacySourceField}
                />
              ) : null}

              <div className={styles.actions}>
                <div className={styles.actionGroup}>
                  {creating ? (
                    <button className={styles.button} type="button" onClick={() => { setCreating(false); setDraft({}); setMessage(''); }}>
                      Cancelar
                    </button>
                  ) : (
                    <>
                      <button className={styles.navButton} type="button" disabled={!previous} onClick={() => previous && choose(previous)} aria-label="Anterior">‹</button>
                      <button className={styles.navButton} type="button" disabled={!next} onClick={() => next && choose(next)} aria-label="Siguiente">›</button>
                      <span className={styles.help}>{selectedIndex >= 0 ? `${selectedIndex + 1} de ${filtered.length}` : ''}</span>
                    </>
                  )}
                </div>
                <div className={styles.actionGroup}>
                  {!creating && selected?.review_status === 'draft' ? (
                    <button
                      className={styles.button}
                      type="button"
                      disabled={saving || dirty || missing.length > 0 || relationIssues.length > 0}
                      onClick={() => void requestReview()}
                    >
                      Enviar a revisión
                    </button>
                  ) : null}
                  {!creating && selected?.review_status === 'review' ? (
                    <button className={styles.button} type="button" onClick={() => { window.location.href = '/admin/review'; }}>
                      Abrir Cola de Revisión
                    </button>
                  ) : null}
                  {!creating && selected && masterStatus && !['draft','in_review','published'].includes(masterStatus) ? (
                    <button className={styles.button} type="button" onClick={() => { window.location.href = '/admin/governance?kind=' + encodeURIComponent(table) + '&id=' + encodeURIComponent(String(selected[keyField] ?? '')); }}>
                      Ver Gobierno Editorial
                    </button>
                  ) : null}
                  <button
                    className={styles.buttonPrimary}
                    type="button"
                    disabled={saving || !dirty || missing.length > 0 || (creating && relationIssues.length > 0)}
                    onClick={() => void save()}
                  >
                    {saving ? 'Guardando…' : creating ? 'Crear borrador' : dirty ? 'Guardar cambios' : 'Sin cambios'}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
