import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
for(const date of ['2026-09-19','2026-09-20']){
 const {data,error}=await sb.from('daily_readings').select('date,first_reading_ref,psalm_ref,psalm_response,gospel_acclamation_kind,gospel_acclamation_ref,alleluia_ref,gospel_ref,gospel_summary,readings_verified,review_status,revision,reading_notes').eq('date',date).eq('locale','es-CO').limit(1);
 console.log('\nDATE',date,'ERROR',error?.message??'');
 console.log(JSON.stringify(data?.[0]??null,null,2));
}