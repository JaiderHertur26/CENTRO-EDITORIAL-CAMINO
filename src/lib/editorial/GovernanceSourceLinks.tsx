'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './EditorialStudio.module.css';

type Row = Record<string, any>;

export default function GovernanceSourceLinks({
  itemKind,
  itemId,
  editable,
}: {
  itemKind: string;
  itemId: string;
  editable: boolean;
}) {
  const [policy, setPolicy] = useState<{ require_sources: boolean } | null>(null);
  const [sources, setSources] = useState<Row[]>([]);
  const [references, setReferences] = useState<Row[]>([]);
  const [links, setLinks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function load() {
    if (!itemId) return;
    setLoading(true);
    setMessage('');
    setError(false);

    const [policyResult, sourceResult, referenceResult, linkResult] = await Promise.all([
      supabase
        .from('editorial_content_policy')
        .select('require_sources')
        .eq('item_kind', itemKind)
        .maybeSingle(),
      supabase
        .from('editorial_sources')
        .select('id,name,source_type,verified,review_status,is_active')
        .order('name', { ascending: true })
        .limit(500),
      supabase
        .from('source_reference')
        .select('id,source_id,reference_type')
        .eq('reference_type', 'GENERAL')
        .limit(1000),
      supabase
        .from('content_source')
        .select('id,source_reference_id,relation_type,verified')
        .eq('item_kind', itemKind)
        .eq('item_id', itemId)
        .limit(500),
    ]);

    if (policyResult.error) {
      setPolicy(null);
      setError(true);
      setMessage(policyResult.error.message);
    } else {
      setPolicy((policyResult.data ?? null) as { require_sources: boolean } | null);
    }

    if (sourceResult.error || referenceResult.error || linkResult.error) {
      setError(true);
      setMessage(
        sourceResult.error?.message ||
        referenceResult.error?.message ||
        linkResult.error?.message ||
        'No fue posible cargar la trazabilidad.'
      );
    }

    setSources((sourceResult.data ?? []) as Row[]);
    setReferences((referenceResult.data ?? []) as Row[]);
    setLinks((linkResult.data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [itemKind, itemId]);

  const referenceBySource = useMemo(() => {
    const map = new Map<string, Row>();
    for (const row of references) map.set(String(row.source_id), row);
    return map;
  }, [references]);

  const linkBySource = useMemo(() => {
    const referenceSource = new Map<string, string>();
    for (const row of references) referenceSource.set(String(row.id), String(row.source_id));

    const map = new Map<string, Row>();
    for (const link of links) {
      const sourceId = referenceSource.get(String(link.source_reference_id));
      if (sourceId) map.set(sourceId, link);
    }
    return map;
  }, [links, references]);

  const linkedSources = sources.filter(source => linkBySource.has(String(source.id)));
  const verifiedLinks = linkedSources.filter(source => {
    const link = linkBySource.get(String(source.id));
    return Boolean(source.verified) && Boolean(link?.verified);
  }).length;

  if (!loading && !policy?.require_sources && links.length === 0) return null;

  async function ensureReference(source: Row) {
    const existing = referenceBySource.get(String(source.id));
    if (existing) return existing;

    const result = await supabase
      .from('source_reference')
      .insert({
        source_id: source.id,
        reference_type: 'GENERAL',
        notes: 'Referencia general creada desde Centro Editorial.',
      })
      .select('id,source_id,reference_type')
      .single();

    if (result.error) throw result.error;
    return result.data as Row;
  }

  async function toggleSource(source: Row) {
    if (!editable) return;
    const sourceId = String(source.id);
    const existingLink = linkBySource.get(sourceId);
    setBusy(sourceId);
    setMessage('');
    setError(false);

    try {
      if (existingLink) {
        const result = await supabase.from('content_source').delete().eq('id', existingLink.id);
        if (result.error) throw result.error;
        setMessage('Fuente desvinculada del contenido.');
      } else {
        const reference = await ensureReference(source);
        const result = await supabase.from('content_source').insert({
          item_kind: itemKind,
          item_id: itemId,
          source_reference_id: reference.id,
          relation_type: 'SUPPORTING',
          importance: 50,
          verified: Boolean(source.verified),
        });
        if (result.error) throw result.error;
        setMessage(source.verified
          ? 'Fuente verificada vinculada al contenido.'
          : 'Fuente vinculada, pero todavía no está verificada y no satisface el Candado.');
      }
      await load();
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'No fue posible actualizar la fuente.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className={styles.governanceSources}>
      <div className={styles.governanceSourcesHeader}>
        <div>
          <span>Gobierno Editorial V2 · Trazabilidad</span>
          <strong>Fuentes que sostienen esta ficha</strong>
          <small>
            {editable
              ? 'Selecciona las fuentes reales. Sólo una fuente verificada satisface el Candado de publicación.'
              : 'Este módulo conserva sus fuentes en el campo editorial y V2 las sincroniza automáticamente.'}
          </small>
        </div>
        <div className={styles.governanceSourceStats}>
          <span><b>{links.length}</b> vinculadas</span>
          <span className={verifiedLinks > 0 ? styles.sourceStatOk : styles.sourceStatWarn}>
            <b>{verifiedLinks}</b> verificadas
          </span>
        </div>
      </div>

      {loading ? <div className={styles.empty}>Consultando fuentes V2…</div> : null}

      {!loading && editable ? (
        <div className={styles.governanceSourceGrid}>
          {sources.filter(source => source.is_active !== false).map(source => {
            const sourceId = String(source.id);
            const linked = linkBySource.has(sourceId);
            return (
              <button
                type="button"
                key={sourceId}
                className={styles.governanceSourceOption + (linked ? ' ' + styles.governanceSourceOptionActive : '')}
                disabled={Boolean(busy)}
                onClick={() => void toggleSource(source)}
              >
                <span className={styles.governanceSourceCheck}>{linked ? '✓' : '+'}</span>
                <span>
                  <strong>{String(source.name ?? source.id)}</strong>
                  <small>{String(source.source_type ?? 'fuente')} · {source.verified ? 'verificada' : 'sin verificar'}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && !editable && linkedSources.length ? (
        <div className={styles.governanceSourceChips}>
          {linkedSources.map(source => (
            <span key={String(source.id)}>
              {String(source.name ?? source.id)}
              {source.verified ? ' · ✓' : ' · pendiente'}
            </span>
          ))}
        </div>
      ) : null}

      {!loading && policy?.require_sources && verifiedLinks === 0 ? (
        <div className={styles.sourceGateWarning}>
          Publicación protegida: falta al menos una fuente editorial verificada.
        </div>
      ) : null}

      {message ? (
        <div className={styles.sourceMessage + (error ? ' ' + styles.sourceMessageError : '')}>{message}</div>
      ) : null}
    </section>
  );
}
