'use strict';
class TecniVoice {
  constructor({api,onstate,onchange,createPeer=config=>new RTCPeerConnection(config),getMedia=constraints=>navigator.mediaDevices.getUserMedia(constraints),makeAudio=()=>document.createElement('audio')}={}){
    this.api=api;this.onstate=onstate;this.onchange=onchange||(()=>{});this.createPeer=createPeer;this.getMedia=getMedia;this.makeAudio=makeAudio;
    this.peers=new Map();this.mutedPeers=new Set();this.stream=null;this.state=null;this.enabled=false;this.muted=false;this.deafened=false;this.busy=false;this.error='';this.epoch=0;this.suspended=false;
    this.timer=setInterval(()=>this.expire(),1500);
  }
  async enable(){
    if(this.busy||this.enabled)return;
    if(!globalThis.isSecureContext){this.error='El micrófono necesita HTTPS o abrir el juego en localhost.';this.onchange();return;}
    if(typeof globalThis.RTCPeerConnection!=='function'||!navigator.mediaDevices?.getUserMedia){this.error='Este navegador no permite usar el chat de voz.';this.onchange();return;}
    this.busy=true;this.error='';this.suspended=false;const epoch=++this.epoch;this.onchange();
    try{
      this.config=await this.api('voice-config');if(epoch!==this.epoch)return;const stream=await this.getMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.enabled=true;this.muted=false;
      stream.getAudioTracks().forEach(track=>{track.onended=()=>{if(this.enabled)this.disable('El micrófono se ha desconectado.');};});
      const state=await this.api('voice-mode',{enabled:true,muted:false});if(epoch!==this.epoch){await this.api('voice-mode',{enabled:false,muted:true}).catch(()=>{});return;}
      if(this.onstate)this.onstate(state);else this.update(state);
    }catch(e){const active=this.enabled;this.release();if(active)await this.api('voice-mode',{enabled:false,muted:true}).catch(()=>{});this.error=e.name==='NotAllowedError'?'No has permitido el micrófono. Puedes activarlo cuando quieras.':e.name==='NotFoundError'?'No se encuentra un micrófono.':e.message||'No se pudo activar el chat de voz.';}
    finally{this.busy=false;this.onchange();}
  }
  release(){this.enabled=false;this.epoch++;for(const [id] of this.peers)this.drop(id);this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;}
  async disable(message=''){
    const notify=this.enabled;this.release();this.error=message;this.onchange();
    if(notify)try{const state=await this.api('voice-mode',{enabled:false,muted:true});this.onstate?.(state);}catch{}
  }
  suspend(){if(this.enabled||this.busy){this.suspended=true;this.release();this.error='La voz se ha apagado al perder la conexión. Actívala de nuevo al volver.';this.onchange();}}
  async toggleMute(){if(!this.enabled||this.busy)return;this.muted=!this.muted;this.stream?.getAudioTracks().forEach(t=>t.enabled=!this.muted);this.onchange();try{const state=await this.api('voice-mode',{enabled:true,muted:this.muted});if(this.onstate)this.onstate(state);else this.update(state);}catch(e){this.error=e.message;this.onchange();}}
  isPeerMuted(id){return this.mutedPeers.has(id);}
  togglePeerMute(id){const player=this.state?.players.find(p=>p?.id===id);if(!player||player.bot||id===this.state.you)return;this.isPeerMuted(id)?this.mutedPeers.delete(id):this.mutedPeers.add(id);this.applyListen();this.onchange();}
  applyListen(){for(const p of this.peers.values())p.audio.muted=this.deafened||this.isPeerMuted(p.id);}
  toggleListen(){this.deafened=!this.deafened;this.applyListen();this.onchange();}
  async resumePlayback(){for(const p of this.peers.values()){try{await p.audio.play();p.blocked=false;}catch{p.blocked=true;}}this.onchange();}
  update(state){
    if(this.state?.code!==state?.code){this.mutedPeers.clear();for(const [id] of this.peers)this.drop(id);}
    this.state=state;if(!this.enabled||!state)return;
    const own=state.players.find(p=>p?.id===state.you);if(!own?.voice)return;
    const wanted=state.players.filter(p=>p&&!p.bot&&p.id!==state.you&&p.connected&&p.voice);
    for(const [id,p] of this.peers)if(!wanted.some(x=>x.id===id&&x.voiceGeneration===p.generation))this.drop(id);
    for(const p of wanted)if(!this.peers.has(p.id))this.add(p,own.voiceGeneration);
    this.onchange();
  }
  add(player,ownGeneration){
    const pc=this.createPeer({iceServers:this.config.iceServers}),audio=this.makeAudio();audio.autoplay=true;audio.playsInline=true;audio.muted=this.deafened||this.isPeerMuted(player.id);
    const p={id:player.id,generation:player.voiceGeneration,ownGeneration,pc,audio,makingOffer:false,ignoreOffer:false,answerPending:false,polite:MusRules.ids.indexOf(this.state.you)>MusRules.ids.indexOf(player.id),candidates:[],chain:Promise.resolve(),status:'connecting',started:Date.now(),blocked:false,restarts:0};this.peers.set(player.id,p);
    const send=payload=>this.api('voice-signal',{to:p.id,generation:p.ownGeneration,targetGeneration:p.generation,...payload});
    p.send=send;
    pc.onicecandidate=({candidate})=>{if(this.peers.get(p.id)===p)send({candidate:candidate?.toJSON?candidate.toJSON():candidate}).catch(e=>{if(this.enabled){this.error=e.message;this.onchange();}});};
    pc.onnegotiationneeded=async()=>{try{p.makingOffer=true;await pc.setLocalDescription();if(this.peers.get(p.id)===p)await send({description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});}catch(e){if(this.enabled&&this.peers.get(p.id)===p){this.error='No se pudo iniciar la voz con '+player.name+'.';this.onchange();}}finally{p.makingOffer=false;}};
    pc.ontrack=({track,streams})=>{audio.srcObject=streams[0]||new MediaStream([track]);audio.play().then(()=>{p.blocked=false;this.onchange();}).catch(()=>{p.blocked=true;this.onchange();});};
    pc.onconnectionstatechange=()=>{p.status=pc.connectionState;if(p.status==='failed'){if(p.restarts++<1){pc.restartIce();p.started=Date.now();}else this.error='No se pudo conectar la voz con '+player.name+'. Prueba a desactivar y activar el chat.';}this.onchange();};
    for(const track of this.stream.getAudioTracks())pc.addTrack(track,this.stream);
    return p;
  }
  receive(message){
    if(!this.enabled||!this.state)return;
    const own=this.state.players.find(p=>p?.id===this.state.you),remote=this.state.players.find(p=>p?.id===message.from);
    if(!own||!remote?.voice||!remote.connected||message.generation!==remote.voiceGeneration||message.targetGeneration!==own.voiceGeneration)return;
    const p=this.peers.get(remote.id)||this.add(remote,own.voiceGeneration);
    p.chain=p.chain.then(async()=>{
      if(this.peers.get(p.id)!==p)return;
      const pc=p.pc;
      if(message.description){
        const d=message.description,ready=!p.makingOffer&&(pc.signalingState==='stable'||p.answerPending),collision=d.type==='offer'&&!ready;
        p.ignoreOffer=!p.polite&&collision;if(p.ignoreOffer)return;
        p.answerPending=d.type==='answer';await pc.setRemoteDescription(d);p.answerPending=false;
        for(const candidate of p.candidates.splice(0))await pc.addIceCandidate(candidate);
        if(d.type==='offer'){await pc.setLocalDescription();await p.send({description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});}
      }else if(message.candidate!==undefined){if(p.ignoreOffer)return;if(!pc.remoteDescription)p.candidates.push(message.candidate);else await pc.addIceCandidate(message.candidate);}
    }).catch(()=>{if(this.peers.get(p.id)===p){this.error='La negociación de voz no ha terminado. Vuelve a activar el chat si no escuchas.';this.onchange();}});
  }
  drop(id){const p=this.peers.get(id);if(!p)return;this.peers.delete(id);p.pc.ontrack=p.pc.onicecandidate=p.pc.onnegotiationneeded=p.pc.onconnectionstatechange=null;p.pc.close();p.audio.pause();p.audio.srcObject=null;p.audio.remove?.();}
  expire(){if(!this.enabled)return;for(const p of this.peers.values())if(p.status!=='connected'&&Date.now()-p.started>20000&&!p.blocked){this.error='La voz no conecta con algún jugador. Esta red puede necesitar un servidor de retransmisión.';this.onchange();break;}}
  dispose(){clearInterval(this.timer);this.release();}
}
