'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,randomInt,createHmac}=require('node:crypto');
const {Game,R}=require('./engine.cjs');
const avatars=['abuelo','tahur','campeona','novato','rockera','sereno','carmen','rulo','ines','capitan','berta','chispa'];
const root=path.resolve(__dirname,'../docs');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
function createServer({botDelay=1400,disconnectGrace=30000,turnLimit=90000,maxRequests=60,allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)}={}){
  const rooms=new Map(),sessions=new Map(),limits=new Map();
  const origins=new Set(allowedOrigins.map(origin=>new URL(origin.trim()).origin));
  const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  function session(req){const header=req.headers.authorization;const token=header?.startsWith('Bearer ')?header.slice(7):(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tecnimus_sid='))?.slice(13);return sessions.get(token);}
  function originAllowed(origin,req){return !origin||new URL(origin).host===req.headers.host||origins.has(origin);}
  function voiceConfig(s){
    const iceServers=[{urls:(process.env.STUN_URLS||'stun:stun.l.google.com:19302').split(',').filter(Boolean)}];
    const urls=(process.env.TURN_URLS||'').split(',').filter(Boolean);
    if(urls.length&&process.env.TURN_SECRET){const username=Math.floor(Date.now()/1000+3600)+':'+s.token.slice(0,12);const credential=createHmac('sha1',process.env.TURN_SECRET).update(username).digest('base64');iceServers.push({urls,username,credential});}
    return {iceServers,relayConfigured:iceServers.length>1};
  }
  function cookie(req,res,token){const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';res.setHeader('Set-Cookie',`tecnimus_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure?'; Secure':''}`);}
  function profile(data){if(typeof data.name!=='string')throw Error('Escribe tu nombre.');const name=data.name.trim();if(!name||[...name].length>20||/[\x00-\x1f\x7f]/.test(name))throw Error('El nombre debe tener entre 1 y 20 caracteres.');if(!avatars.includes(data.avatar))throw Error('Elige un avatar.');return {name,avatar:data.avatar};}
  function view(room,s){return {code:room.code,you:s.seat,host:room.host,revision:room.revision,turnLimit,disconnectGrace,
    players:R.ids.map(id=>{const p=room.players[id];return p?{id,name:p.name,avatar:p.avatar,bot:p.bot,connected:p.bot||!!p.session?.stream,voice:p.session?.voice?.enabled||false,muted:p.session?.voice?.muted??true,voiceGeneration:p.session?.voice?.generation||0}:null;}),
    game:room.game?.view(s.seat)||null};}
  function send(room,s){if(s.stream&&!s.stream.destroyed){const ok=s.stream.write(`data: ${JSON.stringify(view(room,s))}\n\n`);if(!ok)s.stream.end();}}
  function broadcast(room){
    if(room.game)for(const signal of Object.values(room.game.signals))if(room.players[signal.to]?.bot)signal.seen=true;
    room.revision++;room.lastActive=Date.now();for(const s of sessions.values())if(s.room===room.code)send(room,s);
  }
  function addSession(req,res,room,seat,p){const token=randomBytes(32).toString('hex'),s={token,room:room.code,seat,stream:null,lastSeen:Date.now(),voice:{enabled:false,muted:true,generation:0}};sessions.set(token,s);room.players[seat]={...p,bot:false,session:s};cookie(req,res,token);broadcast(room);return s;}
  function detach(s){const room=rooms.get(s.room);if(!room)return;const p=room.players[s.seat];if(s.stream){s.stream.end();s.stream=null;}sessions.delete(s.token);
    if(room.game){room.players[s.seat]={name:p.name+' · bot',avatar:p.avatar,bot:true};}else room.players[s.seat]=null;
    if(room.host===s.seat)room.host=R.ids.find(id=>room.players[id]&&!room.players[id].bot)||null;
    if(!room.host){rooms.delete(room.code);}else broadcast(room);
  }
  async function body(req){let size=0,text='';for await(const chunk of req){size+=chunk.length;if(size>65536)throw Error('Petición demasiado grande.');text+=chunk;}try{return JSON.parse(text||'{}');}catch{throw Error('Petición no válida.');}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    // Inline styles are used only for card pip coordinates; script stays external.
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'");
    res.setHeader('Permissions-Policy','camera=(), microphone=(self)');
    try{
      const url=new URL(req.url,'http://localhost');
      const origin=req.headers.origin;
      if((url.pathname.startsWith('/api/')||url.pathname==='/health')&&origin){
        if(!originAllowed(origin,req)){json(res,403,{error:'El servidor no permite esta dirección web.'});return;}
        res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
      }
      if(req.method==='OPTIONS'&&url.pathname.startsWith('/api/')){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});res.end();return;}
      if(url.pathname==='/health'){json(res,200,{ok:true});return;}
      if(url.pathname.startsWith('/api/')){
        const s=session(req),room=s&&rooms.get(s.room);
        if(req.method==='GET'&&url.pathname==='/api/voice-config'){if(!room){json(res,401,{error:'Entra primero en una mesa.'});return;}json(res,200,voiceConfig(s));return;}
        if(req.method==='GET'&&url.pathname==='/api/state'){if(!room){json(res,401,{error:'No tienes una mesa abierta.'});return;}s.lastSeen=Date.now();json(res,200,view(room,s));return;}
        if(req.method==='GET'&&url.pathname==='/api/events'){
          if(!room){json(res,401,{error:'La sala ya no está disponible.'});return;}
          if(s.stream)s.stream.end();s.stream=res;s.lastSeen=Date.now();
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
          res.write('retry: 1500\n\n');broadcast(room);
          res.on('close',()=>{if(s.stream===res){s.stream=null;s.lastSeen=Date.now();if(s.voice.enabled){s.voice.enabled=false;s.voice.muted=true;s.voice.generation++;}broadcast(room);}});return;
        }
        if(req.method!=='POST'){json(res,405,{error:'Método no válido.'});return;}
        if(!originAllowed(req.headers.origin,req)){json(res,403,{error:'Origen no permitido.'});return;}
        if(!String(req.headers['content-type']||'').startsWith('application/json')){json(res,415,{error:'Usa JSON.'});return;}
        const ip=req.socket.remoteAddress,key=(s?s.token:ip)+(url.pathname==='/api/voice-signal'?':voice':'');const now=Date.now();let bucket=limits.get(key);if(!bucket||now-bucket.at>10000){bucket={at:now,n:0};limits.set(key,bucket);}if(++bucket.n>(url.pathname==='/api/voice-signal'?240:maxRequests)){json(res,429,{error:'Demasiadas acciones. Espera unos segundos.'});return;}
        const data=await body(req);
        if(url.pathname==='/api/create'){
          if(room)throw Error('Sal primero de tu mesa actual.');if(rooms.size>=200)throw Error('Hay muchas mesas abiertas. Inténtalo más tarde.');
          const p=profile(data);let code;do{code='MUS-'+randomInt(100000,1000000);}while(rooms.has(code));
          const created={code,host:R.ids[0],players:Object.fromEntries(R.ids.map(id=>[id,null])),game:null,revision:0,lastActive:now};rooms.set(code,created);
          const ss=addSession(req,res,created,R.ids[0],p);json(res,201,{...view(created,ss),sessionToken:ss.token});return;
        }
        if(url.pathname==='/api/join'){
          if(room)throw Error('Sal primero de tu mesa actual.');const code=String(data.code||'').trim().toUpperCase(),target=rooms.get(code);if(!target)throw Error('No existe esa sala. Revisa el código.');if(target.game)throw Error('Esa partida ya ha comenzado.');
          const p=profile(data),available=R.ids.filter(id=>!target.players[id]);if(!available.length)throw Error('La mesa ya tiene cuatro jugadores.');
          const seat=data.seat&&available.includes(data.seat)?data.seat:available[0];const ss=addSession(req,res,target,seat,p);json(res,200,{...view(target,ss),sessionToken:ss.token});return;
        }
        if(!room){json(res,401,{error:'La sala ha cerrado. Vuelve a entrar.'});return;}
        s.lastSeen=now;
        if(url.pathname==='/api/voice-mode'){
          if(typeof data.enabled!=='boolean'||typeof data.muted!=='boolean')throw Error('Estado de voz no válido.');
          if(data.enabled&&!s.stream)throw Error('Espera a recuperar la conexión antes de activar la voz.');
          if(s.voice.enabled!==data.enabled)s.voice.generation++;
          s.voice.enabled=data.enabled;s.voice.muted=!data.enabled||data.muted;broadcast(room);json(res,200,view(room,s));return;
        }
        if(url.pathname==='/api/voice-signal'){
          const target=room.players[data.to]?.session;
          if(!s.voice.enabled||!s.stream||!target?.voice.enabled||!target.stream||data.to===s.seat)throw Error('Ese jugador no está conectado al chat de voz.');
          if(data.targetGeneration!==target.voice.generation||data.generation!==s.voice.generation)throw Error('La conexión de voz ha cambiado.');
          const payload={from:s.seat,generation:s.voice.generation,targetGeneration:target.voice.generation};
          if(data.description){const d=data.description;if(!['offer','answer'].includes(d.type)||typeof d.sdp!=='string'||d.sdp.length>32768)throw Error('Descripción de voz no válida.');payload.description={type:d.type,sdp:d.sdp};}
          else if(data.candidate!==undefined){const c=data.candidate;if(c!==null&&(typeof c.candidate!=='string'||c.candidate.length>4096||!(c.sdpMid===null||c.sdpMid===undefined||typeof c.sdpMid==='string')||!(c.sdpMLineIndex===null||c.sdpMLineIndex===undefined||Number.isInteger(c.sdpMLineIndex))))throw Error('Candidato de voz no válido.');payload.candidate=c===null?null:{candidate:c.candidate,sdpMid:c.sdpMid??null,sdpMLineIndex:c.sdpMLineIndex??null,usernameFragment:typeof c.usernameFragment==='string'?c.usernameFragment:undefined};}
          else throw Error('Mensaje de voz vacío.');
          target.stream.write('event: voice-signal\ndata: '+JSON.stringify(payload)+'\n\n');json(res,200,{ok:true});return;
        }
        if(url.pathname==='/api/leave'){detach(s);cookie(req,res,'');json(res,200,{ok:true});return;}
        if(url.pathname==='/api/start'){
          if(s.seat!==room.host)throw Error('Sólo quien creó la sala puede iniciar.');if(room.game)throw Error('La partida ya ha empezado.');
          R.ids.forEach((id,i)=>{if(!room.players[id])room.players[id]={name:['Don Mus','Paco Farol','Lola Envido','Nico'][i],avatar:avatars[i],bot:true};});room.game=new Game();
        }else if(url.pathname==='/api/next'){
          if(!room.game||room.game.stage!=='summary')throw Error('Todavía no terminó la mano.');if(data.revision!==room.revision)throw Error('La mesa ha cambiado. Vuelve a intentarlo.');room.game.freshHand();
        }else if(url.pathname==='/api/rematch'){
          if(s.seat!==room.host||room.game?.stage!=='finished')throw Error('La revancha la inicia el anfitrión al acabar.');room.game=new Game();
        }else if(url.pathname==='/api/action'){
          if(!room.game)throw Error('Todavía no empezó la partida.');if(!['signal','ack','detect'].includes(data.action)&&data.revision!==room.revision)throw Error('La mesa ha cambiado. Vuelve a intentarlo.');room.game.act(s.seat,data.action,data);
        }else{json(res,404,{error:'Acción desconocida.'});return;}
        broadcast(room);json(res,200,view(room,s));return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';
      const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404);res.end('No encontrado');return;}
      const stat=await fs.promises.stat(file).catch(()=>null);if(!stat?.isFile()){res.writeHead(404);res.end('No encontrado');return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch(error){if(!res.headersSent)json(res,400,{error:error.message});else res.end();}
  });
  const tick=setInterval(()=>{
    const now=Date.now();for(const room of rooms.values()){
      if(now-room.lastActive>6*60*60*1000){for(const s of sessions.values())if(s.room===room.code){s.stream?.end();sessions.delete(s.token);}rooms.delete(room.code);continue;}
      const g=room.game;if(!g)continue;
      if(['mus','opening','response'].includes(g.stage))for(const signal of Object.values(g.signals)){
        if(signal.caughtBy||now>signal.expires||now-signal.at<650)continue;
        const bot=R.ids.find(id=>room.players[id]?.bot&&R.sides[id]!==R.sides[signal.from]);
        if(bot&&!signal.botChecked){signal.botChecked=true;if(randomInt(5)===0){try{g.detectSignal(bot,signal.id);broadcast(room);}catch{}}}
      }
      if(!g.actor)continue;const p=room.players[g.actor],elapsed=now-g.turnStarted;
      if(p.bot&&elapsed>=700&&['mus','opening','response'].includes(g.stage)&&!(g.handNumber===1&&g.stage==='mus')){
        const attempt=g.actor+':'+g.handNumber+':'+g.phaseIndex+':'+g.stage;
        if(room.botSignalAttempt!==attempt){room.botSignalAttempt=attempt;const available=g.view(g.actor).availableSignals;if(available.length&&randomInt(4)===0){try{g.sendSignal(g.actor,available[0]);broadcast(room);}catch{}}}
      }
      const disconnected=!p.bot&&!p.session?.stream&&now-(p.session?.lastSeen||0)>=disconnectGrace;
      if((p.bot&&elapsed>=botDelay)||(disconnected&&elapsed>=botDelay)||elapsed>=turnLimit){try{g.ai();broadcast(room);}catch(error){console.error('No se pudo completar el turno:',error.message);}}
    }
    for(const [key,bucket] of limits)if(now-bucket.at>60000)limits.delete(key);
  },100);
  const heartbeat=setInterval(()=>{for(const s of sessions.values())if(s.stream)s.stream.write(': latido\n\n');},15000);
  server.on('close',()=>{clearInterval(tick);clearInterval(heartbeat);});
  return {server,rooms,sessions,close:async()=>{clearInterval(tick);clearInterval(heartbeat);for(const s of sessions.values())s.stream?.end();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(require.main===module){const {server}=createServer();const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`Tecnimus: http://localhost:${port}\nAbre esa dirección en el navegador. Ctrl+C para cerrar.`));}
module.exports={createServer};
