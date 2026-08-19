import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const configured=!SUPABASE_URL.includes("PEGA_AQUI")&&!SUPABASE_PUBLISHABLE_KEY.includes("PEGA_AQUI");
const sb=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;let guests=[],reservations=[],scanner=null,channel=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],safe=(x="")=>String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])),fullName=g=>`${g.nombre||""} ${g.apellido||""}`.trim(),whenMX=iso=>iso?new Date(iso).toLocaleString("es-MX"):"—";
function toast(msg,ms=2800){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),ms)}
function makeCode(){const t=crypto.getRandomValues(new Uint32Array(2));return `F15-${t[0].toString(36).toUpperCase()}${t[1].toString(36).toUpperCase()}`}
function guard(){if(configured)return true;alert("Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en config.js. Revisa README.md.");return false}
async function init(){if(!guard())return;const{data:{session}}=await sb.auth.getSession();await setSession(session);sb.auth.onAuthStateChange(async(_,s)=>await setSession(s))}
async function setSession(s){if(!s){$("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden");unsub();return}$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");$("#userLabel").textContent=s.user.email||"Organizador";await loadGuests();await loadReservations();await loadLogs();sub()}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!guard())return;const{error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)toast("No se pudo iniciar sesión: "+error.message,5000)});$("#logoutBtn").onclick=()=>sb.auth.signOut();
$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.view).classList.add('active');b.dataset.view==='scanner'?startScanner():stopScanner()});
async function loadGuests(){const{data,error}=await sb.from('invitados').select('*').order('created_at',{ascending:false});if(error)return toast('Error cargando invitados: '+error.message,5000);guests=data||[];renderGuests();renderStats()}
function renderStats(){$('#sTotal').textContent=guests.length;$('#sPaid').textContent=guests.filter(g=>g.pagado).length;$('#sUnpaid').textContent=guests.filter(g=>!g.pagado).length;$('#sEntered').textContent=guests.filter(g=>g.fecha_ingreso).length;$('#sPendingArrival').textContent=guests.filter(g=>g.pagado&&!g.fecha_ingreso).length}
function renderGuests(){const q=$('#guestSearch').value.trim().toLowerCase(),rows=guests.filter(g=>`${g.codigo} ${g.nombre} ${g.apellido} ${g.invitado_por}`.toLowerCase().includes(q));$('#guestRows').innerHTML=rows.map(g=>`<tr><td><strong>${safe(g.codigo)}</strong></td><td>${safe(fullName(g))}</td><td>${safe(g.invitado_por)}</td><td><span class="badge ${g.pagado?'paid':'unpaid'}">${g.pagado?'PAGADO':'NO PAGADO'}</span></td><td><span class="badge ${g.fecha_ingreso?'entered':'pending'}">${g.fecha_ingreso?'YA INGRESÓ':'PENDIENTE'}</span></td><td><button class="btn small secondary" data-qr="${g.id}">Ver QR</button></td><td><div class="actions"><button class="btn small ${g.pagado?'warning':'primary'}" data-pay="${g.id}">${g.pagado?'Marcar no pagado':'Marcar pagado'}</button>${g.fecha_ingreso?`<button class="btn small warning" data-reset="${g.id}">Revertir entrada</button>`:''}<button class="btn small danger" data-del="${g.id}">Eliminar</button></div></td></tr>`).join('');$$('[data-qr]').forEach(b=>b.onclick=()=>showQR(b.dataset.qr));$$('[data-pay]').forEach(b=>b.onclick=()=>togglePaid(b.dataset.pay));$$('[data-reset]').forEach(b=>b.onclick=()=>resetEntry(b.dataset.reset));$$('[data-del]').forEach(b=>b.onclick=()=>deleteGuest(b.dataset.del))}
$('#guestSearch').oninput=renderGuests;
$('#guestForm').addEventListener('submit',async e=>{e.preventDefault();const row={codigo:makeCode(),nombre:$('#gName').value.trim(),apellido:$('#gLastName').value.trim(),invitado_por:$('#gHost').value.trim(),cuenta_pago:$('#gAccount').value.trim(),pagado:$('#gPaid').value==='true'};const{data,error}=await sb.from('invitados').insert(row).select().single();if(error)return toast('No se pudo agregar: '+error.message,5000);e.target.reset();await loadGuests();showQR(data.id);toast('Invitado agregado.')});
async function togglePaid(id){const g=guests.find(x=>x.id===id);if(!g)return;const{error}=await sb.from('invitados').update({pagado:!g.pagado}).eq('id',id);error?toast(error.message,5000):loadGuests()}
async function resetEntry(id){if(!confirm('¿Revertir el registro de entrada?'))return;const{error}=await sb.rpc('revertir_entrada',{p_invitado_id:id});if(error)toast(error.message,5000);else{toast('Entrada revertida.');loadGuests();loadLogs()}}
async function deleteGuest(id){const g=guests.find(x=>x.id===id);if(!g||!confirm(`¿Eliminar a ${fullName(g)}?`))return;const{error}=await sb.from('invitados').delete().eq('id',id);error?toast(error.message,5000):loadGuests()}
function showQR(id){const g=guests.find(x=>x.id===id);if(!g)return;$('#qrGuestName').textContent=fullName(g);$('#qrGuestCode').textContent=g.codigo;$('#qrcode').innerHTML='';new QRCode($('#qrcode'),{text:g.codigo,width:250,height:250});$('#qrModal').classList.remove('hidden')}
$('#closeQr').onclick=()=>$('#qrModal').classList.add('hidden');$('#printQr').onclick=()=>window.print();$('#qrModal').onclick=e=>{if(e.target.id==='qrModal')$('#qrModal').classList.add('hidden')};
async function validate(code){code=(code||'').trim();if(!code)return;const box=$('#scanResult');box.className='result neutral';box.innerHTML='<div class="result-icon">⏳</div><h2>Validando…</h2>';const{data,error}=await sb.rpc('validar_y_registrar_entrada',{p_codigo:code});if(error){box.className='result danger';box.innerHTML=`<div class="result-icon">⛔</div><h2>ERROR</h2><p>${safe(error.message)}</p>`;return}const r=Array.isArray(data)?data[0]:data;if(!r||r.resultado==='NO_EXISTE'){box.className='result danger';box.innerHTML='<div class="result-icon">⛔</div><h2>BOLETO NO VÁLIDO</h2>';return}const nm=safe(`${r.nombre} ${r.apellido}`);if(r.resultado==='NO_PAGADO'){box.className='result danger';box.innerHTML=`<div class="result-icon">❌</div><div class="name">${nm}</div><div class="big">BOLETO NO PAGADO</div><h2>NO PUEDE PASAR</h2>`;return}if(r.resultado==='YA_UTILIZADO'){box.className='result warning';box.innerHTML=`<div class="result-icon">⚠️</div><div class="name">${nm}</div><div class="big">BOLETO YA UTILIZADO</div><h2>NO PUEDE PASAR</h2><p>Entrada: ${safe(whenMX(r.fecha_ingreso))}</p>`;return}box.className='result success';box.innerHTML=`<div class="result-icon">✅</div><div class="name">${nm}</div><div class="big">BOLETO PAGADO</div><h2>PUEDE PASAR</h2><p>Entrada registrada automáticamente.</p>`;await loadGuests();await loadLogs()}
$('#manualBtn').onclick=()=>validate($('#manualCode').value);$('#manualCode').addEventListener('keydown',e=>{if(e.key==='Enter')validate(e.target.value)});

function renderNextScanButton(){
  const box = document.getElementById("scanResult");
  if(!box) return;
  let actions = box.querySelector(".scan-actions");
  if(!actions){
    actions = document.createElement("div");
    actions.className = "scan-actions";
    box.appendChild(actions);
  }
  actions.innerHTML = `<button id="nextScanBtn" class="btn primary" disabled>Espera 5 segundos…</button>`;
  let seconds = 5;
  const btn = document.getElementById("nextScanBtn");
  const timer = setInterval(()=>{
    seconds--;
    if(seconds > 0){
      btn.textContent = `Espera ${seconds} segundos…`;
    } else {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "Escanear siguiente boleto";
      btn.onclick = async ()=>{
        scannerLocked = false;
        document.getElementById("scanResult").className = "result neutral";
        document.getElementById("scanResult").innerHTML =
          '<div class="result-icon">🎟️</div><h2>Esperando boleto</h2><p>Escanea el siguiente QR.</p>';
        await startScanner();
      };
    }
  },1000);
}

async function handleScannedCode(decodedText){
  const code = String(decodedText || "").trim();
  if(!code || scannerLocked) return;

  const now = Date.now();
  if(code === lastScannedCode && (now - lastScannedAt) < SCAN_COOLDOWN_MS){
    return;
  }

  scannerLocked = true;
  lastScannedCode = code;
  lastScannedAt = now;

  await stopScanner();

  const box = document.getElementById("scanResult");
  box.className = "result neutral";
  box.innerHTML = '<div class="result-icon">📸</div><h2>QR capturado</h2><p>Validando boleto…</p>';

  await validate(code);
  renderNextScanButton();
}

async function startScanner(){if(scanner||typeof Html5Qrcode==='undefined')return;scanner=new Html5Qrcode('reader');try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},decoded=>handleScannedCode(decoded),()=>{})}catch(e){$('#reader').innerHTML='<p style="padding:18px;color:#66736d">No se pudo abrir la cámara. Revisa permisos y usa HTTPS.</p>';scanner=null}}
async function stopScanner(){if(!scanner)return;try{await scanner.stop();scanner.clear()}catch{}scanner=null}
async function loadLogs(){const{data,error}=await sb.from('registro_entradas').select('id,created_at,resultado,codigo,invitado_nombre').order('created_at',{ascending:false}).limit(500);if(error)return;$('#logRows').innerHTML=(data||[]).map(l=>`<tr><td>${safe(whenMX(l.created_at))}</td><td>${safe(l.invitado_nombre||'—')}</td><td>${safe(l.codigo||'—')}</td><td><strong>${safe(l.resultado)}</strong></td></tr>`).join('')}
$('#reloadLogs').onclick=loadLogs;$('#refreshBtn').onclick=()=>{loadGuests();loadReservations();loadLogs()};
function parseCSV(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++}else if(c==='"')q=!q;else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);return rows}
$('#importBtn').onclick=async()=>{const f=$('#csvFile').files[0];if(!f)return toast('Selecciona un CSV.');const matrix=parseCSV(await f.text());if(matrix.length<2)return toast('El archivo está vacío.');const headers=matrix[0].map(x=>x.trim().toLowerCase()),req=['nombre','apellido','invitado_por','cuenta_pago','pagado'],missing=req.filter(x=>!headers.includes(x));if(missing.length)return toast('Faltan columnas: '+missing.join(', '),5000);const idx=Object.fromEntries(headers.map((h,i)=>[h,i])),payload=matrix.slice(1).filter(r=>r[idx.nombre]?.trim()).map(r=>({codigo:makeCode(),nombre:(r[idx.nombre]||'').trim(),apellido:(r[idx.apellido]||'').trim(),invitado_por:(r[idx.invitado_por]||'').trim(),cuenta_pago:(r[idx.cuenta_pago]||'').trim(),pagado:['si','sí','true','1','pagado'].includes((r[idx.pagado]||'').trim().toLowerCase())}));const{error}=await sb.from('invitados').insert(payload);if(error)return toast('Error importando: '+error.message,6000);$('#importSummary').textContent=`Importación completada: ${payload.length} invitados.`;toast(`${payload.length} invitados importados.`);await loadGuests()};
function sub(){unsub();channel=sb.channel('fiesta15-live').on('postgres_changes',{event:'*',schema:'public',table:'invitados'},()=>loadGuests()).on('postgres_changes',{event:'*',schema:'public',table:'reservaciones'},()=>loadReservations()).on('postgres_changes',{event:'INSERT',schema:'public',table:'registro_entradas'},()=>loadLogs()).subscribe(s=>{$('#connectionStatus').textContent=s==='SUBSCRIBED'?'🟢 Sincronización en tiempo real activa':'🟡 Estado: '+s})}function unsub(){if(channel&&sb){sb.removeChannel(channel);channel=null}}
init();

async function loadReservations(){
  const {data,error}=await sb.from("reservaciones").select("*").order("created_at",{ascending:false});
  if(error){toast("Error cargando reservaciones: "+error.message,5000);return;}
  reservations=data||[];
  const body=document.querySelector("#reservationRows");
  if(body){
    body.innerHTML=reservations.map(r=>`<tr><td><strong>${safe(r.folio)}</strong></td><td>${safe(r.contacto_nombre)}<br><span class="mini">${safe(r.contacto_telefono)}</span></td><td>${safe(r.invitado_por||"—")}</td><td>${r.cantidad}</td><td>$${Number(r.total).toFixed(2)}</td><td><span class="badge ${r.estado==="PAGADO"?"paid":r.estado==="RECHAZADO"?"unpaid":"pending"}">${safe(r.estado)}</span></td><td>${r.comprobante_path?`<button class="btn small secondary" data-proof="${safe(r.comprobante_path)}">Ver</button>`:"—"}</td><td><div class="actions">${r.estado==="COMPROBANTE_ENVIADO"?`<button class="btn small primary" data-approve="${safe(r.id)}">Aprobar pago</button><button class="btn small danger" data-reject="${safe(r.id)}">Rechazar</button>`:""}</div></td></tr>`).join("");
    document.querySelectorAll("[data-proof]").forEach(b=>b.onclick=()=>openProof(b.dataset.proof));
    document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>approveReservation(b.dataset.approve));
    document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>rejectReservation(b.dataset.reject));
  }
  renderFamilyStats();
}
async function openProof(path){const {data,error}=await sb.storage.from("comprobantes-pago").createSignedUrl(path,300);if(error)return toast(error.message,5000);window.open(data.signedUrl,"_blank","noopener")}
async function approveReservation(id){if(!confirm("¿Confirmas que el pago llegó a la cuenta?"))return;const {error}=await sb.rpc("aprobar_reservacion",{p_reservacion_id:id});if(error)return toast(error.message,5000);toast("Pago aprobado y boletos generados.");await loadReservations();await loadGuests()}
async function rejectReservation(id){if(!confirm("¿Rechazar este comprobante?"))return;const {error}=await sb.rpc("rechazar_reservacion",{p_reservacion_id:id});if(error)return toast(error.message,5000);await loadReservations()}
const rr=document.querySelector("#reloadReservations");if(rr)rr.onclick=loadReservations;


function normalizeFamilyName(v){return String(v||"").trim()||"Sin referencia"}
function renderFamilyStats(){
  const body=document.querySelector("#familyStatsRows"); if(!body)return;
  const grouped=new Map();
  for(const r of reservations){
    const name=normalizeFamilyName(r.invitado_por);
    if(!grouped.has(name))grouped.set(name,{reservas:0,asistentes:0,esperado:0,pagado:0,validacion:0,pendiente:0});
    const g=grouped.get(name); g.reservas++; g.asistentes+=Number(r.cantidad)||0; g.esperado+=Number(r.total)||0;
    if(r.estado==="PAGADO")g.pagado+=Number(r.total)||0;
    else if(r.estado==="COMPROBANTE_ENVIADO")g.validacion+=Number(r.total)||0;
    else g.pendiente+=Number(r.total)||0;
  }
  const rows=[...grouped.entries()].sort((a,b)=>b[1].asistentes-a[1].asistentes || a[0].localeCompare(b[0],"es"));
  body.innerHTML=rows.length?rows.map(([name,g])=>`<tr><td><strong>${safe(name)}</strong></td><td>${g.reservas}</td><td>${g.asistentes}</td><td>$${g.esperado.toFixed(2)}</td><td><span class="badge paid">$${g.pagado.toFixed(2)}</span></td><td>$${g.validacion.toFixed(2)}</td><td>$${g.pendiente.toFixed(2)}</td></tr>`).join(""):'<tr><td colspan="7" class="empty-cell">Todavía no hay reservaciones con referencia de familiar.</td></tr>';
}
function buildFamilyLink(){
  const ref=(document.querySelector("#familyRef")?.value||"").trim();
  if(!ref)return toast("Escribe el nombre o apodo del familiar.");
  const url=new URL("./registro.html",location.href); url.searchParams.set("ref",ref);
  const result=document.querySelector("#familyLinkResult"),input=document.querySelector("#familyLink");
  input.value=url.href; result.classList.remove("hidden");
}
async function copyFamilyLink(){
  const input=document.querySelector("#familyLink"); if(!input?.value)return;
  try{await navigator.clipboard.writeText(input.value);toast("Enlace copiado. Ya puedes pegarlo en WhatsApp.");}
  catch{input.select();document.execCommand("copy");toast("Enlace copiado.");}
}
const familyGenerate=document.querySelector("#generateFamilyLink");if(familyGenerate)familyGenerate.onclick=buildFamilyLink;
const familyCopy=document.querySelector("#copyFamilyLink");if(familyCopy)familyCopy.onclick=copyFamilyLink;
const familyReload=document.querySelector("#reloadFamilyStats");if(familyReload)familyReload.onclick=loadReservations;
const familyRefInput=document.querySelector("#familyRef");if(familyRefInput)familyRefInput.addEventListener("keydown",e=>{if(e.key==="Enter")buildFamilyLink()});
