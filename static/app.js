"use strict";
const $ = (s) => document.querySelector(s);
const WIN_ORDER = ["five_hour", "seven_day", "seven_day_sonnet"];
let charts = {};
let refreshTimer = null;

// --- formatadores ------------------------------------------------------------
function fmtTokens(n) {
  n = n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " K";
  return String(Math.round(n));
}
function fmtMoney(n, cur) {
  if (n == null) return "—";
  const sym = cur === "BRL" ? "R$ " : (cur ? cur + " " : "$ ");
  return sym + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function cls(status) { return (status || "indeterminado").toLowerCase(); }
function fmtDuration(h) {
  if (h == null) return "—";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return (hh > 0 ? hh + "h " : "") + mm + "m";
}
function localTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// --- banner: total absoluto (quase em tempo real) ---------------------------
let lastTotal = 0, countAnim = null;
function animateCount(el, from, to, dur = 1100) {
  if (countAnim) cancelAnimationFrame(countAnim);
  const start = performance.now(), diff = to - from;
  function step(now) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = Math.round(from + diff * eased).toLocaleString("pt-BR");
    if (t < 1) countAnim = requestAnimationFrame(step);
  }
  countAnim = requestAnimationFrame(step);
}
async function pollTotal() {
  let t;
  try { t = await (await fetch("/api/total")).json(); } catch (e) { return; }
  animateCount($("#heroTotal"), lastTotal || t.total_tokens, t.total_tokens);
  lastTotal = t.total_tokens;
  $("#heroCost").textContent = "$ " + t.total_cost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("#heroTurns").textContent = t.total_turns.toLocaleString("pt-BR");
}

// --- render principal --------------------------------------------------------
async function loadState() {
  let s;
  try { s = await (await fetch("/api/state")).json(); }
  catch (e) { $("#status").textContent = "erro de conexão"; return; }

  // status de conexão
  const st = $("#status");
  if (s.auth_connected) { st.textContent = "conta conectada"; st.className = "status ok"; $("#reconnect").classList.add("hidden"); }
  else { st.textContent = "desconectado"; st.className = "status off"; $("#reconnect").classList.remove("hidden"); }
  $("#updated").textContent = "atualizado " + localTime(s.generated_at) +
    (s.snapshot_ts ? "" : " · sem snapshot ainda");
  if (s.config) {
    $("#refreshSeconds").value = s.config.refresh_seconds;
    $("#curLabel").textContent = s.config.currency || "BRL";
    if (s.config.intended_hours) $("#intendedHours").value = String(s.config.intended_hours);
    scheduleRefresh(s.config.refresh_seconds);
  }

  renderVerdict(s.switch, s.windows, s.dominant_model);
  renderWindows(s.windows);
  renderExtra(s.extra_usage);
  renderHistory(s.history);
}

function renderVerdict(sw, windows, dominant) {
  const card = $("#verdictCard");
  if (!sw) { card.className = "verdict card status-indeterminado"; $("#verdictMsg").textContent = "Coletando dados…"; return; }
  card.className = "verdict card status-" + cls(sw.verdict);
  $("#verdictMsg").textContent = sw.message;
  const w5 = sw.windows.five_hour, w7 = sw.windows.seven_day;
  let parts = [];
  if (w5) parts.push(`sessão → ${Math.round(w5.projected)}%`);
  if (w7) parts.push(`semana → ${Math.round(w7.projected)}%`);
  $("#verdictDetail").innerHTML =
    `Se trabalhar mais ${sw.intended_hours}h no Opus: ${parts.join(" · ")}` +
    `<br><span class="muted">modelo atual: ${shortModel(dominant)} · Opus pesa ~${sw.factor}× mais · estimativa</span>`;
}

function shortModel(m) {
  if (!m) return "—";
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  return m;
}

function renderWindows(windows) {
  const el = $("#windows"); el.innerHTML = "";
  WIN_ORDER.forEach((k) => {
    const w = windows[k]; if (!w) return;
    const c = cls(w.status);
    const util = w.utilization != null ? Math.round(w.utilization) : "—";
    const proj = w.projected != null ? Math.round(w.projected) : null;
    const eta = w.eta_100 ? `<div class="win-line eta">bate 100% ~${localTime(w.eta_100)}</div>` : "";
    el.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="win-head">
          <span class="win-name">${w.label}</span>
          <span><span class="dot ${c}"></span>${w.status}</span>
        </div>
        <div class="win-util">${util}%</div>
        <div class="bar"><i class="${c}" style="width:${Math.min(util, 100)}%"></i></div>
        <div class="win-proj">projeção no reset: <b>${proj != null ? proj + "%" : "—"}</b></div>
        <div class="win-line">reseta em ${fmtDuration(w.hours_to_reset)} · ${localTime(w.resets_at)}</div>
        ${eta}
      </div>`);
  });
}

function renderExtra(eu) {
  const el = $("#extraRow"); el.innerHTML = "";
  if (!eu) return;
  const pct = (eu.limit && eu.used != null) ? Math.round(eu.used / eu.limit * 100) : null;
  el.insertAdjacentHTML("beforeend", `
    <div class="card">
      <div class="win-head"><span class="win-name">Excedente (créditos)</span></div>
      <div class="win-util" style="font-size:26px">${fmtMoney(eu.used, eu.currency)}</div>
      <div class="win-line">${eu.limit != null ? "limite " + fmtMoney(eu.limit, eu.currency) + (pct != null ? ` · ${pct}%` : "") : "sem limite definido"}</div>
    </div>`);
}

function renderHistory(h) {
  const el = $("#history"); el.innerHTML = "";
  const labels = { geral: "Geral", mes: "Este mês", semana: "Esta semana", dia: "Hoje" };
  ["geral", "mes", "semana", "dia"].forEach((sc) => {
    const d = h[sc]; if (!d) return;
    el.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="hist-scope">${labels[sc]}</div>
        <div class="hist-tokens">${fmtTokens(d.total_tokens)} <span class="muted" style="font-size:13px">tokens</span></div>
        <div class="hist-row"><span>custo estimado</span><b>$ ${d.total_cost.toFixed(2)}</b></div>
        <div class="hist-row"><span>horas ativas</span><b>${d.active_hours}</b></div>
        <div class="hist-row"><span>média / hora</span><b>${fmtTokens(d.tokens_per_hour)}</b></div>
        <div class="hist-row"><span>custo / hora</span><b>$ ${d.cost_per_hour.toFixed(2)}</b></div>
      </div>`);
  });
}

// --- gráficos ----------------------------------------------------------------
async function loadHistory() {
  let h;
  try { h = await (await fetch("/api/history")).json(); } catch (e) { return; }
  drawDaily(h.daily);
  drawHour(h.hour_of_day);
  drawSnap(h.snapshots);
}

const GRID = "#403b34", TICK = "#a39a8c";
function baseOpts(extra) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: TICK } } },
    scales: {
      x: { ticks: { color: TICK }, grid: { color: GRID } },
      y: { ticks: { color: TICK }, grid: { color: GRID } }
    }
  }, extra || {});
}
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($("#" + id), cfg);
}
function drawDaily(daily) {
  mkChart("chartDaily", {
    type: "bar",
    data: {
      labels: daily.map((d) => d.day.slice(5)),
      datasets: [{ label: "tokens", data: daily.map((d) => d.tokens), backgroundColor: "#d97757" }]
    },
    options: baseOpts()
  });
}
function drawHour(hod) {
  const byHour = {}; hod.forEach((r) => byHour[r.hour] = r.avg_tokens);
  const labels = [...Array(24).keys()];
  mkChart("chartHour", {
    type: "bar",
    data: {
      labels: labels.map((h) => h + "h"),
      datasets: [{ label: "média de tokens", data: labels.map((h) => byHour[h] || 0), backgroundColor: "#5cae7a" }]
    },
    options: baseOpts()
  });
}
function drawSnap(snaps) {
  const wins = { five_hour: "Sessão (5h)", seven_day: "Semana (7d)", seven_day_sonnet: "Sonnet (7d)" };
  const colors = { five_hour: "#d97757", seven_day: "#e0a83e", seven_day_sonnet: "#5cae7a" };
  const tsSet = [...new Set(snaps.map((s) => s.ts))].sort();
  const datasets = Object.keys(wins).map((w) => {
    const m = {}; snaps.filter((s) => s.window === w).forEach((s) => m[s.ts] = s.utilization);
    return { label: wins[w], data: tsSet.map((t) => m[t] ?? null), borderColor: colors[w], spanGaps: true, tension: .3 };
  });
  mkChart("chartSnap", {
    type: "line",
    data: { labels: tsSet.map((t) => localTime(t)), datasets },
    options: baseOpts({ scales: { y: { min: 0, suggestedMax: 100, ticks: { color: TICK }, grid: { color: GRID } }, x: { ticks: { color: TICK, maxTicksLimit: 8 }, grid: { color: GRID } } } })
  });
}

// --- interações --------------------------------------------------------------
function scheduleRefresh(sec) {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { loadState(); loadHistory(); }, Math.max(15, sec) * 1000);
}
async function postJSON(url, body) {
  return (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })).json();
}
$("#saveConfig").onclick = async () => {
  const sec = parseInt($("#refreshSeconds").value, 10);
  await postJSON("/api/config", { refresh_seconds: sec });
  $("#configMsg").textContent = "salvo ✓"; setTimeout(() => $("#configMsg").textContent = "", 2000);
  loadState();
};
$("#intendedHours").onchange = async () => {
  await postJSON("/api/config", { intended_hours: parseFloat($("#intendedHours").value) });
  loadState();
};
$("#refreshNow").onclick = async () => { $("#refreshNow").textContent = "atualizando…"; await postJSON("/api/refresh", {}); await loadState(); await loadHistory(); $("#refreshNow").textContent = "Atualizar agora"; };
$("#reconnect").onclick = async () => { await fetch("/auth/start"); $("#status").textContent = "abrindo login…"; };

// --- start -------------------------------------------------------------------
loadState();
loadHistory();
pollTotal();
setInterval(pollTotal, 4000);   // banner quase em tempo real
