const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(t){
  const context=vm.createContext({console,setInterval,clearInterval,isSecureContext:true,navigator:{mediaDevices:{getUserMedia(){}}},RTCPeerConnection:function(){}});
  vm.runInContext(fs.readFileSync('docs/mus-rules.js','utf8')+'\n'+fs.readFileSync('docs/voice.js','utf8')+'\nglobalThis.Voice=TecniVoice;',context);
  const track={enabled:true,stopped:false,stop(){this.stopped=true;}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]},calls=[];
  const state={you:'jugador4',players:[{id:'jugador1',name:'Txuwa',connected:true,voice:true,voiceGeneration:1},{id:'jugador4',name:'Borja',connected:true,voice:true,voiceGeneration:1}]};
  class Peer{
    constructor(){this.signalingState='stable';this.connectionState='new';this.candidates=[];this.tracks=[];}
    addTrack(track){this.tracks.push(track);}
    async setLocalDescription(){this.localDescription={type:this.signalingState==='have-remote-offer'?'answer':'offer',sdp:'local'};this.signalingState=this.localDescription.type==='answer'?'stable':'have-local-offer';}
    async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable';}
    async addIceCandidate(c){this.candidates.push(c);}
    close(){this.closed=true;}restartIce(){}
  }
  const peers=[],voice=new context.Voice({api:async(endpoint,data)=>{calls.push({endpoint,data});return endpoint==='voice-config'?{iceServers:[]}:state;},createPeer:()=>{const p=new Peer();peers.push(p);return p;},getMedia:async()=>stream,makeAudio:()=>({play:async()=>{},pause(){this.paused=true;},remove(){}})});
  t.after(()=>voice.dispose());return {voice,track,stream,state,calls,peers};
}
test('voz: activación explícita, silencio, escucha y cierre del micrófono',async t=>{
  const {voice,track,calls,peers}=setup(t);assert.equal(voice.enabled,false);assert.equal(calls.length,0);
  await voice.enable();assert.equal(voice.enabled,true);assert.equal(peers.length,1);
  await voice.toggleMute();assert.equal(track.enabled,false);assert.equal(calls.at(-1).data.muted,true);
  await voice.toggleMute();assert.equal(track.enabled,true);voice.toggleListen();assert.equal([...voice.peers.values()][0].audio.muted,true);
  await voice.disable();assert.equal(track.stopped,true);assert.equal(peers[0].closed,true);assert.equal(voice.peers.size,0);assert.equal(calls.at(-1).data.enabled,false);
});
test('voz: ICE temprano, ofertas simultáneas y mensajes de sesiones caducadas',async t=>{
  const {voice,peers,calls}=setup(t);await voice.enable();const p=voice.peers.get('jugador1'),base={from:'jugador1',generation:1,targetGeneration:1};
  voice.receive({...base,candidate:{candidate:'early'}});await p.chain;assert.equal(peers[0].candidates.length,0);
  await peers[0].onnegotiationneeded();assert.equal(peers[0].signalingState,'have-local-offer');
  voice.receive({...base,description:{type:'offer',sdp:'remote'}});await p.chain;
  assert.equal(peers[0].candidates.length,1);assert.equal(calls.at(-1).data.description.type,'answer');
  voice.receive({...base,generation:0,description:{type:'offer',sdp:'stale'}});await p.chain;
  assert.equal(peers[0].remoteDescription.sdp,'remote');
});
test('voz: perder la conexión o cancelar una petición pendiente apaga la captura',async t=>{
  const {voice,track,stream,calls}=setup(t);let resolve;
  voice.getMedia=()=>new Promise(r=>resolve=r);const activation=voice.enable();
  while(!resolve)await new Promise(r=>setImmediate(r));voice.suspend();resolve(stream);await activation;
  assert.equal(track.stopped,true);assert.equal(voice.enabled,false);assert.equal(calls.some(c=>c.data?.enabled),false);
});
test('voz: permiso denegado mantiene el micrófono apagado y permite volver a intentarlo',async t=>{
  const {voice,stream}=setup(t);voice.getMedia=async()=>{const e=Error();e.name='NotAllowedError';throw e;};
  await voice.enable();assert.equal(voice.enabled,false);assert.match(voice.error,/permitido/);assert.equal(voice.busy,false);
  voice.getMedia=async()=>stream;await voice.enable();assert.equal(voice.enabled,true);
});
