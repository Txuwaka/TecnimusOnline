'use strict';
(()=>{
  let selected='novato';try{selected=localStorage.getItem('tecnimus-avatar')||selected;}catch{}
  const ids={jugador1:()=>selected,jugador2:()=> 'tahur',jugador3:()=> 'abuelo',jugador4:()=> 'campeona'};
  function paint(id){const player=document.getElementById(id),badge=player.querySelector('.avatar');badge.classList.add('comic-avatar');badge.innerHTML=TecniAvatars.svg(ids[id](),TecniAvatars.mood(player.dataset.call),player.dataset.signal||'');}
  Object.keys(ids).forEach(id=>{paint(id);new MutationObserver(()=>paint(id)).observe(document.getElementById(id),{attributes:true,attributeFilter:['data-call','data-signal']});});
  const d=document.createElement('dialog');d.className='profile-dialog';d.innerHTML='<h2>Tu cara en la timba</h2><div class="avatar-picker"></div><button class="button primary" type="button">Listo</button>';document.body.append(d);
  function picker(){TecniAvatars.picker(d.querySelector('.avatar-picker'),selected,id=>{selected=id;try{localStorage.setItem('tecnimus-avatar',id);}catch{}paint('jugador1');picker();});}
  d.querySelector('.button').onclick=()=>d.close();const b=document.createElement('button');b.className='tips-toggle solo-profile-toggle';b.textContent='Mi avatar';b.onclick=()=>{picker();d.showModal();};document.querySelector('.top-controls').prepend(b);
})();
