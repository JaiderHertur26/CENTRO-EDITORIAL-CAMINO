import { supabase } from '@/lib/supabase';
export async function tableCount(table:string){
  const result=await supabase.from(table).select('*',{count:'exact',head:true});
  return {table,count:result.count??0,error:result.error?.message??null};
}
export const editorialTables=['daily_readings','liturgical_days','saints','prayers','audio_assets','editorial_sources','formation_tracks','formation_lessons','pastoral_entities','pastoral_schedules','pastoral_public_events','pastoral_announcements','spiritual_series','spiritual_series_days','weekly_homilies'] as const;
