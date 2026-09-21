'use client';

import AdminFrame from '@/lib/AdminFrame';
import BridgeCollectionEditor from '@/lib/editorial/BridgeCollectionEditor';

export default function Page() {
  return (
    <AdminFrame
      title="Edición · Homilías"
      subtitle="Supabase → weekly_homilies → CAMINO"
      badge="Puente editorial"
    >
      <BridgeCollectionEditor
        table="weekly_homilies"
        locale={null}
        title="Homilías"
        subtitle="Contenido audiovisual dominical con borradores seguros y verificación explícita antes de publicar."
        appContract="CAMINO consume exclusivamente youtube_input de las homilías activas. Puedes guardar enlaces de prueba mientras el registro permanezca inactivo; para activar o cambiar video, fecha o predicador de una homilía publicada, debes reproducir la vista previa y confirmar expresamente la correspondencia."
        titleKey="title"
        secondaryKey="liturgical_date"
        orderBy="liturgical_date"
        ascending={false}
        create={{
          keyStrategy: 'uuid',
          slugSource: 'title',
          slugField: null,
          buttonLabel: 'Nueva homilía',
          helper: 'La nueva homilía nace inactiva. Puedes usar un enlace de prueba mientras preparas el video definitivo; CAMINO solo la recibirá cuando la actives después de verificarla.',
          defaults: { is_active: false, is_featured: false, display_order: 0, sort_order: 0 },
        }}
        fields={[
          { key: 'title', label: 'Título', required: true },
          { key: 'subtitle', label: 'Subtítulo' },
          { key: 'description', label: 'Descripción', type: 'textarea' },
          { key: 'liturgical_date', label: 'Fecha litúrgica', type: 'date', required: true },
          { key: 'speaker_name', label: 'Predicador' },
          {
            key: 'youtube_input',
            label: 'Video de YouTube · fuente canónica',
            type: 'url',
            required: true,
            preview: 'youtube',
            help: 'Este es el único enlace que consume CAMINO. En borrador puede ser temporal o de prueba; antes de activar, reproduce la vista previa y realiza la confirmación editorial.',
          },
          { key: 'thumbnail_url', label: 'Miniatura opcional', type: 'url' },
          { key: 'duration_label', label: 'Duración' },
          { key: 'is_active', label: 'Activa en CAMINO', type: 'boolean', help: 'Activa únicamente después de confirmar la vista previa del video.' },
          { key: 'is_featured', label: 'Destacada', type: 'boolean', help: 'Usa una sola destacada para el domingo vigente.' },
          { key: 'display_order', label: 'Orden visual', type: 'number' },
          { key: 'sort_order', label: 'Orden', type: 'number' },
          { key: 'published_at', label: 'Publicado', readOnly: true },
        ]}
      />
    </AdminFrame>
  );
}
