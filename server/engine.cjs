'use strict';
const R = require('../docs/mus-rules.js');
const {randomInt} = require('node:crypto');
const partner = id => R.ids[(R.ids.indexOf(id)+2)%4];
const side = id => R.sides[id];
const shuffle = cards => {for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;};
class Game {
  constructor(){this.scores={nosotros:0,ellos:0};this.handNumber=0;this.version=0;this.history=[];this.signalSerial=0;this.freshHand();}
  order(){return R.order(this.mano);}
  phase(){return this.phases[this.phaseIndex]||null;}
  log(id,call){this.calls[id]=call;this.history.push({id,call});this.history=this.history.slice(-100);}
  touch(){this.version++;this.turnStarted=Date.now();}
  freshHand(){
    this.handNumber++;this.mano=(this.handNumber-1)%4;this.deck=shuffle(R.deck());this.discard=[];
    this.hands=Object.fromEntries(R.ids.map(id=>[id,[]]));
    for(let i=0;i<4;i++)for(const id of this.order())this.hands[id].push(this.deck.pop());
    this.stage='mus';this.actor=this.order()[0];this.cursor=0;this.phases=[];this.phaseIndex=0;
    this.bets={};this.offer=null;this.calls={};this.history=[];this.musSelections={};this.result=[];
    this.revealed=false;this.winningSide=null;this.signals={};this.signalAt={};this.observations={nosotros:[],ellos:[]};this.discardCounts={};this.touch();
  }
  draw(){if(!this.deck.length)this.deck=shuffle(this.discard.splice(0));return this.deck.pop();}
  amount(n,min,base=0){if(!Number.isSafeInteger(n)||n<min||!Number.isSafeInteger(base+n+80))throw Error('Cantidad de piedras no válida.');return n;}
  act(id,action,data={}){
    if(action==='signal')return this.sendSignal(id,data.key);
    if(action==='ack')return this.ack(id,data.signalId);
    if(action==='detect')return this.detectSignal(id,data.signalId);
    if(this.actor!==id)throw Error('Es el turno de otro jugador.');
    if(this.stage==='mus'){
      if(action==='cut'){this.log(id,'CORTO MUS');this.phases=R.phases(this.hands);this.phaseIndex=0;this.preparePhase();}
      else if(action==='mus'){
        this.musSelections[id]=this.validateDiscard(data.indices);this.log(id,'MUS');this.cursor++;
        if(this.cursor===4){this.stage='discard';this.cursor=0;this.actor=this.order()[0];}
        else this.actor=this.order()[this.cursor];
      }else throw Error('Da mus o corta.');
    }else if(this.stage==='discard'){
      if(action!=='discard')throw Error('Selecciona las cartas que quieras descartar.');
      this.musSelections[id]=this.validateDiscard(data.indices);this.discardCounts[id]=data.indices.length;this.log(id,'DESCARTO '+data.indices.length);this.cursor++;
      if(this.cursor===4){
        for(const seat of this.order())for(const i of this.musSelections[seat])this.discard.push(this.hands[seat][i]);
        for(const seat of this.order())for(const i of this.musSelections[seat])this.hands[seat][i]=this.draw();
        this.signals={};this.observations={nosotros:[],ellos:[]};this.calls={};this.stage='mus';this.cursor=0;this.musSelections={};
      }
      this.actor=this.order()[this.cursor];
    }else if(this.stage==='opening'){
      if(action==='pass'){this.log(id,'PASO');this.cursor++;if(this.cursor===this.speakers.length){this.bets[this.phase()]={status:'passed',amount:0};this.nextPhase();}else this.actor=this.speakers[this.cursor];}
      else if(action==='bet'||action==='ordago'){
        this.offer={side:side(id),amount:action==='ordago'?40:this.amount(data.amount,2),previous:0,ordago:action==='ordago'};
        this.log(id,action==='ordago'?'ÓRDAGO':'ENVIDO '+this.offer.amount);this.beginResponse(id);
      }else throw Error('Pasa, envida o echa órdago.');
    }else if(this.stage==='response'){
      const offer=this.offer;
      if(action==='decline'){
        this.log(id,'NO QUIERO');this.cursor++;
        if(this.cursor===this.speakers.length){
          const points=offer.previous||1;this.scores[offer.side]+=points;
          this.bets[this.phase()]={status:'refused',side:offer.side,amount:0};
          this.history.push({id:null,call:(offer.side==='nosotros'?'Equipo A':'Equipo B')+' cobra '+points});
          if(this.scores[offer.side]>=40)this.finish(offer.side);else this.nextPhase();
        }else this.actor=this.speakers[this.cursor];
      }else if(action==='accept'){
        this.log(id,'QUIERO');this.bets[this.phase()]={status:'accepted',amount:offer.amount};
        if(offer.ordago)this.resolve(true);else this.nextPhase();
      }else if(action==='raise'||action==='ordago'){
        if(offer.ordago)throw Error('Un órdago sólo admite quiero o no quiero.');
        this.offer={side:side(id),amount:action==='ordago'?40:offer.amount+this.amount(data.amount,1,offer.amount),previous:offer.amount,ordago:action==='ordago'};
        this.log(id,action==='ordago'?'ÓRDAGO':'REENVIDO '+this.offer.amount);this.beginResponse(id);
      }else throw Error('Respuesta no válida.');
    }else throw Error('La mano ya está resuelta.');
    this.touch();
  }
  validateDiscard(indices){
    if(!Array.isArray(indices)||indices.length<1||indices.length>4||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>3))throw Error('Selecciona entre una y cuatro cartas distintas.');
    return [...indices];
  }
  beginResponse(id){this.stage='response';this.speakers=this.order().filter(x=>side(x)!==side(id)&&R.qualifies(this.hands[x],this.phase()));this.cursor=0;this.actor=this.speakers[0];}
  nextPhase(){this.phaseIndex++;this.preparePhase();}
  preparePhase(){
    this.offer=null;this.cursor=0;this.calls={};
    while(this.phaseIndex<this.phases.length){
      const f=this.phase();
      if(f==='PARES'||f==='JUEGO'||f==='PUNTO')for(const id of this.order())this.log(id,f==='PARES'?(R.qualifies(this.hands[id],f)?'PARES':'NO PARES'):(R.qualifies(this.hands[id],'JUEGO')?'JUEGO':'NO JUEGO'));
      if(!R.canBet(this.hands,f)){this.bets[f]={status:'automatic',amount:0};this.phaseIndex++;continue;}
      this.speakers=this.order().filter(id=>R.qualifies(this.hands[id],f));this.actor=this.speakers[0];this.stage='opening';return;
    }
    this.resolve();
  }
  finish(s){this.winningSide=s;this.stage='finished';this.actor=null;this.revealed=true;}
  resolve(ordago=false){
    this.revealed=true;this.result=[];this.actor=null;
    for(const f of (ordago?[this.phase()]:this.phases)){
      const winner=R.winner(this.hands,f,this.mano);if(!winner)continue;
      const b=this.bets[f]||{status:'passed',amount:0};const s=b.status==='refused'?b.side:side(winner);
      const points=ordago?0:b.status==='refused'?(['PARES','JUEGO','PUNTO'].includes(f)?R.intrinsic(this.hands,f,s):0):(['GRANDE','CHICA'].includes(f)&&b.status==='accepted'?0:R.intrinsic(this.hands,f,s))+(b.amount||0);
      this.scores[s]+=points;this.result.push({phase:f,winner,side:s,points,status:b.status});
      if(ordago){this.scores[s]=Math.max(40,this.scores[s]);this.finish(s);return;}
      if(this.scores[s]>=40){this.finish(s);return;}
    }
    this.stage='summary';
  }
  sendSignal(id,key){
    if(!['mus','opening','response'].includes(this.stage)||(this.handNumber===1&&this.stage==='mus'))throw Error('Aún no puedes hacer señas.');
    if(!R.signals(this.hands[id],{grandeDone:this.phaseIndex>0}).includes(key))throw Error('Esa seña no corresponde a tus cartas.');
    if(Date.now()-(this.signalAt[id]||0)<1800)throw Error('Espera un instante antes de repetir la seña.');
    this.signalAt[id]=Date.now();this.signals[id]={id:++this.signalSerial,key,from:id,to:partner(id),seen:false,at:Date.now(),expires:Date.now()+2500,caughtBy:null};this.version++;
  }
  detectSignal(id,signalId){
    const signal=Object.values(this.signals).find(s=>s.id===signalId);
    if(!signal||Date.now()>signal.expires)throw Error('El gesto ya ha terminado. Hay que estar atento al avatar.');
    if(!['mus','opening','response'].includes(this.stage))throw Error('La seña ya no está en juego.');
    if(side(id)===side(signal.from))throw Error('Sólo puedes detectar señas de los rivales.');
    if(signal.caughtBy)throw Error('Tu pareja ya ha detectado esa seña.');
    signal.caughtBy=id;this.observations[side(id)].push({id:signal.id,from:signal.from,key:signal.key,by:id});
    this.observations[side(id)]=this.observations[side(id)].slice(-12);
    this.history.push({id,call:'¡HE VISTO UNA SEÑA!'});this.version++;
  }
  ack(id,signalId){const incoming=this.signals[partner(id)];if(!incoming||incoming.id!==signalId||incoming.to!==id)throw Error('La seña ya no está disponible.');incoming.seen=true;this.version++;}
  view(id){
    return {version:this.version,stage:this.stage,actor:this.actor,mano:this.order()[0],handNumber:this.handNumber,phase:this.phase(),scores:{...this.scores},
      hand:this.hands[id].map(c=>({...c})),hands:this.revealed?JSON.parse(JSON.stringify(this.hands)):null,
      calls:{...this.calls},offer:this.offer?{...this.offer}:null,result:this.result.map(x=>({...x})),winningSide:this.winningSide,
      history:this.history.map(x=>({...x})),turnStarted:this.turnStarted,discardCounts:{...this.discardCounts},
      selected:[...(this.musSelections[id]||[])],signals:Object.values(this.signals).filter(s=>s.from===id||s.to===id).map(s=>({...s})),
      publicSignals:['mus','opening','response'].includes(this.stage)?Object.values(this.signals).filter(s=>Date.now()<=s.expires).map(s=>({id:s.id,from:s.from,motion:({'medias-reyes':'side-mouth','medias-ases':'side-tongue',medias:'side-mouth',reyes:'bite',ases:'tongue',duples:'brows','31':'wink',juego:'kiss','30':'shrug','29':'one-shoulder',ciego:'closed'})[s.key],expires:s.expires,caught:!!s.caughtBy})):[],
      observations:this.observations[side(id)].map(o=>({...o})),
      availableSignals:['mus','opening','response'].includes(this.stage)&&!(this.handNumber===1&&this.stage==='mus')?R.signals(this.hands[id],{grandeDone:this.phaseIndex>0}):[],
      declarations:this.phaseIndex>=2?Object.fromEntries(R.ids.map(x=>[x,{pairs:R.pairs(this.hands[x]).tier>0,...(this.phaseIndex>=3?{game:R.sum(this.hands[x])>=31}:{})}])):null};
  }
  aiDiscard(id){const h=this.hands[id],counts={};h.forEach(c=>counts[R.rank(c)]=(counts[R.rank(c)]||0)+1);let indices=h.map((c,i)=>counts[R.rank(c)]>=2||R.rank(c)===12||R.rank(c)===1?-1:i).filter(i=>i>=0);if(!indices.length)indices=[h.findIndex(c=>R.rank(c)!==12)];if(indices[0]<0)indices=[0];return indices;}
  confidence(id){
    const h=this.hands[id],f=this.phase(),p=R.pairs(h),n=R.sum(h);let confidence;
    if(f==='PARES')confidence=[.1,.48,.77,.94][p.tier];
    else if(f==='JUEGO')confidence=n===31?.98:n===32?.85:.5;
    else if(f==='PUNTO')confidence=n/32;
    else if(f==='GRANDE')confidence=h.map(R.rank).reduce((a,b)=>a+b)/48;
    else confidence=1-h.map(R.rank).reduce((a,b)=>a+b)/52;
    const strong={GRANDE:['reyes','medias-reyes','duples'],CHICA:['ases','medias-ases'],PARES:['duples','medias','medias-reyes','medias-ases'],JUEGO:['31'],PUNTO:['30','29']};
    if(this.observations[side(id)].some(o=>(strong[f]||[]).includes(o.key)))confidence=Math.max(0,confidence-.13);
    return confidence;
  }
  ai(){const id=this.actor;if(!id)return;
    if(this.stage==='mus'){const h=this.hands[id];return this.act(id,R.sum(h)===31||R.pairs(h).tier>=2?'cut':'mus',{indices:this.aiDiscard(id)});}
    if(this.stage==='discard')return this.act(id,'discard',{indices:this.aiDiscard(id)});
    const confidence=this.confidence(id);
    if(this.stage==='opening')return this.act(id,confidence>.72?'bet':'pass',{amount:confidence>.9?5:2});
    if(this.stage==='response')return this.act(id,confidence>=(this.offer.ordago?.96:this.offer.amount>10?.9:.55)?'accept':'decline');
  }
}
module.exports={Game,R,partner,side};
