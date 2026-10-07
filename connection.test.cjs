const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('Pages: token por servidor, sin cookies ni credenciales en enlaces, SSE fragmentado',async()=>{
  const saved=new Map(),calls=[],timers=[];
  const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  const chunks=['data: {"you":','"jugador1"}\n\nevent: voice-signal\ndata: {"from":"jugador4"}\n','\n'];
  const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/events'))return {ok:true,body:{getReader:()=>({read:async()=>chunks.length?{value:new TextEncoder().encode(chunks.shift()),done:false}:{done:true}})}};return {ok:true,json:async()=>url.endsWith('/create')?{sessionToken:'private-token',you:'jugador1'}:{ok:true}};};
  const context=vm.createContext({URL,location:{protocol:'https:',origin:'https://txuwa.github.io',href:'https://txuwa.github.io/mus/'},AbortController,TextDecoder,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},fetch:fetcher,sessionStorage:storage});
  vm.runInContext(fs.readFileSync('docs/connection.js','utf8')+'\nglobalThis.Connection=TecniConnection;',context);
  const c=context.Connection.create({serverUrl:'https://mus.example',fetcher,storage});const result=await c.api('create',{});assert.equal(result.sessionToken,undefined);
  await c.api('state');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer private-token');assert.equal(calls.at(-1).options.credentials,'omit');
  const events=[];let finish;const done=new Promise(r=>finish=r);const stream=c.stream({onstate:s=>events.push(s.you),onvoice:s=>{events.push(s.from);finish();}});await done;stream.close();
  assert.deepEqual(events,['jugador1','jugador4']);assert.equal(calls.at(-1).url,'https://mus.example/api/events');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer private-token');
  c.configure('https://other.example');await c.api('state');assert.equal(calls.at(-1).options.headers.Authorization,undefined);
  c.configure('https://mus.example');await c.api('state');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer private-token');
  c.clear();assert.equal(saved.size,0);assert.throws(()=>c.configure('http://mus.example'),/HTTPS/);assert.throws(()=>c.configure('https://name:password@mus.example'),/dirección/);
});
