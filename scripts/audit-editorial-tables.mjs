import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  'daily_readings','liturgical_days','saints','prayers','audio_assets',
  'editorial_sources','formation_tracks','formation_lessons',
  'pastoral_entities','pastoral_schedules','pastoral_public_events',
  'pastoral_announcements','spiritual_series','spiritual_series_days',
  'weekly_homilies'
];

for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(JSON.stringify({ table, count: count ?? null, ok: !error, error: error?.message ?? null }));
}