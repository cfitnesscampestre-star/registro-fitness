<script>
if('serviceWorker' in navigator) {
  const swCode = `
    const CACHE='fitness-ctrl-v1';
    self.addEventListener('install',e=>{self.skipWaiting();});
    self.addEventListener('activate',e=>{self.clients.claim();});
    self.addEventListener('fetch',e=>{
      if(e.request.method!=='GET')return;
      e.respondWith(
        fetch(e.request).then(r=>{
          const rc=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,rc));
          return r;
        }).catch(()=>caches.match(e.request))
      );
    });
  `;
  const blob=new Blob([swCode],{type:'application/javascript'});
  navigator.serviceWorker.register(URL.createObjectURL(blob))
    .catch(()=>{});
}

let _pwaPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();_pwaPrompt=e;
  if(document.getElementById('btn-instalar'))return;
  const b=document.createElement('button');
  b.id='btn-instalar';b.className='btn no-print';
  b.style.cssText='background:#0d2218;color:var(--neon);border:1px solid var(--verde);font-size:.65rem;padding:5px 8px;white-space:nowrap;flex-shrink:0;';
  b.innerHTML='<svg class="ico" viewBox="0 0 20 20"><rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="10" cy="15.5" r="1" fill="currentColor"/><polyline points="8,7 10,5 12,7" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="5" x2="10" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Instalar';b.title='Instalar en pantalla de inicio';
  b.onclick=async()=>{
    if(!_pwaPrompt)return;
    _pwaPrompt.prompt();
    const{outcome}=await _pwaPrompt.userChoice;
    if(outcome==='accepted')b.remove();
    _pwaPrompt=null;
  };
  const hr=document.querySelector('.hr');
  if(hr)hr.insertBefore(b,hr.firstChild);
});
window.addEventListener('appinstalled',()=>{
  const b=document.getElementById('btn-instalar');
  if(b)b.remove();_pwaPrompt=null;
});
