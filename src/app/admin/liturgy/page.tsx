'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import AdminFrame from '@/lib/AdminFrame';
import { supabase } from '@/lib/supabase';

type AnyObj = Record<string, any>;

const clean = (value: any) => typeof value === 'string' ? value : '';

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function emptyForm() {
  return {
    first_ref: '', first_title: '', first_text: '',
    first_alt_ref: '', first_alt_title: '', first_alt_text: '',
    psalm_ref: '', psalm_liturgical_ref: '', psalm_response: '',
    second_ref: '', second_title: '', second_text: '',
    acclamation_ref: '', acclamation_text: '',
    gospel_ref: '', gospel_title: '', gospel_text: '',
    gospel_alt_ref: '', gospel_alt_title: '', gospel_alt_text: '',
  };
}
type Form = ReturnType<typeof emptyForm>;
type PsalmStropheDraft = {
  reference: string;
  text: string;
};
const emptyPsalmStrophe = (): PsalmStropheDraft => ({ reference: '', text: '' });

export default function Page() {
  const [date, setDate] = useState(today());
  const [row, setRow] = useState<AnyObj | null>(null);
  const [day, setDay] = useState<AnyObj | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [psalmStrophes, setPsalmStrophes] = useState<PsalmStropheDraft[]>([emptyPsalmStrophe()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);

  async function load() {
    setCreatingNew(false);
    setLoading(true);
    setMsg('');
    setErr(false);

    const [readingsResult, dayResult] = await Promise.all([
      supabase.from('daily_readings').select('*').eq('date', date).maybeSingle(),
      supabase.from('liturgical_days').select('*').eq('date', date).maybeSingle(),
    ]);

    if (readingsResult.error) {
      setErr(true);
      setMsg(readingsResult.error.message);
      setRow(null);
      setLoading(false);
      return;
    }    const currentRow = (readingsResult.data ?? null) as AnyObj | null;
    setRow(currentRow);
    setDay((dayResult.data ?? null) as AnyObj | null);

    if (!currentRow) {
      setForm(emptyForm());
      setPsalmStrophes([emptyPsalmStrophe()]);
      setMsg('No existe daily_readings para esta fecha.');
      setLoading(false);
      return;
    }

    const notes = (currentRow.reading_notes ?? {}) as AnyObj;
    const editorial = (notes.editorial_texts ?? {}) as AnyObj;
    const psalm = (notes.psalm_structure ?? {}) as AnyObj;
    const strophes = Array.isArray(psalm.strophes) ? psalm.strophes : [];

    setForm({
      first_ref: clean(currentRow.first_reading_ref),
      first_title: clean(editorial.first_reading?.title),
      first_text: clean(editorial.first_reading?.text),
      first_alt_ref: clean(currentRow.first_reading_alternate_ref),
      first_alt_title: clean(editorial.first_reading_alternate?.title),
      first_alt_text: clean(editorial.first_reading_alternate?.text),
      psalm_ref: clean(currentRow.psalm_ref),
      psalm_liturgical_ref: clean(psalm.liturgical_ref || currentRow.psalm_liturgical_ref),
      psalm_response: clean(psalm.response || currentRow.psalm_response),
      second_ref: clean(currentRow.second_reading_ref),
      second_title: clean(editorial.second_reading?.title),
      second_text: clean(editorial.second_reading?.text),
      acclamation_ref: clean(currentRow.alleluia_ref),
      acclamation_text: clean(editorial.gospel_acclamation?.text || currentRow.gospel_acclamation_text),
      gospel_ref: clean(currentRow.gospel_ref),
      gospel_title: clean(editorial.gospel?.title),
      gospel_text: clean(editorial.gospel?.text),
      gospel_alt_ref: clean(currentRow.gospel_alternate_ref),
      gospel_alt_title: clean(editorial.gospel_alternate?.title),
      gospel_alt_text: clean(editorial.gospel_alternate?.text),
    });

    const normalizedStrophes = strophes
      .map((item: AnyObj, index: number) => ({
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
        reference: clean(item?.reference),
        text: clean(item?.text),
      }))
      .filter((item: { text: string }) => item.text.trim())
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
      .map((item: { reference: string; text: string }) => ({
        reference: item.reference,
        text: item.text,
      }));
    setPsalmStrophes(normalizedStrophes.length ? normalizedStrophes : [emptyPsalmStrophe()]);

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [date]);

  const setField = (key: keyof Form) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const setPsalmStropheField = (
    index: number,
    key: keyof PsalmStropheDraft,
    value: string,
  ) => setPsalmStrophes((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item
    )
  );

  const addPsalmStrophe = () =>
    setPsalmStrophes((current) => [...current, emptyPsalmStrophe()]);

  const removePsalmStrophe = (index: number) =>
    setPsalmStrophes((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [emptyPsalmStrophe()];
    });

  const required = useMemo(() => Boolean(
    form.first_ref && form.first_text &&
    form.psalm_ref && form.psalm_response &&
    psalmStrophes.some((item) => item.text.trim()) &&
    form.gospel_ref && form.gospel_text
  ), [form, psalmStrophes]);
  async function save() {
    if (!row && !creatingNew) return;
    if (creatingNew && !required) {
      setErr(true);
      setMsg('Completa Primera lectura, Salmo responsorial y Evangelio antes de crear la fecha.');
      return;
    }

    setSaving(true);
    setMsg('');
    setErr(false);

    const oldNotes = (row?.reading_notes ?? {}) as AnyObj;
    const strophes = psalmStrophes
      .filter((item) => item.text.trim())
      .map((item, index) => ({
        order: index + 1,
        reference: item.reference.trim() || null,
        text: item.text.trim(),
        text_source: 'document',
      }));

    const notes = {
      ...oldNotes,
      manual_editorial_import: true,
      editorial_texts_updated_at: new Date().toISOString(),
      editorial_source: {
        ...(oldNotes.editorial_source ?? {}),
        label: 'Fuente editorial',
        scope: 'CAMINO · Liturgia de la Palabra',
        locale: 'es-CO',
        text: 'Texto bíblico: Biblia Católica CAMINO, versión propia en español latinoamericano.',
      },      editorial_texts: {
        ...(oldNotes.editorial_texts ?? {}),
        first_reading: {
          title: form.first_title.trim(),
          text: form.first_text.trim(),
        },
        first_reading_alternate: form.first_alt_ref ? {
          title: form.first_alt_title.trim(),
          text: form.first_alt_text.trim(),
        } : null,
        second_reading: form.second_ref ? {
          title: form.second_title.trim(),
          text: form.second_text.trim(),
        } : null,
        gospel_acclamation: {
          text: form.acclamation_text.trim(),
        },
        gospel: {
          title: form.gospel_title.trim(),
          text: form.gospel_text.trim(),
        },
        gospel_alternate: form.gospel_alt_ref ? {
          title: form.gospel_alt_title.trim(),
          text: form.gospel_alt_text.trim(),
        } : null,
      },
      psalm_structure: {
        ...(oldNotes.psalm_structure ?? {}),
        liturgical_ref: form.psalm_liturgical_ref.trim() || form.psalm_ref.trim(),
        response: form.psalm_response.trim(),
        strophe_refs: strophes.map((item) => item.reference).filter(Boolean),
        strophes,
        text_source: 'document',
      },
    };
    const payload: AnyObj = {
      first_reading_ref: form.first_ref.trim(),
      first_reading_alternate_ref: form.first_alt_ref.trim() || null,
      psalm_ref: form.psalm_ref.trim(),
      psalm_response: form.psalm_response.trim(),
      second_reading_ref: form.second_ref.trim() || null,
      alleluia_ref: form.acclamation_ref.trim() || null,
      gospel_acclamation_text: form.acclamation_text.trim() || null,
      gospel_ref: form.gospel_ref.trim(),
      gospel_alternate_ref: form.gospel_alt_ref.trim() || null,
      reading_notes: notes,
      updated_at: new Date().toISOString(),
    };

    if (row && 'revision' in row) {
      payload.revision = Number(row.revision ?? 0) + 1;
    }

    if (creatingNew) {
      const year = date.slice(0, 4);
      const calendarCode = 'CO-ROMAN-' + year;
      payload.id = 'reading:' + calendarCode + ':es-CO:' + date;
      payload.calendar_code = calendarCode;
      payload.locale = 'es-CO';
      payload.date = date;
      payload.review_status = 'draft';
      payload.revision = 1;
      payload.readings_verified = false;
      payload.technical_verified = false;
    }

    const result = creatingNew
      ? await supabase.from('daily_readings').insert(payload).select('*').single()
      : await supabase.from('daily_readings').update(payload).eq('date', date).select('*').single();

    if (result.error) {
      setErr(true);
      setMsg(result.error.message);
    } else {
      setCreatingNew(false);
      setMsg(creatingNew
        ? 'Fecha litúrgica creada como borrador en Supabase.'
        : 'Lecturas guardadas en Supabase. La publicación continúa por Gobierno Editorial.');
      setRow(result.data as AnyObj);
    }

    setSaving(false);
  }

  async function sendToReview() {
    if (!row || creatingNew) return;
    if (!required) {
      setErr(true);
      setMsg('Completa Primera lectura, Salmo responsorial y Evangelio antes de enviar a revisión.');
      return;
    }
    if (String(row.review_status ?? 'draft') !== 'draft') {
      window.location.href = '/admin/review';
      return;
    }

    setSaving(true);
    setMsg('');
    setErr(false);

    const payload: AnyObj = {
      review_status: 'review',
      updated_at: new Date().toISOString(),
    };
    if ('revision' in row) payload.revision = Number(row.revision ?? 0) + 1;

    const result = await supabase
      .from('daily_readings')
      .update(payload)
      .eq('date', date)
      .select('*')
      .single();

    if (result.error) {
      setErr(true);
      setMsg(result.error.message);
    } else {
      setRow(result.data as AnyObj);
      setMsg('Lecturas enviadas a revisión. Gobierno Editorial continuará con fuente, aprobación y publicación.');
    }
    setSaving(false);
  }

  function Field({
    label,
    k,
    type = 'text',
    wide = false,
    help,
  }: {
    label: string;
    k: keyof Form;
    type?: 'text' | 'textarea';
    wide?: boolean;
    help?: string;
  }) {
    return (
      <label className={'form-field ' + (wide ? 'wide' : '')}>
        <span className="form-label">{label}</span>
        {help ? <small className="field-help">{help}</small> : null}
        {type === 'textarea' ? (
          <textarea className="textarea" rows={6} value={form[k]} onChange={setField(k)} />
        ) : (
          <input className="input" value={form[k]} onChange={setField(k)} />
        )}
      </label>
    );
  }
  function EditorSection({
    id,
    number,
    title,
    description,
    children,
    accent,
  }: {
    id: string;
    number: string;
    title: string;
    description: string;
    children: ReactNode;
    accent?: string;
  }) {
    return (
      <section className="liturgy-editor-section" id={id}>
        <div className="liturgy-section-head">
          <span className="liturgy-section-number">{number}</span>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          {accent ? <span className="liturgy-section-accent">{accent}</span> : null}
        </div>
        <div className="form-grid">{children}</div>
      </section>
    );
  }

  const status = String(row?.review_status ?? 'draft');
  const published = status === 'published' || Boolean(row?.published_at);
  const stropheCount = psalmStrophes.filter((item) => item.text.trim()).length;
  return (
    <AdminFrame
      title="Liturgia diaria"
      subtitle="Carga manual diaria · Liturgia de la Palabra"
      badge="Biblia Católica CAMINO · Latinoamericana"
    >
      <section className="hero-card liturgy-workspace-hero">
        <div>
          <p className="eyebrow">CATÁLOGO EDITORIAL DE LITURGIA</p>
          <h2>Lecturas y Salmo del día</h2>
          <p>
            Edita el contenido que gobierna la Liturgia de la Palabra en CAMINO.
            Cada cambio se guarda en Supabase y la publicación sigue siendo una acción explícita.
          </p>
        </div>
        <div className="liturgy-hero-status">
          <span className={'editorial-state ' + (published ? 'published' : 'draft')}>
            {published ? 'Publicado' : 'Borrador'}
          </span>
          <strong>{date}</strong>
          <small>{stropheCount} estrofas del Salmo cargadas</small>
        </div>
      </section>

      <section className="manager-card liturgy-date-card">
        <div className="manager-head liturgy-date-head">
          <div>
            <p className="eyebrow dark">JORNADA LITÚRGICA</p>
            <h2>{day?.title ?? 'Selecciona una fecha'}</h2>
            <p>{day?.rank ?? 'Sin rango informado'} {day?.color ? '· ' + day.color : ''}</p>
          </div>          <label className="form-field liturgy-date-field">
            <span className="form-label">Fecha editorial</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>

        {loading ? <div className="empty">Cargando desde Supabase…</div> : null}
        {msg ? <div className={'message ' + (err ? 'error' : '')}>{msg}</div> : null}

        {!row && !loading && !creatingNew ? (
          <div className="liturgy-empty-state">
            <span>✠</span>
            <strong>No hay lectura editorial para esta fecha</strong>
            <p>La tabla daily_readings no contiene un registro editable para {date}.</p>
            <button className="btn-primary" type="button" onClick={() => { setCreatingNew(true); setForm(emptyForm()); setPsalmStrophes([emptyPsalmStrophe()]); setMsg('Nueva fecha preparada localmente. Completa el contenido obligatorio antes de guardarla.'); setErr(false); }}>
              + Preparar lecturas para esta fecha
            </button>
          </div>
        ) : null}

        {(row || creatingNew) && !loading ? (
          <div className="liturgy-editor-layout">
            <aside className="liturgy-outline">
              <p className="eyebrow dark">CONTENIDO DEL DÍA</p>
              <a href="#primera">01 · Primera lectura</a>
              <a href="#salmo">02 · Salmo responsorial</a>
              <a href="#segunda">03 · Segunda lectura</a>
              <a href="#aclamacion">04 · Aclamación</a>
              <a href="#evangelio">05 · Evangelio</a>
              <div className="liturgy-outline-summary">
                <span>Obligatorios</span>
                <strong>{required ? 'Completos' : 'Pendientes'}</strong>
                <small>Primera lectura · Salmo · Evangelio</small>
              </div>
            </aside>

            <div className="liturgy-editor-stack">
              <EditorSection
                id="primera"
                number="01"
                title="Primera lectura"
                description="Cita, encabezado editorial y texto bíblico completo."
                accent="Obligatoria"
              >
                <Field label="Cita bíblica *" k="first_ref" />
                <Field label="Título / subtítulo" k="first_title" />
                <Field label="Texto completo · Primera lectura *" k="first_text" type="textarea" wide />
                <Field label="Lectura alternativa · cita" k="first_alt_ref" />
                <Field label="Título alternativa" k="first_alt_title" />
                <Field label="Texto completo · alternativa" k="first_alt_text" type="textarea" wide />
              </EditorSection>

              <EditorSection
                id="salmo"
                number="02"
                title="Salmo responsorial"
                description="Respuesta litúrgica y estrofas completas, en el orden que verá la aplicación."
                accent={stropheCount + ' estrofas'}
              >                <Field label="Salmo · cita *" k="psalm_ref" />
                <Field label="Referencia litúrgica" k="psalm_liturgical_ref" />
                <div className="form-field wide psalm-response-field">
                  <span className="form-label">R/. Respuesta responsorial *</span>
                  <small className="field-help">Debe coincidir con la versión editorial publicada para esta fecha.</small>
                  <textarea className="textarea psalm-response-input" rows={2} value={form.psalm_response} onChange={setField('psalm_response')} />
                </div>
                <div className="psalm-strophe-editor">
                  <div className="psalm-strophe-toolbar">
                    <div>
                      <strong>Estrofas del Salmo</strong>
                      <small>Agrega exactamente las estrofas que correspondan a la liturgia del día. No hay límite fijo.</small>
                    </div>
                    <button className="btn" type="button" onClick={addPsalmStrophe}>
                      + Agregar estrofa
                    </button>
                  </div>

                  <div className="psalm-strophe-list">
                    {psalmStrophes.map((strophe, index) => (
                      <div className="psalm-strophe-card" key={'psalm-strophe-editor-' + index}>
                        <div className="psalm-strophe-card-head">
                          <strong>Estrofa {index + 1}</strong>
                          {psalmStrophes.length > 1 ? (
                            <button
                              className="btn psalm-strophe-remove"
                              type="button"
                              onClick={() => removePsalmStrophe(index)}
                              aria-label={'Eliminar estrofa ' + (index + 1)}
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </div>
                        <div className="form-grid">
                          <label className="form-field">
                            <span className="form-label">Estrofa {index + 1} · cita</span>
                            <input
                              className="input"
                              value={strophe.reference}
                              onChange={(event) => setPsalmStropheField(index, 'reference', event.target.value)}
                            />
                          </label>
                          <label className="form-field">
                            <span className="form-label">
                              Estrofa {index + 1}{index === 0 ? ' *' : ''}
                            </span>
                            <textarea
                              className="textarea"
                              rows={6}
                              value={strophe.text}
                              onChange={(event) => setPsalmStropheField(index, 'text', event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn psalm-strophe-add-bottom" type="button" onClick={addPsalmStrophe}>
                    + Agregar otra estrofa
                  </button>
                </div>
              </EditorSection>

              <EditorSection
                id="segunda"
                number="03"
                title="Segunda lectura"
                description="Se utiliza cuando la celebración del día la contempla."
                accent="Opcional"
              >
                <Field label="Cita bíblica" k="second_ref" />
                <Field label="Título / subtítulo" k="second_title" />
                <Field label="Texto completo · Segunda lectura" k="second_text" type="textarea" wide />
              </EditorSection>
              <EditorSection
                id="aclamacion"
                number="04"
                title="Aclamación antes del Evangelio"
                description="Cita y texto que prepara la proclamación del Evangelio."
                accent="Liturgia"
              >
                <Field label="Aclamación · cita" k="acclamation_ref" />
                <div className="form-field wide acclamation-field">
                  <span className="form-label">Texto de la aclamación</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={form.acclamation_text}
                    onChange={setField('acclamation_text')}
                  />
                </div>
              </EditorSection>

              <EditorSection
                id="evangelio"
                number="05"
                title="Evangelio"
                description="Cita, título editorial y texto completo que verá el usuario."
                accent="Obligatorio"
              >
                <Field label="Evangelio · cita *" k="gospel_ref" />
                <Field label="Título / subtítulo" k="gospel_title" />
                <Field label="Texto completo · Evangelio *" k="gospel_text" type="textarea" wide />
                <Field label="Evangelio alternativo · cita" k="gospel_alt_ref" />
                <Field label="Título Evangelio alternativo" k="gospel_alt_title" />                <Field label="Texto completo · Evangelio alternativo" k="gospel_alt_text" type="textarea" wide />
              </EditorSection>

              <div className="liturgy-save-dock">
                <div className="liturgy-validation">
                  <span className={'validation-dot ' + (required ? 'ok' : 'warn')} />
                  <div>
                    <strong>{required ? 'Contenido mínimo completo' : 'Faltan campos obligatorios'}</strong>
                    <small>
                      {required
                        ? 'Primera lectura, Salmo y Evangelio están listos para revisión.'
                        : 'Completa Primera lectura, Salmo y Evangelio antes de enviar a revisión.'}
                    </small>
                  </div>
                </div>
                <div className="liturgy-save-actions">
                  {creatingNew ? (
                    <button className="btn" type="button" disabled={saving} onClick={() => { setCreatingNew(false); setForm(emptyForm()); setMsg(''); setErr(false); }}>
                      Cancelar alta
                    </button>
                  ) : null}
                  <button className="btn" disabled={saving || (creatingNew && !required)} onClick={() => void save()}>
                    {saving ? 'Guardando…' : creatingNew ? 'Crear borrador' : published ? 'Guardar cambios' : 'Guardar borrador'}
                  </button>
                  {!creatingNew && status === 'draft' ? (
                    <button className="btn-primary" disabled={saving || !required} onClick={() => void sendToReview()}>
                      {saving ? 'Enviando…' : 'Enviar a revisión'}
                    </button>
                  ) : null}
                  {!creatingNew && status === 'review' ? (
                    <button className="btn-primary" disabled={saving} onClick={() => { window.location.href = '/admin/review'; }}>
                      Abrir Cola de Revisión
                    </button>
                  ) : null}
                  {!creatingNew && published ? (
                    <button className="btn" type="button" onClick={() => { window.location.href = '/admin/governance?kind=daily_readings&id=' + encodeURIComponent(String(row?.id ?? date)); }}>
                      Ver Gobierno Editorial
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AdminFrame>
  );
}
