'use strict';
const TecniAvatars=(()=>{
  const list=[
    {id:'abuelo',name:'Don Mus',tag:'Lleva jugando desde antes del wifi.',skin:'#eac09b',hair:'#d5d8ca',shirt:'#376659',bg:'#f4c76d',accessory:'cap',beard:true},
    {id:'tahur',name:'Paco Farol',tag:'La cara de póker. Las cartas, ya veremos.',skin:'#bd835c',hair:'#262d34',shirt:'#bd4c47',bg:'#83bcae',accessory:'glasses',beard:true},
    {id:'campeona',name:'Lola Envido',tag:'Te quiere el órdago y te roba las patatas.',skin:'#f2c7a6',hair:'#a84f36',shirt:'#efb849',bg:'#d49daa',accessory:'earrings'},
    {id:'novato',name:'Nico',tag:'Pregunta las reglas. Luego te gana.',skin:'#dfab7b',hair:'#4c3433',shirt:'#638bbc',bg:'#e9c86f',accessory:'freckles'},
    {id:'rockera',name:'Vera',tag:'Sube el volumen. Y el envite.',skin:'#b77e65',hair:'#342d45',shirt:'#755f98',bg:'#b5c7df',accessory:'earrings'},
    {id:'sereno',name:'El Sereno',tag:'No mueve una ceja. Eso también es una seña.',skin:'#e8b98a',hair:'#394751',shirt:'#8c654b',bg:'#a8c3a0',accessory:'moustache'}
  ];
  function svg(id,mood='idle',motion=''){
    const a=list.find(a=>a.id===id)||list[0],long=['campeona','rockera'].includes(a.id);
    const eye=motion==='closed'?'<path d="M36 53q7 6 14 0"/>':(motion==='wink'||mood==='wink')?'<path d="M36 53q7-7 14 0"/>':mood==='lose'?'<path d="M36 53l11-3"/>':'<ellipse cx="43" cy="52" rx="3.1" ry="4.2" fill="#263339"/>';
    const mouth=motion==='side-tongue'?'<path d="M44 77q8 5 23-7"/><path d="M61 74q2 14 9 10q7-4 1-15" fill="#e38589"/>':motion==='tongue'?'<path d="M44 71h24"/><path d="M50 72q-2 17 7 17q9-2 6-17" fill="#e38589"/>':motion==='kiss'?'<ellipse cx="56" cy="74" rx="5" ry="4" fill="#d17b78"/>':motion==='side-mouth'?'<path d="M44 77q8 5 23-7"/>':motion==='bite'?'<path d="M44 72h24l-6 6-16-2Z" fill="#fff4dc"/>':mood==='shock'?'<ellipse cx="56" cy="73" rx="7" ry="9" fill="#633d37"/>':mood==='lose'?'<path d="M44 77q12-11 24 0"/>':'<path d="M43 70q13 16 27-1q-13 5-27 1" fill="#fff5df"/>';
    const hair=long?`<path d="M25 62Q10 16 47 13Q94 5 89 74l7 25-23-6-5-51Q37 41 30 65Z" fill="${a.hair}"/>`:`<path d="M28 46q-10-26 16-31q5-13 15-2q27-8 28 30l-14-8-9 3-9-8-15 12Z" fill="${a.hair}"/>`;
    let accessories='';
    if(a.accessory==='cap')accessories='<path d="M22 37q4-29 39-23q27 3 29 24Z" fill="#6c7659"/><path d="M20 36h72q4 9-27 10l-44-3Z" fill="#939a74"/>';
    if(a.accessory==='glasses')accessories='<g fill="#e6e2ba88"><rect x="30" y="43" width="23" height="18" rx="6"/><rect x="60" y="43" width="23" height="18" rx="6"/><path d="M53 49h7M25 48h5M83 48h5"/></g>';
    if(a.accessory==='earrings')accessories='<circle cx="27" cy="65" r="4" fill="#edc56a"/><circle cx="84" cy="65" r="4" fill="#edc56a"/>';
    if(a.accessory==='freckles')accessories='<g fill="#a7795d" stroke="none"><circle cx="34" cy="62" r="1.6"/><circle cx="39" cy="65" r="1.6"/><circle cx="76" cy="62" r="1.6"/><circle cx="71" cy="65" r="1.6"/></g>';
    if(a.accessory==='moustache')accessories='<path d="M56 66q-15-7-20 9q13 3 20-4q9 8 20 3q-6-14-20-8Z" fill="#394751"/>';
    return `<svg viewBox="0 0 112 112" role="img" aria-label="${a.name}" xmlns="http://www.w3.org/2000/svg"><g stroke="#243532" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="56" cy="56" r="53" fill="${a.bg}"/><path d="M16 109q0-25 29-30h22q30 7 29 30" fill="${a.shirt}"/>${hair}<path d="M44 79v13l12 9 12-9V79" fill="${a.skin}"/><ellipse cx="28" cy="56" rx="6" ry="10" fill="${a.skin}"/><ellipse cx="84" cy="56" rx="6" ry="10" fill="${a.skin}"/><path d="M29 38q29-18 54 1v23q-2 27-27 29Q29 86 29 62Z" fill="${a.skin}"/>${motion==='brows'?'<path d="M34 35l14-3M64 32l13 3" stroke-width="3.5"/>':'<path d="M34 41l14-3M64 38l13 3" stroke-width="3.5"/>'}${eye}${motion==='closed'?'<path d="M62 53q7 6 14 0"/>':'<ellipse cx="69" cy="52" rx="3.1" ry="4.2" fill="#263339"/>'}<path d="M56 54l-4 10 8 1" fill="none" stroke="#a27559"/>${a.beard?`<path d="M31 65q3 20 25 25q21-2 26-25l-7 3-6 17-26-1-6-14Z" fill="${a.hair}" stroke="none"/>`:''}${mouth}${accessories}<path d="M43 97l-7 11M70 97l8 11" stroke="#fff2d5"/><circle cx="56" cy="108" r="2" fill="#fff2d5"/></g></svg>`;
  }
  const mood=call=>call?.includes('ÓRDAGO')?'shock':call?.includes('NO QUIERO')?'lose':call?.includes('ENVIDO')?'wink':'idle';
  function picker(container,selected,onChoose){container.replaceChildren();for(const a of list){const b=document.createElement('button');b.type='button';b.className='avatar-choice';b.setAttribute('aria-pressed',String(a.id===selected));b.innerHTML=svg(a.id);const n=document.createElement('strong');n.textContent=a.name;const t=document.createElement('small');t.textContent=a.tag;b.append(n,t);b.onclick=()=>onChoose(a.id);container.append(b);}}
  return {list,svg,mood,picker};
})();
