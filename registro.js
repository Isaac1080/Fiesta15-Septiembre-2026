import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const PRICE = 50;
const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN" }).format(v);
const esc = (v="") => String(v).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));

const ref = new URLSearchParams(location.search).get("ref") || "";
const refBanner = document.querySelector("#refBanner");
if (ref && refBanner) {
  refBanner.classList.remove("hidden");
  refBanner.textContent = `Invitación compartida por: ${ref}`;
}

function addAttendee() {
  const row = document.createElement("div");
  row.className = "attendee-row";
  row.innerHTML = '<input class="attendee-name" placeholder="Nombre completo del asistente" required><button type="button" class="btn danger small remove-attendee">Eliminar</button>';
  row.querySelector(".remove-attendee").onclick = () => { row.remove(); updateTotal(); };
  $("#attendees").appendChild(row);
  updateTotal();
}

function updateTotal() {
  const n = document.querySelectorAll(".attendee-row").length;
  $("#attendeeCount").textContent = n;
  $("#amountTotal").textContent = money(n * PRICE);
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(String(value));
    alert(`${label} copiado.`);
  } catch {
    const temp = document.createElement("textarea");
    temp.value = String(value);
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    alert(`${label} copiado.`);
  }
}

$("#addAttendee").onclick = addAttendee;
addAttendee();

$("#showLookup").onclick=()=>{
  $("#lookupPanel").classList.toggle("hidden");
  if(!$("#lookupPanel").classList.contains("hidden")) $("#lookupFolio").focus();
};

function normalizePhone(v=""){ return v.replace(/\D/g,""); }

$("#lookupBtn").onclick=async()=>{
  const folio=$("#lookupFolio").value.trim().toUpperCase();
  const telefono=normalizePhone($("#lookupPhone").value);
  const msg=$("#lookupMessage");
  msg.textContent="";
  if(!folio || telefono.length<7){
    msg.textContent="Captura un folio válido y el teléfono registrado.";
    return;
  }
  const {data,error}=await sb.rpc("recuperar_reservacion_publica",{
    p_folio:folio,
    p_telefono:telefono
  });
  if(error){
    msg.textContent="No se pudo consultar la reservación.";
    return;
  }
  const r=Array.isArray(data)?data[0]:data;
  if(!r || !r.public_token){
    msg.textContent="No encontramos una reservación que coincida con esos datos.";
    return;
  }
  sessionStorage.setItem("fiesta15_token",r.public_token);
  location.href=`./estado.html?token=${encodeURIComponent(r.public_token)}`;
};


$("#reservationForm").addEventListener("submit", async e => {
  e.preventDefault();
  const personas = [...document.querySelectorAll(".attendee-name")].map(x => x.value.trim()).filter(Boolean);
  if (!personas.length) return alert("Agrega al menos un asistente.");

  const { data, error } = await sb.rpc("crear_reservacion_publica", {
    p_contacto_nombre: $("#contactName").value.trim(),
    p_contacto_telefono: $("#contactPhone").value.trim(),
    p_contacto_email: $("#contactEmail").value.trim() || null,
    p_invitado_por: ref,
    p_personas: personas
  });

  if (error) return alert(error.message);
  const r = Array.isArray(data) ? data[0] : data;
  sessionStorage.setItem("fiesta15_token", r.public_token);
  showReservation(r);
});

async function showReservation(r) {
  $("#reservationForm").classList.add("hidden");
  const b = await fetch("./datos_bancarios.json").then(x => x.json()).catch(() => ({}));
  const clabe = b.clabe_cuenta || "PENDIENTE";
  const box = $("#reservationResult");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="flag-big">🎟️</div>
    <h2>Reservación creada</h2>
    <p>Guarda tu folio y realiza la transferencia por el total indicado.</p>
    <div class="save-folio-box">
      <h3>Guarda tu folio</h3>
      <p>Lo necesitarás junto con tu número de WhatsApp para consultar después el estado de tu pago y tus boletos.</p>
      <div class="folio-big">${esc(r.folio)}</div>
      <div class="copy-actions">
        <button id="copyFolio" type="button" class="btn secondary">Copiar folio</button>
        <button id="shareWhatsapp" type="button" class="btn secondary">Guardar en WhatsApp</button>
      </div>
    </div>
    <div class="receipt">
      <div><span>Folio</span><strong>${esc(r.folio)}</strong></div>
      <div><span>Boletos</span><strong>${r.cantidad}</strong></div>
      <div><span>Precio unitario</span><strong>${money(PRICE)}</strong></div>
      <div><span>Total</span><strong>${money(r.total)}</strong></div>
      <div><span>Estado</span><strong>PENDIENTE DE PAGO</strong></div>
    </div>
    <div class="bank-box">
      <h3>Datos para transferencia</h3>
      <p><strong>Banco:</strong> ${esc(b.banco || "PENDIENTE")}</p>
      <p><strong>Beneficiario:</strong> ${esc(b.beneficiario || "PENDIENTE")}</p>
      <div class="copy-row">
        <div><strong>CLABE:</strong><br><span class="copy-value">${esc(clabe)}</span></div>
        <button id="copyClabe" type="button" class="btn secondary small">Copiar CLABE</button>
      </div>
      <div class="copy-row">
        <div><strong>Concepto / referencia:</strong><br><span class="copy-value">${esc(r.folio)}</span></div>
        <button id="copyConcept" type="button" class="btn secondary small">Copiar concepto</button>
      </div>
      <p class="mini">Usa el folio como concepto de la transferencia para facilitar la identificación del pago.</p>
    </div>
    <h3>Subir comprobante</h3>
    <input id="proofFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf">
    <button id="uploadProof" class="btn primary full">Enviar comprobante</button>
    <a class="btn secondary full link-btn" href="./estado.html?token=${encodeURIComponent(r.public_token)}">Consultar estado</a>`;

  $("#copyClabe").onclick = () => copyText(clabe, "CLABE");
  $("#copyConcept").onclick = () => copyText(r.folio, "Concepto");
  $("#uploadProof").onclick = () => uploadProof(r.public_token);
}

async function uploadProof(token) {
  const f = $("#proofFile").files[0];
  if (!f) return alert("Selecciona una imagen o PDF.");
  if (f.size > 8388608) return alert("Máximo 8 MB.");
  const ext = (f.name.split(".").pop() || "bin").toLowerCase();
  const path = `${token}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from("comprobantes-pago").upload(path, f, { upsert:false, contentType:f.type });
  if (upErr) return alert(upErr.message);
  const { error } = await sb.rpc("registrar_comprobante_publico", { p_token:token, p_path:path });
  if (error) return alert(error.message);
  alert("Comprobante enviado. Quedó pendiente de validación.");
  location.href = `./estado.html?token=${encodeURIComponent(token)}`;
}
