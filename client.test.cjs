const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createServer}=require('../server/index.cjs');
// A small DOM harness exercises the actual client scripts and HTTP/SSE flows.
// It does not replace a browser layout, sound or physical-device check.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.className='';this.textContent='';this.onclick=null;
    this.classList={add:(...values)=>{this.className=[...new Set(this.className.split(' ').concat(values))].join(' ');},toggle:(value,on)=>{const values=new Set(this.className.split(' '));on?values.add(value):values.delete(value);this.className=[...values].join(' ');}};}
  set innerHTML(value){this._html=value;this.children=[];}
  get innerHTML(){return this._html||'';}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(key,value){this.attributes[key]=String(value);}
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(10);}assert.fail('El cliente no llegó al estado esperado.');}
test('cliente real: elegir avatar, crear, unirse, mesa privada y cortar mus',async t=>{
  const app=createServer({botDelay:999999,disconnectGrace:999999,turnLimit:999999});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  const ids=[...fs.readFileSync('docs/index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  function client(){
    const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements['seat-choice'].value='jugador3';let cookie='',sources=[],timers=[];const storage=new Map();
    const document={getElementById:id=>{assert.ok(elements[id],'ID presente: '+id);return elements[id];},createElement:tag=>new Element(tag),addEventListener:()=>{}};
    async function clientFetch(url,options={}){const response=await fetch(new URL(url,base),{...options,headers:{...options.headers,Cookie:cookie}});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;}
    const context=vm.createContext({document,window:{addEventListener:(event,fn)=>{if(event==='pagehide')sources.push({close:fn});}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{href:base,protocol:'http:',search:''},URL,URLSearchParams,fetch:clientFetch,AbortController,TextDecoder,setTimeout,clearTimeout,clearInterval,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>true,setInterval:(fn,ms)=>{const timer=setInterval(fn,ms);timers.push(timer);return timer;},console,Set,Date});
    for(const file of ['config.js','connection.js','mus-rules.js','avatars.js','voice.js','online.js'])vm.runInContext(fs.readFileSync('docs/'+file,'utf8'),context,{filename:file});
    t.after(()=>{sources.forEach(s=>s.close());timers.forEach(clearInterval);});return {elements,context};
  }
  const a=client(),b=client(),c=client();await until(()=>!a.elements.create.disabled&&!b.elements.create.disabled&&!c.elements.create.disabled);
  a.elements.nickname.value='Txuwa';a.elements['avatar-picker'].children[2].onclick();assert.equal(a.elements['avatar-picker'].children[2].attributes['aria-pressed'],'true');
  await a.elements.create.onclick();await until(()=>!a.elements.start.disabled);const code=a.elements.code.textContent;assert.match(code,/MUS-\d{6}/);
  b.elements.nickname.value='Borja';b.elements['room-code'].value=code;await b.elements.join.onclick();await until(()=>b.elements.roster.children.length===4);assert.equal(b.elements.start.disabled,true);
  c.elements.nickname.value='Rival';c.elements['room-code'].value=code;await c.elements.join.onclick();
  await a.elements.start.onclick();await until(()=>a.elements.game.hidden===false&&b.elements.game.hidden===false);
  assert.equal(a.elements['seat-bottom'].children[2].children.length,4);assert.equal(b.elements['seat-bottom'].children[2].children.length,4);
  assert.equal(a.elements['seat-top'].children[2].children[0].attributes['aria-label'],'Carta boca abajo');
  const ownCard=a.elements['seat-bottom'].children[2].children[0];assert.equal(ownCard.tagName,'button');ownCard.onclick();assert.match(a.elements.controls.children[0].textContent,/Dar mus · 1/);
  app.rooms.get(code).game.hands.jugador1=[12,12,12,1].map((numero,i)=>({numero,palo:['Oros','Copas','Espadas','Bastos'][i]}));
  a.elements.controls.children.find(c=>c.textContent==='Corto mus').onclick();await until(()=>a.elements['phase-caption'].textContent==='Grande');
  a.elements['signal-toolbar'].children.find(n=>n.textContent==='Señas').onclick();
  a.elements['signal-toolbar'].children.find(n=>n.textContent==='Medias de reyes').onclick();
  await until(()=>b.elements['signal-toolbar'].children.some(n=>n.textContent==='Socio: Medias de reyes'));
  await until(()=>c.elements['seat-left'].children[0].children[0].dataset.motion==='side-mouth');
  c.elements['seat-left'].children[0].children[0].onclick();
  await until(()=>c.elements['signal-toolbar'].children.some(n=>n.textContent==='Seña cazada a Txuwa: Medias de reyes'));
  await until(()=>a.elements['signal-toolbar'].children.some(n=>n.textContent==='¡Rival os ha pillado la seña!'));
  assert.equal(a.elements.controls.children.some(c=>c.textContent==='Envido'),true);assert.equal(b.elements.controls.children.length,0);
  a.elements.controls.children.find(c=>c.textContent==='Envido').onclick();await until(()=>a.elements['stake-chip'].textContent==='2 piedras en juego');assert.equal(b.elements['stake-chip'].textContent,'2 piedras en juego');
});
