import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const configured =
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_URL.includes("TU_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("TU_");

const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

let guests = [];
let reservations = [];
let scanner = null;
let channel = null;

/* =========================================================
   CONTROL DEL ESCÁNER
   ========================================================= */

let scannerLocked = false;
let lastScannedCode = null;
let lastScannedAt = 0;

const SCAN_COOLDOWN_MS = 8000;

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function toast(message) {
  const el = $("#toast");

  if (!el) {
    console.log(message);
    return;
  }

  el.textContent = message;
  el.classList.remove("hidden");

  setTimeout(() => {
    el.classList.add("hidden");
  }, 3000);
}

/* =========================================================
   AUTENTICACIÓN
   ========================================================= */

async function initAuth() {
  if (!configured) {
    alert("Supabase no está configurado.");
    return;
  }

  const {
    data: { session },
  } = await sb.auth.getSession();

  if (session) {
    showApp(session);
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp(session);
    } else {
      showLogin();
    }
  });
}

function showLogin() {
  const login = $("#loginView");
  const app = $("#appView");

  if (login) login.classList.remove("hidden");
  if (app) app.classList.add("hidden");
}

async function showApp(session) {
  const login = $("#loginView");
  const app = $("#appView");

  if (login) login.classList.add("hidden");
  if (app) app.classList.remove("hidden");

  const userEmail = $("#userEmail");

  if (userEmail) {
    userEmail.textContent = session.user.email || "";
  }

  await refreshAll();
  setupRealtime();
}

const loginForm = $("#loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("#email").value.trim();
    const password = $("#password").value;

    const { error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  });
}

const logoutBtn = $("#logoutBtn");

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await stopScanner();
    await sb.auth.signOut();
  };
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

$$(".tab").forEach((button) => {
  button.addEventListener("click", async () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");

    $$(".view").forEach((view) => view.classList.remove("active"));

    const target = document.getElementById(button.dataset.view);

    if (target) {
      target.classList.add("active");
    }

    if (button.dataset.view === "scanner") {
      scannerLocked = false;
      await startScanner();
    } else {
      await stopScanner();
    }
  });
});

/* =========================================================
   CARGA DE DATOS
   ========================================================= */

async function refreshAll() {
  await Promise.all([
    loadGuests(),
    loadReservations(),
    loadStats(),
  ]);
}

const refreshBtn = $("#refreshBtn");

if (refreshBtn) {
  refreshBtn.onclick = refreshAll;
}

async function loadGuests() {
  const { data, error } = await sb
    .from("invitados")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  guests = data || [];
  renderGuests();
}

async function loadReservations() {
  const { data, error } = await sb
    .from("reservaciones")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  reservations = data || [];
  renderReservations();
}

async function loadStats() {
  const total = guests.length;

  const paid = guests.filter(
    (g) => g.estado_pago === "PAGADO"
  ).length;

  const pending = guests.filter(
    (g) => g.estado_pago !== "PAGADO"
  ).length;

  const entered = guests.filter(
    (g) => g.ingreso === true
  ).length;

  const paidAtDoor = guests.filter(
    (g) => g.pagado_en_entrada === true
  ).length;

  if ($("#statTotal")) $("#statTotal").textContent = total;
  if ($("#statPaid")) $("#statPaid").textContent = paid;
  if ($("#statPending")) $("#statPending").textContent = pending;
  if ($("#statEntered")) $("#statEntered").textContent = entered;
  if ($("#statDoor")) $("#statDoor").textContent = paidAtDoor;
}

/* =========================================================
   INVITADOS
   ========================================================= */

function renderGuests() {
  const container = $("#guestList");

  if (!container) return;

  if (!guests.length) {
    container.innerHTML = "<p>No hay invitados registrados.</p>";
    return;
  }

  container.innerHTML = guests
    .map(
      (g) => `
      <div class="guest-row">
        <div>
          <strong>${esc(g.nombre || "")}</strong>
          <div class="mini">${esc(g.codigo || "")}</div>
        </div>

        <div>
          ${
            g.estado_pago === "PAGADO"
              ? "PAGADO"
              : "PENDIENTE"
          }
        </div>

        <div>
          ${
            g.ingreso
              ? "YA INGRESÓ"
              : "NO HA INGRESADO"
          }
        </div>
      </div>
    `
    )
    .join("");
}

/* =========================================================
   RESERVACIONES
   ========================================================= */

function renderReservations() {
  const container = $("#reservationList");

  if (!container) return;

  if (!reservations.length) {
    container.innerHTML = "<p>No hay reservaciones.</p>";
    return;
  }

  container.innerHTML = reservations
    .map(
      (r) => `
      <div class="reservation-row">
        <div>
          <strong>${esc(r.folio || "")}</strong>
          <div>${esc(r.contacto_nombre || "")}</div>
        </div>

        <div>
          ${r.cantidad || 0} boletos
        </div>

        <div>
          ${money(r.total)}
        </div>

        <div>
          ${esc(r.estado || "")}
        </div>
      </div>
    `
    )
    .join("");
}

/* =========================================================
   ESCÁNER QR
   ========================================================= */

function renderWaitingScanner() {
  const box = $("#scanResult");

  if (!box) return;

  box.className = "result neutral";

  box.innerHTML = `
    <div class="result-icon">🎟️</div>
    <h2>Esperando boleto</h2>
    <p>Escanea el QR del invitado.</p>
  `;
}

/*
  Esta función es la parte importante.

  Cuando detecta un QR:
  1. bloquea nuevas lecturas;
  2. coloca el código en el campo manual;
  3. PAUSA la cámara;
  4. valida una sola vez;
  5. muestra el resultado;
  6. espera 5 segundos;
  7. permite escanear el siguiente.
*/

async function handleScannedCode(decodedText) {
  const code = String(decodedText || "").trim();

  if (!code) return;

  if (scannerLocked) {
    return;
  }

  const now = Date.now();

  if (
    code === lastScannedCode &&
    now - lastScannedAt < SCAN_COOLDOWN_MS
  ) {
    return;
  }

  scannerLocked = true;
  lastScannedCode = code;
  lastScannedAt = now;

  /*
    Confirmación visual:
    si la cámara realmente leyó el QR,
    veremos inmediatamente el código aquí.
  */
  const manualField = $("#manualCode");

  if (manualField) {
    manualField.value = code;
  }

  /*
    PAUSAMOS la cámara.
    No usamos stop() aquí porque algunos
    navegadores móviles pueden bloquearse
    al detenerla desde el callback.
  */
  try {
    if (scanner) {
      scanner.pause(true);
    }
  } catch (error) {
    console.warn("No se pudo pausar la cámara:", error);
  }

  const box = $("#scanResult");

  if (box) {
    box.className = "result neutral";

    box.innerHTML = `
      <div class="result-icon">📸</div>
      <h2>QR capturado</h2>
      <p>Validando boleto...</p>
    `;
  }

  try {
    await validate(code);
  } catch (error) {
    console.error("Error al validar:", error);

    if (box) {
      box.className = "result danger";

      box.innerHTML = `
        <div class="result-icon">⛔</div>
        <h2>Error de validación</h2>
        <p>No fue posible validar el boleto.</p>
      `;
    }
  }

  renderNextScanButton();
}

/* =========================================================
   ESPERA ENTRE BOLETOS
   ========================================================= */

function renderNextScanButton() {
  const box = $("#scanResult");

  if (!box) return;

  const actions = document.createElement("div");

  actions.className = "scan-actions";

  actions.innerHTML = `
    <button
      id="nextScanBtn"
      class="btn primary"
      type="button"
      disabled
    >
      Espera 5 segundos...
    </button>
  `;

  box.appendChild(actions);

  const btn = $("#nextScanBtn");

  let seconds = 5;

  const timer = setInterval(() => {
    seconds--;

    if (seconds > 0) {
      btn.textContent =
        `Espera ${seconds} segundos...`;

      return;
    }

    clearInterval(timer);

    btn.disabled = false;

    btn.textContent =
      "Escanear siguiente boleto";

    btn.onclick = async () => {
      scannerLocked = false;

      if ($("#manualCode")) {
        $("#manualCode").value = "";
      }

      renderWaitingScanner();

      try {
        if (scanner) {
          scanner.resume();
        } else {
          await startScanner();
        }
      } catch (error) {
        console.warn(
          "No se pudo reanudar el escáner:",
          error
        );

        scanner = null;

        await startScanner();
      }
    };
  }, 1000);
}

/* =========================================================
   INICIAR CÁMARA
   ========================================================= */

async function startScanner() {
  if (!$("#reader")) {
    return;
  }

  /*
    Si ya existe un escáner, no creamos otro.
  */
  if (scanner) {
    try {
      scanner.resume();
      return;
    } catch (error) {
      console.log(
        "Se creará nuevamente el escáner."
      );
    }
  }

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      {
        facingMode: "environment",
      },
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
      },

      /*
        CALLBACK CORRECTO DEL QR
      */
      async (decodedText) => {
        console.log(
          "QR DETECTADO:",
          decodedText
        );

        await handleScannedCode(
          decodedText
        );
      },

      () => {
        /*
          Este callback recibe intentos
          donde todavía no hay QR legible.
          No hacemos nada.
        */
      }
    );

    renderWaitingScanner();
  } catch (error) {
    console.error(
      "Error iniciando cámara:",
      error
    );

    const box = $("#scanResult");

    if (box) {
      box.className = "result danger";

      box.innerHTML = `
        <div class="result-icon">📷</div>
        <h2>No se pudo abrir la cámara</h2>
        <p>
          Revisa los permisos de cámara
          del navegador.
        </p>
      `;
    }

    scanner = null;
  }
}

/* =========================================================
   DETENER CÁMARA
   ========================================================= */

async function stopScanner() {
  if (!scanner) {
    return;
  }

  try {
    await scanner.stop();
  } catch (error) {
    console.warn(
      "No se pudo detener el escáner:",
      error
    );
  }

  try {
    scanner.clear();
  } catch (error) {
    console.warn(error);
  }

  scanner = null;
}

/* =========================================================
   VALIDAR BOLETO
   ========================================================= */

async function validate(code) {
  const cleanCode =
    String(code || "").trim();

  if (!cleanCode) {
    return;
  }

  const box = $("#scanResult");

  /*
    Buscamos el boleto en Supabase.
  */
  const { data, error } = await sb
    .from("invitados")
    .select("*")
    .eq("codigo", cleanCode)
    .maybeSingle();

  if (error) {
    console.error(error);

    box.className = "result danger";

    box.innerHTML = `
      <div class="result-icon">⛔</div>

      <h2>Error</h2>

      <p>
        No se pudo consultar el boleto.
      </p>
    `;

    return;
  }

  /*
    QR inexistente.
  */
  if (!data) {
    box.className = "result danger";

    box.innerHTML = `
      <div class="result-icon">❌</div>

      <h2>BOLETO NO VÁLIDO</h2>

      <p>
        No encontramos este código.
      </p>

      <strong>
        NO PUEDE PASAR
      </strong>
    `;

    return;
  }

  /*
    El boleto todavía no está pagado.
  */
  if (data.estado_pago !== "PAGADO") {
    box.className = "result danger";

    box.innerHTML = `
      <div class="result-icon">💳</div>

      <h2>
        ${esc(data.nombre)}
      </h2>

      <p>
        BOLETO NO PAGADO
      </p>

      <strong>
        NO PUEDE PASAR
      </strong>
    `;

    return;
  }

  /*
    Ya fue utilizado.
  */
  if (data.ingreso === true) {
    box.className = "result danger";

    box.innerHTML = `
      <div class="result-icon">⚠️</div>

      <h2>
        ${esc(data.nombre)}
      </h2>

      <p>
        BOLETO YA UTILIZADO
      </p>

      <strong>
        NO PUEDE PASAR
      </strong>
    `;

    return;
  }

  /*
    IMPORTANTE:
    Solo aquí marcamos el boleto
    como utilizado.
  */

  const { error: updateError } = await sb
    .from("invitados")
    .update({
      ingreso: true,
      fecha_ingreso:
        new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("ingreso", false);

  if (updateError) {
    console.error(updateError);

    box.className = "result danger";

    box.innerHTML = `
      <div class="result-icon">⛔</div>

      <h2>Error</h2>

      <p>
        No fue posible registrar
        el acceso.
      </p>
    `;

    return;
  }

  /*
    ACCESO CORRECTO
  */

  box.className = "result success";

  box.innerHTML = `
    <div class="result-icon">✅</div>

    <h2>
      ${esc(data.nombre)}
    </h2>

    <p>
      BOLETO PAGADO
    </p>

    <strong>
      PUEDE PASAR
    </strong>
  `;

  await refreshAll();
}

/* =========================================================
   VALIDACIÓN MANUAL
   ========================================================= */

const manualBtn = $("#manualBtn");

if (manualBtn) {
  manualBtn.onclick = () => {
    handleScannedCode(
      $("#manualCode").value
    );
  };
}

const manualCode = $("#manualCode");

if (manualCode) {
  manualCode.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter") {
        handleScannedCode(
          e.target.value
        );
      }
    }
  );
}

/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {
  if (channel) {
    return;
  }

  channel = sb
    .channel("fiesta15-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "invitados",
      },
      async () => {
        await refreshAll();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reservaciones",
      },
      async () => {
        await refreshAll();
      }
    )
    .subscribe();
}

/* =========================================================
   INICIO
   ========================================================= */

initAuth();
