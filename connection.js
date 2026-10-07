'use strict';
const TecniConnection=(()=>{
  function create({serverUrl='',fetcher=fetch,storage=globalThis.sessionStorage}={}){
    let base='',token='',stopStream=null;
    function configure(url){
      stopStream?.();if(location.protocol==='file:'&&!url){base='';return base;}const resolved=new URL(url||location.origin||new URL(location.href).origin,location.href);
      if(!['http:','https:'].includes(resolved.protocol)||resolved.username||resolved.password)throw Error('Usa la dirección HTTP o HTTPS del servidor.');
      if(location.protocol==='https:'&&resolved.protocol!=='https:')throw Error('Desde esta página el servidor debe usar HTTPS.');
      base=resolved.origin;try{token=storage?.getItem('tecnimus-session:'+base)||'';}catch{token='';}
      return base;
    }
    function headers(json=false){return {...(json?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})};}
    async function api(endpoint,data){
      const response=await fetcher(base+'/api/'+endpoint,{method:data===undefined?'GET':'POST',credentials:'omit',headers:headers(data!==undefined),body:data===undefined?undefined:JSON.stringify(data)});
      const result=await response.json();if(!response.ok){const e=Error(result.error||'No se pudo completar la acción.');e.status=response.status;throw e;}
      if(result.sessionToken){token=result.sessionToken;try{storage?.setItem('tecnimus-session:'+base,token);}catch{}delete result.sessionToken;}
      return result;
    }
    async function health(){const res=await fetcher(base+'/health',{credentials:'omit'});const result=await res.json();if(!res.ok||!result.ok)throw Error('El servidor no responde.');return result;}
    function clear(){stopStream?.();token='';try{storage?.removeItem('tecnimus-session:'+base);}catch{}}
    function stream({onstate,onvoice,onopen,onerror}={}){
      stopStream?.();let closed=false,controller=null,timer=null;
      function close(){closed=true;controller?.abort();clearTimeout(timer);}
      stopStream=close;
      async function run(){
        if(closed)return;controller=new AbortController();
        try{
          const res=await fetcher(base+'/api/events',{headers:headers(),credentials:'omit',signal:controller.signal});
          if(!res.ok)throw Error('Se perdió la sesión de la mesa.');onopen?.();
          const reader=res.body.getReader(),decoder=new TextDecoder();let text='';
          while(!closed){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value,{stream:true});let end;
            while((end=text.indexOf('\n\n'))!==-1){const block=text.slice(0,end);text=text.slice(end+2);const lines=block.split('\n'),event=lines.find(l=>l.startsWith('event: '))?.slice(7)||'state';const raw=lines.filter(l=>l.startsWith('data: ')).map(l=>l.slice(6)).join('\n');if(!raw)continue;const data=JSON.parse(raw);if(event==='voice-signal')onvoice?.(data);else if(event==='state')onstate?.(data);}
          }
          if(!closed)throw Error('Conexión interrumpida.');
        }catch(e){if(!closed){onerror?.(e);timer=setTimeout(run,1500);}}
      }
      run();return {close};
    }
    configure(serverUrl);return {api,health,stream,configure,clear,get base(){return base;}};
  }
  return {create};
})();
