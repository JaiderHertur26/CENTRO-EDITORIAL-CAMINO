import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8')
.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('='))
.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
for(const table of ['daily_readings','liturgical_days','pastoral_entities','pastoral_public_events','pastoral_announcements','spiritual_series_days']){
 const {data,error}=await sb.from(table).select('*').limit(1);
 console.log('\n'+table+' '+(error?.message??''));
 console.log(Object.keys(data?.[0]??{}).join(','));
}