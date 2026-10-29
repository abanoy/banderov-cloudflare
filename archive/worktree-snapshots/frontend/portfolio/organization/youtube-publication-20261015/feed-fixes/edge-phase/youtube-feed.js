// Fixed public channel only. No API key, cookies, account access or arbitrary proxy URLs.
export const CHANNEL_ID='UCEyvYB3tiYdbkSavB_xINlQ';
export const FEED_PATH='/api/youtube/public-uploads';
const SOURCE='https://www.youtube.com/feeds/videos.xml?channel_id='+CHANNEL_ID;
const FRESH=3600000,MAX_STALE=86400000,MAX_BYTES=200000;
const decode=text=>text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,entity=>{
 const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(names[entity])return names[entity];const n=entity.startsWith('&#x')?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
});
const field=(text,name)=>text.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>'))?.[1]?.trim();
export function parsePublicFeed(xml){
 if(typeof xml!=='string'||xml.length>MAX_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Invalid public feed');
 if(![CHANNEL_ID,CHANNEL_ID.slice(2)].includes(field(xml,'yt:channelId')))throw Error('Unexpected channel');
 const videos=[];for(const entry of xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/g)||[]){
  const id=field(entry,'yt:videoId'),channel=field(entry,'yt:channelId'),title=decode(field(entry,'title')||''),published=field(entry,'published');
  if(!/^[\w-]{11}$/.test(id||'')||channel!==CHANNEL_ID||!title||title.length>500||!published||!Number.isFinite(Date.parse(published)))throw Error('Invalid public entry');
  if(!videos.some(v=>v.id===id))videos.push({id,title,published:new Date(published).toISOString()});
 }
 if(!videos.length||videos.length>15)throw Error('Unexpected feed length');
 return videos.sort((a,b)=>b.published.localeCompare(a.published));
}
export function createPublicUploadsFeed({fetcher=globalThis.fetch,cache=globalThis.caches?.default,now=Date.now}={}){
 let pending=null,retryAfter=0,memory=null;
 const key=new Request('https://banderov.com'+FEED_PATH);
 async function load(){
  if(pending)return pending;
  if(now()<retryAfter)throw Error('Feed cooling down');
  pending=(async()=>{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
   try{const response=await fetcher(SOURCE,{headers:{Accept:'application/atom+xml'},signal:controller.signal,redirect:'error'});if(!response.ok)throw Object.assign(Error('Feed unavailable'),{feedCode:'upstream_'+response.status});
    const reader=response.body.getReader();let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw Error('Feed oversized')}chunks.push(value)}}finally{reader.releaseLock()}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    const data={channelId:CHANNEL_ID,sourceUrl:SOURCE,fetchedAt:new Date(now()).toISOString(),feedLimit:15,videos:parsePublicFeed(new TextDecoder().decode(bytes))};
    memory=data;if(cache)try{await cache.put(key,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}}))}catch{}
    return data;
   }catch(error){retryAfter=now()+60000;throw error}finally{clearTimeout(timeout)}
  })();try{return await pending}finally{pending=null}
 }
 return async function handle(request,ctx={}){
  const url=new URL(request.url);if(url.pathname!==FEED_PATH)return null;
  const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
  const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers});
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if(url.search)return reply({error:'Unexpected query'},400);
  const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return reply({error:'Origin'},403);
  let stored=memory;if(!stored&&cache)try{const response=await cache.match(key);if(response)stored=await response.json()}catch{}
  const age=stored?now()-Date.parse(stored.fetchedAt):Infinity;
  if(stored&&stored.channelId===CHANNEL_ID&&age>=0&&age<MAX_STALE){
   memory=stored;
   if(age>=FRESH){const refresh=load().catch(()=>null);if(ctx.waitUntil)ctx.waitUntil(refresh);else void refresh;}
   return reply({...stored,stale:age>=FRESH});
  }
  try{return reply({...await load(),stale:false})}catch(error){return reply({error:'Public YouTube feed temporarily unavailable',reason:error.feedCode||'feed_transport_or_format'},503)}
 };
}
