// ⚙️ CONFIGURACIÓN — API local (backend propio)
const API_KEY = "cilindros-local-key-2024";
const API_BASE = "/api";

const GASES = ["Argón","Acetileno","Oxígeno","Mix 20 (Atal)","Mix 310 (Noxal)","Gas Carbónico","Nitrógeno"];

let clientes = [];
let selected = null;
let filtroActivo = "todos";

async function cargarDatos(){
  document.getElementById("last-updated").textContent = "Cargando datos...";
  try{
    const res = await fetch(API_BASE + "/data", {
      headers: { "x-api-key": API_KEY }
    });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    clientes = (data && data.clientes) || [];
    // Migración: ya no se usa el estado intermedio "Factura enviada"
    clientes.forEach(c=>{ if(c.estado==="Factura enviada") c.estado="Pendiente"; });
    document.getElementById("last-updated").textContent = "Datos cargados";
  }catch(e){
    console.error(e);
    document.getElementById("last-updated").textContent = "⚠ No se pudo conectar a la base de datos";
    alert("No se pudo conectar con el servidor.\n\nAsegurate de que el servidor esté corriendo.");
  }
  render();
}

const save = async () => {
  document.getElementById("last-updated").textContent = "Guardando...";
  try{
    const res = await fetch(API_BASE + "/data", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ clientes })
    });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const now = new Date();
    document.getElementById("last-updated").textContent =
      "Guardado " + now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
  }catch(e){
    console.error(e);
    document.getElementById("last-updated").textContent = "⚠ Error al guardar — revisá tu conexión";
  }
};

function mesesDesde(pagoHasta){
  if(!pagoHasta) return null;
  const [y,m] = pagoHasta.split("-").map(Number);
  const now = new Date();
  return (now.getFullYear()-y)*12 + (now.getMonth()+1-m);
}

function mesesTexto(d){
  if(d===null) return "-";
  if(d<0) return "Al día";
  if(d===0) return "Este mes";
  return d+(d===1?" mes":" meses");
}

function mesActual(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

function totalTubos(c){ return (c.cilindros||[]).reduce((s,g)=>s+g.cantidad,0); }
function totalBajaRotacion(c){ return (c.cilindros||[]).reduce((s,g)=>s+(g.bajaRotacion||0),0); }

function setFilter(f){
  filtroActivo = f;
  document.querySelectorAll(".stat").forEach(el=>el.classList.remove("active"));
  const map={todos:"stat-todos",Pendiente:"stat-pendiente",Pagado:"stat-pagado",urgente:"stat-urgente",porvencer:"stat-porvencer"};
  document.getElementById(map[f]||"stat-todos").classList.add("active");
  render();
}

function limpiarFiltros(){
  document.getElementById("search").value="";
  document.getElementById("filtro-gas").value="";
  document.getElementById("filtro-desde").value="";
  document.getElementById("filtro-hasta").value="";
  setFilter("todos");
}

function populateGasFilter(){
  const sel=document.getElementById("filtro-gas");
  const current=sel.value;
  sel.innerHTML='<option value="">Todos los gases</option>'+
    GASES.map(g=>`<option value="${g}" ${g===current?"selected":""}>${g}</option>`).join("");
}

// AGREGAR
let nuevosCilindros = [];

function openAddModal(){
  nuevosCilindros = [];
  renderNuevosCilindros();
  document.getElementById("overlay-add").style.display="flex";
  setTimeout(()=>document.getElementById("add-nombre").focus(),50);
}

function closeAdd(){
  document.getElementById("overlay-add").style.display="none";
  ["add-nombre","add-pago","add-notas","add-cyl-qty","add-cyl-bajarot"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("add-estado").value="Pendiente";
  nuevosCilindros = [];
}

function addTempCylinder(){
  const gas=document.getElementById("add-cyl-gas").value;
  const qty=Number(document.getElementById("add-cyl-qty").value);
  const rot=Number(document.getElementById("add-cyl-bajarot").value)||0;
  if(!gas||!qty){ alert("Elegí el gas y la cantidad."); return; }
  if(rot>qty){ alert("La baja rotación no puede ser mayor a la cantidad total."); return; }
  nuevosCilindros.push({gas,cantidad:qty,bajaRotacion:rot});
  document.getElementById("add-cyl-qty").value="";
  document.getElementById("add-cyl-bajarot").value="";
  renderNuevosCilindros();
}

function removeTempCylinder(i){
  nuevosCilindros.splice(i,1);
  renderNuevosCilindros();
}

function renderNuevosCilindros(){
  const div=document.getElementById("add-cyl-list");
  if(!nuevosCilindros.length){
    div.innerHTML='<p style="font-size:12px;color:#9ca3af;font-style:italic;padding:4px 0">Todavía no agregaste ningún cilindro. Podés hacerlo ahora o más tarde.</p>';
    return;
  }
  div.innerHTML=nuevosCilindros.map((g,i)=>`
    <div class="cyl-row">
      <span style="flex:1">${g.gas}</span>
      <span style="width:50px;text-align:center">${g.cantidad} u.</span>
      ${g.bajaRotacion>0?`<span class="pill pill-orange">📦 ${g.bajaRotacion} baja rot.</span>`:""}
      <button class="btn btn-ghost btn-sm" onclick="removeTempCylinder(${i})">🗑</button>
    </div>
  `).join("");
}

function addClient(){
  const n = document.getElementById("add-nombre").value.trim();
  if(!n){ alert("Falta el nombre del cliente — es el único dato obligatorio."); document.getElementById("add-nombre").focus(); return; }
  const pago = document.getElementById("add-pago").value;
  const estado = document.getElementById("add-estado").value;
  const c = {
    id: Date.now(),
    nombre: n,
    pagoHasta: pago,
    estado: estado,
    notas: document.getElementById("add-notas").value.trim(),
    cilindros: [...nuevosCilindros],
    historial: []
  };
  if(estado==="Pagado" && pago){
    c.historial.push({mes:pago,nota:"Alta"});
  }
  clientes.push(c);
  save(); closeAdd(); render();
}

// DETALLE
function openDetalle(i){
  selected = i;
  const c = clientes[i];
  const d = mesesDesde(c.pagoHasta);

  document.getElementById("overlay-detalle").style.display="flex";
  document.getElementById("m-name").innerText = c.nombre;
  document.getElementById("m-subtitle").innerText =
    `${(c.cilindros||[]).length} tipo(s) de gas · ${totalTubos(c)} cilindros total`;
  document.getElementById("m-status").innerText = c.estado;
  document.getElementById("m-pay").innerText = c.pagoHasta||"-";
  const rotTotal = totalBajaRotacion(c);
  document.getElementById("m-rot").innerText = rotTotal+(rotTotal===1?" tubo":" tubos");

  const mDiv = document.getElementById("m-months");
  mDiv.innerText = mesesTexto(d);
  mDiv.className = "info-value"+(d!==null&&d>=3?" urgent":"");

  const alertDiv = document.getElementById("m-alert");
  if(d!==null&&d>=3){
    alertDiv.style.display="flex";
    document.getElementById("m-alert-text").innerText =
      `${d} mes${d===1?"":"es"} sin registrar pago. Revisar urgente.`;
  } else {
    alertDiv.style.display="none";
  }

  document.getElementById("edit-nombre").value = c.nombre;
  document.getElementById("edit-pago").value = c.pagoHasta||"";
  document.getElementById("edit-estado").value = c.estado;
  document.getElementById("edit-notas").value = c.notas||"";

  renderCylinders();
  renderHistorial();
}

function closeDetalle(){
  document.getElementById("overlay-detalle").style.display="none";
}

// EDITAR
function saveEdit(){
  const c = clientes[selected];
  const prevPago = c.pagoHasta;
  c.nombre = document.getElementById("edit-nombre").value.trim()||c.nombre;
  c.pagoHasta = document.getElementById("edit-pago").value;
  c.estado = document.getElementById("edit-estado").value;
  if(c.estado==="Pagado"&&c.pagoHasta&&c.pagoHasta!==prevPago){
    if(!c.historial) c.historial=[];
    c.historial.unshift({mes:c.pagoHasta,nota:"Pago registrado"});
  }
  save(); render(); openDetalle(selected);
  const btn = event.target;
  const orig = btn.innerText;
  btn.innerText="✔ Guardado";
  setTimeout(()=>btn.innerText=orig,1500);
}

function saveNotas(){
  if(selected===null) return;
  clientes[selected].notas = document.getElementById("edit-notas").value;
  save();
}

function marcarPagadoHoy(){
  const c = clientes[selected];
  const mes = mesActual();
  c.estado="Pagado";
  c.pagoHasta=mes;
  if(!c.historial) c.historial=[];
  c.historial.unshift({mes,nota:"Pago registrado hoy"});
  document.getElementById("edit-pago").value=mes;
  document.getElementById("edit-estado").value="Pagado";
  save(); render(); openDetalle(selected);
}

// HISTORIAL
function addHistorial(){
  const mes = document.getElementById("hist-mes").value;
  if(!mes){ alert("Seleccioná el mes."); return; }
  const nota = document.getElementById("hist-nota").value.trim();
  if(!clientes[selected].historial) clientes[selected].historial=[];
  clientes[selected].historial.unshift({mes,nota:nota||"Pago"});
  document.getElementById("hist-mes").value="";
  document.getElementById("hist-nota").value="";
  save(); renderHistorial();
}

function removeHistorial(i){
  clientes[selected].historial.splice(i,1);
  save(); renderHistorial();
}

function renderHistorial(){
  const c = clientes[selected];
  const hist = c.historial||[];
  const div = document.getElementById("m-hist");
  if(!hist.length){
    div.innerHTML='<p style="font-size:12px;color:#9ca3af;font-style:italic;padding:4px 0">Sin historial.</p>';
    return;
  }
  div.innerHTML=hist.map((h,i)=>`
    <div class="hist-row">
      <span class="hist-mes">📅 ${h.mes}</span>
      <span class="hist-nota">${h.nota||""}</span>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="removeHistorial(${i})">✕</button>
    </div>
  `).join("");
}

// CILINDROS
function addCylinder(){
  const gas=document.getElementById("cyl-gas").value;
  const qty=Number(document.getElementById("cyl-qty").value);
  const rot=Number(document.getElementById("cyl-bajarot").value)||0;
  if(!gas||!qty){ alert("Elegí el gas y la cantidad."); return; }
  if(rot>qty){ alert("La baja rotación no puede ser mayor a la cantidad total."); return; }
  if(!clientes[selected].cilindros) clientes[selected].cilindros=[];
  clientes[selected].cilindros.push({gas,cantidad:qty,bajaRotacion:rot});
  document.getElementById("cyl-qty").value="";
  document.getElementById("cyl-bajarot").value="";
  save(); renderCylinders();
}

function removeCylinder(i){
  clientes[selected].cilindros.splice(i,1);
  save(); renderCylinders();
}

function updateCyl(i,field,val){
  const c = clientes[selected].cilindros[i];
  if(field==="cantidad") c.cantidad=Number(val)||0;
  else if(field==="gas") c.gas=val;
  else if(field==="bajaRotacion") c.bajaRotacion=Number(val)||0;
  save();
}

function renderCylinders(){
  const cyls = clientes[selected].cilindros||[];
  const div = document.getElementById("m-cyl");
  if(!cyls.length){
    div.innerHTML='<p style="font-size:12px;color:#9ca3af;font-style:italic;padding:4px 0">Sin cilindros cargados.</p>';
    return;
  }
  div.innerHTML=cyls.map((g,i)=>`
    <div class="cyl-row">
      <select onchange="updateCyl(${i},'gas',this.value)">
        ${GASES.map(gas=>`<option value="${gas}" ${g.gas===gas?"selected":""}>${gas}</option>`).join("")}
      </select>
      <span style="font-size:11px;color:var(--text3)">Cant.</span>
      <input type="number" value="${g.cantidad}" min="0" onchange="updateCyl(${i},'cantidad',this.value)">
      <span style="font-size:11px;color:var(--text3)">Baja rot.</span>
      <input type="number" value="${g.bajaRotacion||0}" min="0" onchange="updateCyl(${i},'bajaRotacion',this.value)">
      <button class="btn btn-ghost btn-sm" onclick="removeCylinder(${i})">🗑</button>
    </div>
  `).join("");
}

// ELIMINAR
function confirmDelete(){
  const c=clientes[selected];
  document.getElementById("confirm-title").innerText="Eliminar cliente";
  document.getElementById("confirm-msg").innerText=`¿Eliminar a "${c.nombre}"? Esta acción no se puede deshacer.`;
  document.getElementById("confirm-ok").onclick=doDelete;
  document.getElementById("confirm-box").style.display="flex";
}

function doDelete(){
  clientes.splice(selected,1);
  save(); closeConfirm(); closeDetalle(); render();
}

function closeConfirm(){
  document.getElementById("confirm-box").style.display="none";
}

// REPORTES
function openReportes(){
  document.getElementById("overlay-reportes").style.display="flex";
  renderReportes();
}

function closeReportes(){
  document.getElementById("overlay-reportes").style.display="none";
}

function agruparPorGas(){
  const porGas={};
  clientes.forEach(c=>{
    (c.cilindros||[]).forEach(g=>{
      if(!porGas[g.gas]) porGas[g.gas]={total:0,bajaRotacion:0,clientes:new Set()};
      porGas[g.gas].total+=g.cantidad;
      porGas[g.gas].bajaRotacion+=(g.bajaRotacion||0);
      porGas[g.gas].clientes.add(c.nombre);
    });
  });
  return porGas;
}

function renderReportes(){
  let enMora=0, mesesAcumulados=0, totalCil=0;
  clientes.forEach(c=>{
    const d=mesesDesde(c.pagoHasta);
    if(d!==null&&d>=3){ enMora++; mesesAcumulados+=d; }
    totalCil+=totalTubos(c);
  });

  document.getElementById("rep-summary").innerHTML = `
    <div class="report-box"><div class="rnum">${clientes.length}</div><div class="rlabel">Clientes totales</div></div>
    <div class="report-box"><div class="rnum" style="color:var(--red)">${enMora}</div><div class="rlabel">En mora (+3 meses)</div></div>
    <div class="report-box"><div class="rnum">${mesesAcumulados}</div><div class="rlabel">Meses acumulados de atraso</div></div>
    <div class="report-box"><div class="rnum">${totalCil}</div><div class="rlabel">Cilindros totales</div></div>
  `;

  const porGas=agruparPorGas();
  const gasKeys=Object.keys(porGas).sort();
  const tbody=document.getElementById("rep-gas-body");
  if(!gasKeys.length){
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text3);font-style:italic;padding:14px">Sin cilindros cargados todavía.</td></tr>';
  } else {
    tbody.innerHTML=gasKeys.map(g=>{
      const r=porGas[g];
      return `<tr><td>${g}</td><td>${r.total}</td><td>${r.bajaRotacion}</td><td>${r.clientes.size}</td></tr>`;
    }).join("");
  }
}

// AYUDA
function openAyuda(){
  document.getElementById("overlay-ayuda").style.display="flex";
}
function closeAyuda(){
  document.getElementById("overlay-ayuda").style.display="none";
}

// EXPORT EXCEL
function styleHeader(ws, lastCol){
  const header = ws.getRow(1);
  header.height = 20;
  header.eachCell(cell=>{
    cell.font = { bold:true, color:{argb:"FFFFFFFF"} };
    cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF1E293B"} };
    cell.alignment = { vertical:"middle" };
  });
  ws.autoFilter = { from:"A1", to:lastCol+"1" };
}

async function exportExcel(){
  const wb = new ExcelJS.Workbook();
  wb.creator = "Control Operativo Cilindros";
  wb.created = new Date();

  // ---- Hoja Clientes ----
  const wsClientes = wb.addWorksheet("Clientes", { views:[{ state:"frozen", ySplit:1 }] });
  wsClientes.columns = [
    { header:"Nombre", key:"nombre", width:26 },
    { header:"Estado", key:"estado", width:14 },
    { header:"Pago hasta", key:"pago", width:12 },
    { header:"Meses deuda", key:"meses", width:12 },
    { header:"Total cilindros", key:"total", width:15 },
    { header:"Baja rotación", key:"rot", width:14 },
    { header:"Notas", key:"notas", width:40 }
  ];
  clientes.forEach(c=>{
    const d = mesesDesde(c.pagoHasta);
    const row = wsClientes.addRow({
      nombre:c.nombre,
      estado:c.estado,
      pago:c.pagoHasta||"",
      meses: d===null?"-":d<0?"Al día":d,
      total:totalTubos(c),
      rot:totalBajaRotacion(c),
      notas:c.notas||""
    });
    let fill=null;
    if(d!==null&&d>=3) fill="FFFEF2F2";
    else if(c.estado==="Pendiente") fill="FFFFFBEB";
    else if(c.estado==="Pagado") fill="FFF0FDF4";
    if(fill) row.eachCell(cell=>{ cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}}; });
  });
  styleHeader(wsClientes, "G");

  // ---- Hoja Cilindros ----
  const wsCilindros = wb.addWorksheet("Cilindros", { views:[{ state:"frozen", ySplit:1 }] });
  wsCilindros.columns = [
    { header:"Cliente", key:"cliente", width:26 },
    { header:"Gas", key:"gas", width:18 },
    { header:"Cantidad", key:"cant", width:12 },
    { header:"Baja rotación", key:"rot", width:14 }
  ];
  clientes.forEach(c=>{
    (c.cilindros||[]).forEach(g=>{
      const row=wsCilindros.addRow({ cliente:c.nombre, gas:g.gas, cant:g.cantidad, rot:g.bajaRotacion||0 });
      if(g.bajaRotacion>0) row.eachCell(cell=>{ cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFFF7ED"}}; });
    });
  });
  styleHeader(wsCilindros, "D");

  // ---- Hoja Reporte por gas ----
  const wsReporte = wb.addWorksheet("Reporte por gas", { views:[{ state:"frozen", ySplit:1 }] });
  wsReporte.columns = [
    { header:"Gas", key:"gas", width:18 },
    { header:"Total", key:"total", width:10 },
    { header:"Baja rotación", key:"rot", width:14 },
    { header:"Clientes", key:"clientes", width:10 }
  ];
  const porGas = agruparPorGas();
  let sumTotal=0, sumRot=0;
  Object.keys(porGas).sort().forEach(g=>{
    const r=porGas[g];
    wsReporte.addRow({ gas:g, total:r.total, rot:r.bajaRotacion, clientes:r.clientes.size });
    sumTotal+=r.total; sumRot+=r.bajaRotacion;
  });
  const totalRow = wsReporte.addRow({ gas:"TOTAL", total:sumTotal, rot:sumRot, clientes:"" });
  totalRow.font = { bold:true };
  totalRow.eachCell(cell=>{ cell.border = { top:{style:"thin"} }; });
  styleHeader(wsReporte, "D");

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type:"application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clientes_"+mesActual()+".xlsx";
  a.click();
}

// RENDER PRINCIPAL
function render(){
  const panel=document.getElementById("panel");
  const q=document.getElementById("search").value.toLowerCase();
  const sortBy=document.getElementById("sort-select").value;

  populateGasFilter();
  const fGas=document.getElementById("filtro-gas").value;
  const fDesde=document.getElementById("filtro-desde").value;
  const fHasta=document.getElementById("filtro-hasta").value;

  let tot=0,pend=0,pag=0,urg=0,porVencer=0;
  clientes.forEach(c=>{
    tot++;
    if(c.estado==="Pendiente") pend++;
    else if(c.estado==="Pagado") pag++;
    const d=mesesDesde(c.pagoHasta);
    if(d!==null&&d>=3) urg++;
    else if(d!==null&&d>=0&&d<=2) porVencer++;
  });
  document.getElementById("cnt-todos").innerText=tot;
  document.getElementById("cnt-pendiente").innerText=pend;
  document.getElementById("cnt-pagado").innerText=pag;
  document.getElementById("cnt-urgente").innerText=urg;
  document.getElementById("cnt-porvencer").innerText=porVencer;

  let lista=clientes.map((c,i)=>({c,i})).filter(({c})=>{
    if(q&&!c.nombre.toLowerCase().includes(q)) return false;
    const d=mesesDesde(c.pagoHasta);
    if(filtroActivo==="urgente"){
      if(!(d!==null&&d>=3)) return false;
    } else if(filtroActivo==="porvencer"){
      if(!(d!==null&&d>=0&&d<=2)) return false;
    } else if(filtroActivo!=="todos"&&c.estado!==filtroActivo){
      return false;
    }
    if(fGas && !(c.cilindros||[]).some(g=>g.gas===fGas)) return false;
    if(fDesde && (!c.pagoHasta || c.pagoHasta<fDesde)) return false;
    if(fHasta && (!c.pagoHasta || c.pagoHasta>fHasta)) return false;
    return true;
  });

  lista.sort((a,b)=>{
    if(sortBy==="nombre") return a.c.nombre.localeCompare(b.c.nombre);
    if(sortBy==="meses"){
      const da=mesesDesde(a.c.pagoHasta)??-999;
      const db=mesesDesde(b.c.pagoHasta)??-999;
      return db-da;
    }
    if(sortBy==="estado"){
      const ord={"Pendiente":0,"Pagado":1};
      return (ord[a.c.estado]??9)-(ord[b.c.estado]??9);
    }
    return 0;
  });

  if(!lista.length){
    panel.innerHTML=`
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>${q||filtroActivo!=="todos"?"No hay clientes que coincidan con ese filtro.":"Agregá tu primer cliente con el botón de arriba."}</p>
      </div>`;
    return;
  }

  panel.innerHTML=lista.map(({c,i})=>{
    const d=mesesDesde(c.pagoHasta);
    const urgente=d!==null&&d>=3;
    const cls=urgente?"urgente":c.estado==="Pendiente"?"pendiente":"pagado";
    const statPill=c.estado==="Pendiente"?"pill-yellow":"pill-green";
    const tot=totalTubos(c);
    const rot=totalBajaRotacion(c);

    return `
      <div class="card ${cls}">
        <div style="flex:1;min-width:0">
          <div class="card-name">${c.nombre}</div>
          <div class="card-pills">
            <span class="pill ${statPill}">${c.estado}</span>
            ${urgente?`<span class="pill pill-red">⚠️ ${d} meses sin pagar</span>`:(d!==null&&d>=0&&d<=2)?`<span class="pill pill-orange">🔜 ${mesesTexto(d)}</span>`:`<span class="pill pill-gray">📅 ${mesesTexto(d)}</span>`}
            ${tot>0?`<span class="pill pill-gray">🛢️ ${tot} cilindros</span>`:""}
            ${rot>0?`<span class="pill pill-orange">📦 ${rot} baja rot.</span>`:""}
            ${c.notas?`<span class="pill pill-gray" title="${c.notas.substring(0,80)}">📝 nota</span>`:""}
          </div>
        </div>
        <div class="card-right">
          <button class="btn btn-sm" onclick="openDetalle(${i})">Ver →</button>
        </div>
      </div>
    `;
  }).join("");
}

// Cerrar con click fuera
["overlay-detalle","overlay-add"].forEach(id=>{
  document.getElementById(id).addEventListener("click",function(e){
    if(e.target===this) this.style.display="none";
  });
});

// INIT
cargarDatos();
