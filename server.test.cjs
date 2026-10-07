const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../server/index.cjs');
test('cuatro sesiones reales, sala, privacidad, turno, reconexión y revancha',async t=>{
  const app=createServer({botDelay:100000,disconnectGrace:100000,turnLimit:1000000,maxRequests:10000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  const clients=Array.from({length:5},()=>({cookie:''}));
  async function request(c,p,data){const res=await fetch(base+'/api/'+p,{method:data===undefined?'GET':'POST',headers:{Cookie:c.cookie,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});if(res.headers.get('set-cookie'))c.cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,value:await res.json()};}
  let a=await request(clients[0],'create',{name:'Txuwa',avatar:'novato'});assert.equal(a.status,201);const code=a.value.code;assert.match(code,/^MUS-\d{6}$/);
  for(let i=1;i<4;i++){a=await request(clients[i],'join',{code,name:'Jugador '+i,avatar:'campeona'});assert.equal(a.status,200);assert.equal(a.value.players.filter(Boolean).length,i+1);}
  assert.equal((await request(clients[4],'join',{code,name:'Quinto',avatar:'sereno'})).status,400);
  assert.equal((await request(clients[1],'start',{})).status,400);assert.equal((await request(clients[0],'start',{})).status,200);
  const restored=await request(clients[0],'state');assert.equal(restored.value.you,'jugador1');assert.equal(restored.value.game.hands,null);assert.equal(restored.value.game.hand.length,4);
  const attack=await request(clients[1],'action',{revision:restored.value.revision,action:'cut',id:'jugador1'});assert.equal(attack.status,400);
  const cut=await request(clients[0],'action',{revision:restored.value.revision,action:'cut'});assert.equal(cut.status,200);
  const stale=await request(clients[0],'action',{revision:restored.value.revision,action:'pass'});assert.equal(stale.status,400);
  const room=app.rooms.get(code),bySeat={};for(const c of clients.slice(0,4)){const v=(await request(c,'state')).value;bySeat[v.you]=c;}
  let turns=0;while(room.game.stage!=='finished'&&turns++<3000){
    const g=room.game;if(g.stage==='summary'){const v=(await request(clients[0],'state')).value;assert.equal((await request(clients[0],'next',{revision:v.revision})).status,200);continue;}
    const c=bySeat[g.actor],v=(await request(c,'state')).value;
    const data={revision:v.revision,action:g.stage==='mus'?'cut':g.stage==='opening'?'pass':g.stage==='response'?'accept':'discard',indices:[0]};
    const r=await request(c,'action',data);assert.equal(r.status,200,JSON.stringify(r.value));
    if(!r.value.game.revealed&&!['summary','finished'].includes(r.value.game.stage))assert.equal(r.value.game.hands,null);
  }
  assert.equal(room.game.stage,'finished');const scores={...room.game.scores};assert.ok(Object.values(scores).some(n=>n>=40));assert.equal((await request(clients[0],'rematch',{})).status,200);
  assert.equal((await request(clients[0],'state')).value.game.handNumber,1);
  const traversal=await fetch(base+'/server/engine.cjs');assert.equal(traversal.status,404);
  const origin=await fetch(base+'/api/leave',{method:'POST',headers:{Origin:'https://evil.invalid',Cookie:clients[0].cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(origin.status,403);
  assert.equal((await request(clients[0],'leave',{})).status,200);assert.equal(room.players.jugador1.bot,true);assert.equal(room.host,'jugador4');assert.equal((await request(clients[0],'state')).status,401);
});
test('SSE entrega sólo la vista propia y permite volver a conectar',async t=>{
  const app=createServer({botDelay:999999});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  const created=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Astra',avatar:'tahur'})});const cookie=created.headers.get('set-cookie').split(';')[0];await created.json();
  async function connect(){const ac=new AbortController();const res=await fetch(base+'/api/events',{headers:{Cookie:cookie},signal:ac.signal});assert.equal(res.headers.get('content-type'),'text/event-stream');const reader=res.body.getReader();let text='';while(!text.includes('data: '))text+=new TextDecoder().decode((await reader.read()).value);const data=JSON.parse(text.split('data: ')[1].split('\n\n')[0]);assert.equal(data.you,'jugador1');assert.equal(data.players[0].connected,true);ac.abort();await reader.cancel().catch(()=>{});return data.code;}
  const first=await connect();const second=await connect();assert.equal(second,first);
});
test('el bot cubre al desconectado sin quitarle su sesión',async t=>{
  const app=createServer({botDelay:10,disconnectGrace:10,turnLimit:999999});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  const created=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Txuwa',avatar:'novato'})});const cookie=created.headers.get('set-cookie').split(';')[0],v=await created.json();
  await fetch(base+'/api/start',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});const room=app.rooms.get(v.code),version=room.game.version;
  for(let i=0;i<20&&room.game.version===version;i++)await new Promise(r=>setTimeout(r,15));
  assert.ok(room.game.version>version);assert.equal(room.players.jugador1.bot,false);
  const restored=await fetch(base+'/api/state',{headers:{Cookie:cookie}});assert.equal(restored.status,200);assert.equal((await restored.json()).you,'jugador1');
});
test('el servidor limita peticiones repetidas',async t=>{
  const app=createServer({maxRequests:2});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  for(let i=0;i<3;i++){const res=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,i===2?429:400);}
});
