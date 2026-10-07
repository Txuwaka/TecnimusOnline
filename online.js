'use strict';
(()=>{
  const $=id=>document.getElementById(id),R=MusRules;
  const phaseName={GRANDE:'Grande',CHICA:'Chica',PARES:'Pares',JUEGO:'Juego',PUNTO:'Punto'};
  const signalNames={reyes:'Dos reyes',ases:'Dos ases','medias-reyes':'Medias de reyes','medias-ases':'Medias de ases',medias:'Medias',duples:'Duples','31':'Treinta y una',juego:'Juego','30':'Treinta al punto','29':'Veintinueve',ciego:'Ciego'};
  let avatar='novato',state=null,stream=null,connected=false,busy=false,selected=new Set(),handKey='',amount=2,signalOpen=false,sound=true,audio=null,lastSoundKey='',serverReady=false,voice=null;
  const query=new URLSearchParams(location.search);
  let serverUrl=window.TECNIMUS_CONFIG?.serverUrl||'';
  try{serverUrl=localStorage.getItem('tecnimus-server')||serverUrl;}catch{}
  serverUrl=query.get('servidor')||serverUrl;
  let connection;try{connection=TecniConnection.create({serverUrl});}catch{serverUrl='';connection=TecniConnection.create();}
  $('server-url').value=serverUrl;
  try{avatar=localStorage.getItem('tecnimus-avatar')||avatar;$('nickname').value=localStorage.getItem('tecnimus-nickname')||'';sound=localStorage.getItem('tecnimus-sonido')!=='off';}catch{}
  function saveProfile(){try{localStorage.setItem('tecnimus-avatar',avatar);localStorage.setItem('tecnimus-nickname',$('nickname').value.trim());}catch{}}
  function picker(){TecniAvatars.picker($('avatar-picker'),avatar,id=>{avatar=id;picker();saveProfile();});}
  picker();$('hero-cast').innerHTML=['abuelo','campeona','tahur','novato'].map(id=>TecniAvatars.svg(id)).join('');
  $('room-code').value=query.get('sala')||'';
  function soundLabel(){$('sound').textContent='Sonido '+(sound?'ON':'OFF');$('sound').setAttribute('aria-pressed',String(sound));}soundLabel();
  function unlock(){if(!sound)return;try{audio||=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
  function play(kind){if(!sound||audio?.state!=='running')return;const notes={bet:[440,587],raise:[392,523,784],ordago:[110,165,220,440],cards:[330,220],accept:[523,659],decline:[330,220],signal:[780,940],win:[523,659,784,1046],lose:[440,349,294],turn:[660],tap:[510]}[kind]||[510];notes.forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09;o.frequency.value=f;o.type='triangle';g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.15);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.17);o.onended=()=>{o.disconnect();g.disconnect();};});}
  $('sound').onclick=()=>{sound=!sound;try{localStorage.setItem('tecnimus-sonido',sound?'on':'off');}catch{}soundLabel();unlock();play('tap');};
  const api=(endpoint,data)=>connection.api(endpoint,data);
  function setState(next){
    if(state?.code===next.code&&next.revision<state.revision)return;
    const key=next.game?next.game.handNumber+JSON.stringify(next.game.hand):'';
    if(key!==handKey){selected=new Set(next.game?.selected||[]);handKey=key;}
    const old=state;state=next;
    const g=next.game,soundKey=g?g.handNumber+':'+g.history.length+':'+g.stage+':'+g.phase:'';
    if(g&&soundKey!==lastSoundKey){const call=g.history.at(-1)?.call||'';if(g.stage==='finished')play(g.winningSide===R.sides[next.you]?'win':'lose');else if(!old?.game||old.game.handNumber!==g.handNumber)play('cards');else if(call.includes('ÓRDAGO'))play('ordago');else if(call.includes('REENVIDO'))play('raise');else if(call.includes('ENVIDO'))play('bet');else if(call==='QUIERO')play('accept');else if(call==='NO QUIERO')play('decline');else if(g.actor===next.you&&old?.game?.actor!==g.actor)play('turn');lastSoundKey=soundKey;}
    voice?.update(state);render();
  }
  function connect(){stream?.close();stream=connection.stream({onopen:()=>{connected=true;$('connection').textContent='● Conectado';render();},onstate:next=>{connected=true;setState(next);},onvoice:message=>voice?.receive(message),onerror:()=>{connected=false;voice?.suspend();$('connection').textContent='Reconectando…';render();}});}
  async function perform(endpoint,data){if(busy)return;busy=true;$('action-error').textContent='';$('room-error').textContent='';render();try{setState(await api(endpoint,{...data,revision:state?.revision}));}catch(e){$('action-error').textContent=e.message;$('room-error').textContent=e.message;try{setState(await api('state'));}catch{}}finally{busy=false;render();}}
  async function enter(endpoint){if(busy||!serverReady)return;busy=true;$('welcome-error').textContent='';$('create').disabled=$('join').disabled=true;saveProfile();try{const next=await api(endpoint,{name:$('nickname').value,avatar,code:$('room-code').value,seat:$('seat-choice').value});setState(next);connect();play('tap');}catch(e){$('welcome-error').textContent=e.message;}finally{busy=false;$('create').disabled=$('join').disabled=!serverReady;}}
  $('create').onclick=()=>enter('create');$('join').onclick=()=>enter('join');$('nickname').onchange=saveProfile;
  $('start').onclick=()=>perform('start');
  $('copy-code').onclick=async()=>{if(!state)return;const invite=new URL(location.href);invite.search='';invite.searchParams.set('sala',state.code);if(connection.base!==location.origin)invite.searchParams.set('servidor',connection.base);try{await navigator.clipboard.writeText(invite.href);$('copy-code').textContent='¡Invitación copiada!';}catch{$('room-error').textContent='Código de la mesa: '+state.code;} };
  $('leave').onclick=async()=>{if(state?.game&&!confirm('¿Salir de la mesa? Un bot ocupará tu asiento y no podrás recuperarlo.'))return;try{await voice?.disable();await api('leave',{});stream?.close();connection.clear();state=null;selected.clear();handKey='';connected=false;$('connection').textContent='Mesa disponible';render();}catch(e){$('room-error').textContent=e.message;}};
  function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn,cls='secondary',disabled=false){const b=node('button',text,'button '+cls);b.type='button';b.disabled=disabled||busy||!connected;b.onclick=fn;return b;}
  const pipPositions={1:[[50,50]],2:[[50,22],[50,78]],3:[[50,18],[50,50],[50,82]],4:[[22,18],[78,18],[22,82],[78,82]],5:[[22,18],[78,18],[50,50],[22,82],[78,82]],6:[[22,18],[78,18],[22,50],[78,50],[22,82],[78,82]],7:[[22,18],[78,18],[22,40],[78,40],[50,62],[22,82],[78,82]]};
  const suits={Oros:'oros',Copas:'copas',Espadas:'espadas',Bastos:'bastos'},figures={10:'sota.png',11:'caballo.png',12:'rey.jpg'};
  function image(src,cls){const img=node('img',undefined,cls);img.src=src;img.alt='';img.draggable=false;return img;}
  function card(c,i,own,g){
    const choose=own&&g.actor===state.you&&['mus','discard'].includes(g.stage)&&connected;
    const n=node(choose?'button':'div',undefined,'card'+(!c?' back':' '+({Oros:'gold',Copas:'red',Espadas:'blue',Bastos:'green'}[c.palo]))+(own&&selected.has(i)?' selected':''));
    if(!c){n.setAttribute('aria-label','Carta boca abajo');return n;}
    n.setAttribute('aria-label',c.numero+' de '+c.palo);n.append(node('span',String(c.numero),'corner'));
    if(figures[c.numero]){n.classList.add('figure','figure-'+c.numero);const f=node('span',undefined,'figure-art');f.append(image('assets/'+figures[c.numero],'figure-image'));n.append(f);}
    else{const field=node('span',undefined,'pip-field');for(const [x,y] of pipPositions[c.numero]){const pip=node('span',undefined,'pip');pip.style.left=x+'%';pip.style.top=y+'%';pip.append(image('assets/'+suits[c.palo]+'.png','suit-image'));field.append(pip);}n.append(field);}
    n.append(node('span',c.palo,'card-name'),node('span',String(c.numero),'corner bottom'));
    if(choose){n.type='button';n.disabled=busy;n.setAttribute('aria-pressed',String(selected.has(i)));n.onclick=()=>{selected.has(i)?selected.delete(i):selected.add(i);play('tap');renderGame();};}
    return n;
  }
  function render(){
    $('welcome').hidden=!!state;$('room').hidden=!state;renderVoice();if(!state)return;
    $('code').textContent=state.code;$('lobby').hidden=!!state.game;$('game').hidden=!state.game;
    if(state.game){renderGame();return;}
    const roster=$('roster');roster.replaceChildren();
    for(const id of ['jugador1','jugador3','jugador4','jugador2']){
      const p=state.players.find(p=>p?.id===id),c=node('div',undefined,'roster-card');const a=node('div');a.innerHTML=TecniAvatars.svg(p?.avatar||'sereno');c.append(a);
      const label=node('div');label.append(node('strong',p?p.name+(id===state.you?' · tú':''):'Silla libre'),node('small',(R.sides[id]==='nosotros'?'Equipo A':'Equipo B')+' · '+(p?p.connected?'conectado':'conectando':'entrará un bot')));c.append(label);roster.append(c);
    }
    $('start').disabled=state.host!==state.you||busy||!connected;$('host-note').textContent=state.host===state.you?'Cuando quieras, empezamos. Los sitios vacíos se completarán con bots.':'Esperando a que el anfitrión comience.';
  }
  function renderGame(){
    const g=state.game,you=state.you,ownSide=R.sides[you],other=ownSide==='nosotros'?'ellos':'nosotros';
    $('ours').textContent=g.scores[ownSide];$('theirs').textContent=g.scores[other];$('hand-caption').textContent='MANO '+g.handNumber+' · '+playerName(g.mano);$('phase-caption').textContent=['mus','discard'].includes(g.stage)?g.stage==='mus'?'Mus':'Descartes':phaseName[g.phase]||'Resultados';
    $('center-title').textContent=g.stage==='finished'?(g.winningSide===ownSide?'¡Ganamos!':'Nos han pillado'):g.stage==='summary'?'Cartas vistas':g.stage==='discard'?'Al montón':g.stage==='mus'?'¿Hay mus?':phaseName[g.phase]||'';
    $('center-subtitle').textContent=g.actor?'Habla '+playerName(g.actor):'Cuarenta piedras, mucha historia';$('stake-chip').hidden=!g.offer;$('stake-chip').textContent=g.offer?g.offer.ordago?'¡ÓRDAGO!':g.offer.amount+' piedras en juego':'';
    const index=R.ids.indexOf(you),positions=['seat-bottom','seat-right','seat-top','seat-left'];
    for(let offset=0;offset<4;offset++){
      const id=R.ids[(index+offset)%4],p=state.players.find(p=>p?.id===id),box=$(positions[offset]);box.replaceChildren();box.classList.toggle('is-active',g.actor===id);
      const name=node('div',undefined,'online-name'),a=node('span',undefined,'comic-avatar');const signal=(g.publicSignals||[]).find(s=>s.from===id&&Date.now()<=s.expires);
      a.innerHTML=TecniAvatars.svg(p.avatar,g.stage==='finished'?R.sides[id]===g.winningSide?'wink':'lose':TecniAvatars.mood(g.calls[id]),signal?.motion||'');
      const rival=R.sides[id]!==ownSide,catchable=rival&&signal&&!signal.caught;
      const avatarButton=node('button',undefined,'detect-avatar'+(catchable?' is-catchable':''));avatarButton.type='button';avatarButton.setAttribute('aria-label',rival?'Detectar una seña de '+p.name:p.name);avatarButton.disabled=!rival||!connected||busy;avatarButton.dataset.motion=signal?.motion||'';avatarButton.append(a);
      if(signal){const gestures={wink:'Guiño',brows:'Cejas',tongue:'Lengua',bite:'Labio','side-mouth':'Boca al lado','side-tongue':'Lengua al lado',kiss:'Labios',shrug:'Hombros','one-shoulder':'Un hombro',closed:'Ojos cerrados'};avatarButton.append(node('span',gestures[signal.motion]||'Gesto','gesture-label'));}
      avatarButton.onclick=()=>{if(!catchable||Date.now()>signal.expires){$('action-error').textContent='No has pillado ningún gesto. Mira el avatar cuando haga una seña.';return;}action('detect',{signalId:signal.id});};
      const labels=node('div');labels.append(node('strong',id===you?p.name+' · tú':p.name));let tags=[];if(g.mano===id)tags.push('MANO');if(p.bot)tags.push('BOT');else if(!p.connected)tags.push('SIN CONEXIÓN');if(p.voice)tags.push(p.muted?'MIC SILENCIADO':'VOZ');if(g.declarations?.[id])tags.push(g.declarations[id].pairs?'PARES':'SIN PARES');if(g.declarations?.[id]?.game!==undefined)tags.push(g.declarations[id].game?'JUEGO':'SIN JUEGO');labels.append(node('small',tags.join(' · ')));name.append(avatarButton,labels);box.append(name,node('span',g.calls[id]||'','call'));
      const cards=node('div',undefined,'cards');const hand=id===you?g.hand:g.hands?.[id]||[null,null,null,null];hand.forEach((c,i)=>cards.append(card(c,i,id===you,g)));box.append(cards);
    }
    $('turn-label').textContent=!connected?'RECUPERANDO CONEXIÓN':g.actor===you?'TU TURNO':g.actor?'TURNO DE '+playerName(g.actor).toUpperCase():'MANO RESUELTA';
    $('prompt').textContent=g.stage==='finished'?(g.winningSide===ownSide?'¡La timba es vuestra!':'Otra vez será. Pide revancha.'):g.stage==='summary'?'Cartas sobre la mesa.':g.actor!==you?'Esperando a '+playerName(g.actor)+'…':g.stage==='mus'?'Selecciona cartas para dar mus, o corta.':g.stage==='discard'?'Elige qué cartas cambias.':g.stage==='response'?'¿Queremos el '+(g.offer.ordago?'órdago':g.offer.amount+' de piedras')+'?':'Hablas en '+phaseName[g.phase]+'.';
    controls(g);renderSignals(g);clock();
    const history=$('history');history.replaceChildren();for(const row of g.history)history.append(node('li',(row.id?playerName(row.id)+': ':'')+row.call));
    const results=$('results');results.hidden=!['summary','finished'].includes(g.stage);results.replaceChildren();if(!results.hidden){results.append(node('h2',g.stage==='finished'?'Partida terminada':'Resumen de la mano'));for(const row of g.result)results.append(node('p',phaseName[row.phase]+' · '+(row.status==='refused'?'Envite no querido':playerName(row.winner))+' · '+(row.side===ownSide?'tu equipo':'rivales')+' +'+row.points));}
  }
  function playerName(id){return state?.players.find(p=>p?.id===id)?.name||'la mesa';}
  function action(action,data={}){perform('action',{action,...data});}
  function controls(g){
    const c=$('controls');c.replaceChildren();if(g.stage==='summary'){c.append(button('Siguiente mano →',()=>perform('next'),'primary'));return;}
    if(g.stage==='finished'){if(state.host===state.you)c.append(button('¡Revancha!',()=>perform('rematch'),'primary'));else c.append(node('p','El anfitrión puede abrir la revancha.','fine'));return;}
    if(g.actor!==state.you)return;
    if(g.stage==='mus'||g.stage==='discard'){
      c.append(button((g.stage==='mus'?'Dar mus':'Descartar')+' · '+selected.size,()=>action(g.stage==='mus'?'mus':'discard',{indices:[...selected]}),'primary',!selected.size));
      if(g.stage==='mus')c.append(button('Corto mus',()=>action('cut')));return;
    }
    if(!g.offer?.ordago){const l=node('label',g.stage==='response'?'Añado':'Piedras');l.htmlFor='amount';const input=node('input');input.type='number';input.id='amount';input.inputMode='numeric';input.min=g.stage==='response'?'1':'2';input.step='1';input.value=amount;input.disabled=busy||!connected;input.oninput=()=>amount=Number(input.value);c.append(l,input);}
    if(g.stage==='opening'){c.append(button('Paso',()=>action('pass')),button('Envido',()=>action('bet',{amount}),'primary'),button('Órdago',()=>action('ordago'),'dramatic'));}
    else if(g.stage==='response'){c.append(button('Quiero',()=>action('accept'),'primary'));if(!g.offer.ordago)c.append(button('Subo',()=>action('raise',{amount})),button('Órdago',()=>action('ordago'),'dramatic'));c.append(button('No quiero',()=>action('decline')));}
  }
  function renderSignals(g){const c=$('signal-toolbar');c.replaceChildren();const incoming=g.signals.find(s=>s.to===state.you),outgoing=g.signals.find(s=>s.from===state.you);
    c.append(button('Señas',()=>{signalOpen=!signalOpen;renderSignals(g);},'secondary',!g.availableSignals.length));
    if(signalOpen)for(const key of g.availableSignals)c.append(button(signalNames[key],()=>{signalOpen=false;play('signal');action('signal',{key});}));
    if(outgoing)c.append(node('span',(outgoing.seen?'Socio la ha visto: ':'Enviada: ')+signalNames[outgoing.key]));
    if(outgoing?.caughtBy)c.append(node('span','¡'+playerName(outgoing.caughtBy)+' os ha pillado la seña!','caught-note'));
    if(incoming&&!incoming.seen){c.append(node('strong','Socio: '+signalNames[incoming.key]),button('Visto',()=>action('ack',{signalId:incoming.id}),'primary'));}
    const caught=(g.observations||[]).at(-1);if(caught)c.append(node('span','Seña cazada a '+playerName(caught.from)+': '+signalNames[caught.key],'seen-note'));
  }
  function clock(){if(!state?.game)return;const g=state.game;if(!g.actor){$('turn-clock').textContent='';return;}const p=state.players.find(p=>p?.id===g.actor);$('turn-clock').textContent=p?.bot?'El bot está pensando…':'Tiempo de turno: '+Math.max(0,Math.ceil((state.turnLimit-(Date.now()-g.turnStarted))/1000))+' s · Un bot cubre el turno si se agota.';}
  setInterval(clock,1000);
  let gestureKey='';setInterval(()=>{if(!state?.game)return;const key=(state.game.publicSignals||[]).filter(s=>Date.now()<=s.expires).map(s=>s.id).join(',');if(key!==gestureKey){gestureKey=key;renderGame();}},150);
  function renderVoice(){if(!voice)return;$('voice-enable').textContent=voice.busy?'Preparando voz…':voice.enabled?'Apagar voz':'Activar voz';$('voice-enable').disabled=voice.busy||!connected;
    $('voice-mute').hidden=$('voice-listen').hidden=!voice.enabled;$('voice-mute').disabled=voice.busy;$('voice-mute').textContent=voice.muted?'Activar micrófono':'Silenciar micrófono';$('voice-mute').setAttribute('aria-pressed',String(voice.muted));$('voice-listen').textContent=voice.deafened?'Activar escucha':'Silenciar escucha';$('voice-listen').setAttribute('aria-pressed',String(voice.deafened));
    const peers=[...voice.peers.values()];$('voice-play').hidden=!peers.some(p=>p.blocked);$('voice-status').textContent=voice.error||(!voice.enabled?'Voz apagada. El micrófono sólo se activa cuando tú lo pides.':voice.muted?'Micrófono silenciado.':peers.length?'Voz activada · '+peers.filter(p=>p.status==='connected').length+' de '+peers.length+' conexiones listas.':'Voz activada. Esperando a que otro jugador se conecte.');
    const box=$('voice-peers');box.replaceChildren();for(const peer of peers)box.append(node('span',playerName(peer.id)+' · '+(peer.blocked?'pulsa Reproducir voces':peer.status==='connected'?'conectado':peer.status==='failed'?'sin conexión':'conectando'),'voice-peer is-'+peer.status));
  }
  voice=new TecniVoice({api,onstate:setState,onchange:renderVoice});
  $('voice-enable').onclick=()=>voice.enabled?voice.disable():voice.enable();$('voice-mute').onclick=()=>voice.toggleMute();$('voice-listen').onclick=()=>voice.toggleListen();$('voice-play').onclick=()=>voice.resumePlayback();
  window.addEventListener?.('pagehide',()=>{stream?.close();voice.dispose();});
  $('connect-server').onclick=async()=>{if(state)return;try{connection.configure($('server-url').value.trim());try{localStorage.setItem('tecnimus-server',$('server-url').value.trim());}catch{}await init();}catch(e){$('welcome-error').textContent=e.message;}};
  async function init(){
    serverReady=false;$('create').disabled=$('join').disabled=true;$('welcome-error').textContent='';
    if(location.protocol==='file:'){$('connection').textContent='Modo archivo';$('welcome-error').textContent='Para jugar online, inicia Tecnimus con INICIAR-WINDOWS.bat. Puedes entrar en «Jugar solo» ahora mismo.';return;}
    try{await connection.health();serverReady=true;$('connection').textContent='Mesa disponible';$('create').disabled=$('join').disabled=false;$('connection-settings').open=false;
      try{setState(await api('state'));connect();}catch{}
    }catch{$('connection').textContent='Servidor no conectado';$('connection-settings').open=true;$('welcome-error').textContent='Puedes jugar solo ahora. Para la mesa online, conecta la dirección de tu servidor.';}
  }
  init();
})();
