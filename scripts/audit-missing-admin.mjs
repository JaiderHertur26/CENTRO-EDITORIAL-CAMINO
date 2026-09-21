import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8')
.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('='))
.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const tables=['editorial_catalog_state','pastoral_public_events','pastoral_push_outbox','pastoral_push_deliveries','pastoral_push_devices','spiritual_series_progress','spiritual_series_reactions','privacy_requests','profiles','user_favorites','user_resolutions'];
for(const table of tables){
 const c=await sb.from(table).select('*',{count:'exact',head:true});
 const s=await sb.from(table).select('*').limit(1);
 console.log(JSON.stringify({table,count:c.count??null,countError:c.error?.message??null,sampleError:s.error?.message??null,keys:Object.keys(s.data?.[0]??{})}));
}