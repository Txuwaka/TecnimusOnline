const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,R}=require('../server/engine.cjs');
const hand=nums=>nums.map((numero,i)=>({numero,palo:['Oros','Copas','Espadas','Bastos'][i]}));
function betting(phase='GRANDE'){
  const g=new Game();g.hands={jugador1:hand([12,12,12,1]),jugador4:hand([7,7,6,4]),jugador3:hand([1,1,1,4]),jugador2:hand([10,10,10,1])};
  g.phases=[phase];g.phaseIndex=0;g.preparePhase();return g;
}
test('turnos a derechas, mano rotatoria y mazo completo',()=>{const g=new Game();assert.equal(g.actor,'jugador1');assert.equal(g.deck.length,24);assert.equal(new Set(Object.values(g.hands).flat().concat(g.deck).map(c=>c.numero+c.palo)).size,40);g.freshHand();assert.equal(g.actor,'jugador4');});
test('no se permiten acciones fuera del turno ni descartes vacíos',()=>{const g=new Game();assert.throws(()=>g.act('jugador4','cut'));assert.throws(()=>g.act('jugador1','mus',{indices:[]}));assert.throws(()=>g.act('jugador1','mus',{indices:[0,0]}));assert.equal(g.actor,'jugador1');});
test('descarte coordinado y cartas únicas después de reciclar el mazo',()=>{const g=new Game();for(let k=0;k<20;k++){for(const id of g.order())g.act(id,'mus',{indices:[0,1,2,3]});for(const id of g.order())g.act(id,'discard',{indices:[0,1,2,3]});const all=Object.values(g.hands).flat().concat(g.deck,g.discard);assert.equal(all.length,40);assert.equal(new Set(all.map(c=>c.numero+c.palo)).size,40);assert.equal(g.stage,'mus');}});
test('reenvites repetidos y rechazo cobra el envite anterior',()=>{const g=betting();g.act(g.actor,'bet',{amount:2});g.act(g.actor,'raise',{amount:3});g.act(g.actor,'raise',{amount:5});g.act(g.actor,'raise',{amount:7});assert.equal(g.offer.amount,17);const side=g.offer.side;g.act(g.actor,'decline');g.act(g.actor,'decline');assert.equal(g.scores[side],10);assert.equal(g.stage,'summary');});
test('el compañero todavía puede querer tras el primer no quiero',()=>{const g=betting();g.act('jugador1','bet',{amount:5});g.act('jugador4','decline');assert.equal(g.actor,'jugador2');g.act('jugador2','accept');assert.equal(g.stage,'summary');assert.equal(g.scores.nosotros,5);});
test('órdago aceptado gana el juego y no admite reenvites',()=>{const g=betting();g.act(g.actor,'ordago');assert.throws(()=>g.act(g.actor,'raise',{amount:2}));g.act(g.actor,'accept');assert.equal(g.stage,'finished');assert.equal(g.winningSide,'nosotros');assert.equal(g.scores.nosotros,40);});
test('en pares y juego sólo hablan jugadores habilitados',()=>{const g=betting('JUEGO');assert.ok(g.speakers.every(id=>R.sum(g.hands[id])>=31));assert.ok(!g.speakers.includes('jugador4'));g.act(g.actor,'bet',{amount:2});assert.ok(!g.speakers.includes('jugador4'));});
test('pares de un solo equipo se cobran sin ofrecer apuestas',()=>{const g=betting('PARES');g.hands.jugador4=hand([7,6,5,4]);g.hands.jugador2=hand([10,7,5,4]);g.preparePhase();assert.equal(g.stage,'summary');assert.equal(g.scores.nosotros,4);});
test('empates favorecen la mano, treses como reyes y doses como ases',()=>{assert.equal(R.rank({numero:3}),12);assert.equal(R.rank({numero:2}),1);const h=Object.fromEntries(R.ids.map(id=>[id,hand([12,7,4,1])]));assert.equal(R.winner(h,'GRANDE',2),'jugador3');});
test('vistas privadas no contienen cartas ajenas ni mazo',()=>{const g=betting();const a=g.view('jugador1');assert.equal(a.hands,null);assert.equal(a.deck,undefined);assert.equal(a.hand.length,4);a.hand[0].numero=4;assert.equal(g.hands.jugador1[0].numero,12);});
test('señas sólo para la pareja y confirmación de visto validada',()=>{const g=betting();g.sendSignal('jugador1','medias-reyes');assert.equal(g.view('jugador4').signals.length,0);assert.equal(g.view('jugador2').signals.length,0);const s=g.view('jugador3').signals[0];assert.throws(()=>g.ack('jugador4',s.id));g.ack('jugador3',s.id);assert.equal(g.view('jugador1').signals[0].seen,true);assert.throws(()=>g.sendSignal('jugador4','31'));});
test('el gesto es visible y la seña cazada se comparte sólo entre los rivales',()=>{
  const g=betting(),actor=g.actor,clock=g.turnStarted;
  g.sendSignal('jugador1','medias-reyes');const publicSignal=g.view('jugador4').publicSignals[0];
  assert.equal(publicSignal.motion,'side-mouth');assert.equal(publicSignal.key,undefined);assert.equal(g.view('jugador4').observations.length,0);
  assert.throws(()=>g.detectSignal('jugador3',publicSignal.id));
  const confidence=g.confidence('jugador4');g.act('jugador4','detect',{signalId:publicSignal.id});
  assert.equal(g.actor,actor);assert.equal(g.turnStarted,clock);
  assert.equal(g.view('jugador4').observations[0].key,'medias-reyes');assert.equal(g.view('jugador2').observations[0].key,'medias-reyes');
  assert.equal(g.view('jugador1').observations.length,0);assert.equal(g.view('jugador1').signals[0].caughtBy,'jugador4');
  assert.ok(g.confidence('jugador4')<confidence);assert.throws(()=>g.detectSignal('jugador2',publicSignal.id));
});
test('una seña caducada no se puede cazar y las observaciones se reinician al repartir',()=>{
  const g=betting();g.sendSignal('jugador1','medias-reyes');const signal=g.signals.jugador1;signal.expires=Date.now()-1;
  assert.equal(g.view('jugador4').publicSignals.length,0);assert.throws(()=>g.detectSignal('jugador4',signal.id));
  signal.expires=Date.now()+2500;g.detectSignal('jugador4',signal.id);g.freshHand();
  assert.equal(g.view('jugador4').observations.length,0);assert.equal(g.view('jugador4').publicSignals.length,0);
});
test('500 partidas de bots terminan sin perder cartas ni bloquearse',()=>{for(let n=0;n<500;n++){const g=new Game();let turns=0;while(g.stage!=='finished'&&turns++<5000){if(g.stage==='summary')g.freshHand();else g.ai();assert.ok(Object.values(g.hands).every(h=>h.length===4));}assert.equal(g.stage,'finished');assert.ok(g.scores[g.winningSide]>=40);}});
