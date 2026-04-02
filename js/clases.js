// ═══ CLASES — Fitness Control · Club Campestre ═══
// ═══ GESTIÓN DE CLASES PERSONALIZADAS ═══
function syncClaseInput(){
  const sel=document.getElementById('s-clase');
  const inp=document.getElementById('s-clase-custom');
  if(sel.value==='__nueva__'){
    inp.style.display='block';
    inp.focus();
  } else {
    inp.style.display='none';
  }
}
function syncClaseSelect(){
  const inp=document.getElementById('s-clase-custom');
  const sel=document.getElementById('s-clase');
  if(inp.value.trim()){sel.value='__nueva__';}
}
function getClaseSeleccionada(){
  const sel=document.getElementById('s-clase');
  const inp=document.getElementById('s-clase-custom');
  if(sel.value==='__nueva__'){
    const v=inp.value.trim();
    if(v&&!TIPOS_CLASE.includes(v)){TIPOS_CLASE.push(v);actualizarSelectoresClase();}
    return v;
  }
  return sel.value;
}
function actualizarSelectoresClase(){
  const todas=todosLosClasesUnicos();
  const opts=todas.map(c=>`<option value="${c}">${c}</option>`).join('')+'<option value="__nueva__">✚ Nueva clase...</option>';
  const sel=document.getElementById('s-clase');
  if(sel){const cur=sel.value;sel.innerHTML=opts;sel.value=cur||todas[0];}
}

