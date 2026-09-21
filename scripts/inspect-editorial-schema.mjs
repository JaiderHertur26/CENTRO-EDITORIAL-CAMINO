import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8')
.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('='))
.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const tables=['saints','prayers','audio_assets','editorial_sources','formation_tracks','formation_lessons',
'pastoral_entities','pastoral_schedules','pastoral_announcements','spiritual_series','spiritual_series_days','weekly_homilies','liturgical_days'];
for(const table of tables){
 const {data,error}=await sb.from(table).select('*').limit(2);
 if(error){console.log(table,'ERROR',error.message);continue;}
 console.log('\n### '+table);
 console.log('KEYS',Object.keys(data?.[0]??{}).join(','));
 for(const row of data??[]){
   const out={};
   for(const k of ['id','slug','title','name','date','locale','review_status','status','published_at','verified','day_number','kind','category','updated_at']) if(k in row) out[k]=row[k];
   console.log(JSON.stringify(out));
 }
}