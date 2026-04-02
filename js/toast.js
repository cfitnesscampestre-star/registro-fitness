// ═══ TOAST — Fitness Control · Club Campestre ═══
// ═══ SISTEMA DE TOAST ═══
function toast(msg, tipo='ok', duracion=3200){
  const icons={ok:'✔',err:'✖',warn:'⚠',info:'ℹ'};
  const cont=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className=`toast t-${tipo}`;
  t.innerHTML=`<span class="toast-icon">${icons[tipo]||'ℹ'}</span><span class="toast-msg">${msg}</span>`;
  cont.appendChild(t);
  const remove=()=>{
    t.classList.add('toast-exit');
    t.addEventListener('animationend',()=>t.remove(),{once:true});
  };
  const timer=setTimeout(remove,duracion);
  t.addEventListener('click',()=>{clearTimeout(timer);remove();});
}
// ═══ VALIDACIÓN CENTRAL ═══
function validarCampo(id, condicion, msgError){
  const el=document.getElementById(id);
  if(!el)return condicion;
  if(!condicion){
    el.classList.add('input-error');
    el.addEventListener('input',()=>el.classList.remove('input-error'),{once:true});
    toast(msgError,'err');
    return false;
  }
  el.classList.remove('input-error');
  return true;
}
</script>
