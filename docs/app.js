// Default sites. Edit this list to change what appears on first load.
const DEFAULTS = [
  {name:"Facebook",url:"https://www.facebook.com",group:"social",color:"#1877f2"},
  {name:"Instagram",url:"https://www.instagram.com",group:"social",color:"#c13584"},
  {name:"X",url:"https://x.com",group:"social",color:"#111827"},
  {name:"LinkedIn",url:"https://www.linkedin.com",group:"social",color:"#0a66c2"},
  {name:"YouTube",url:"https://www.youtube.com",group:"social",color:"#e02424"},
  {name:"TikTok",url:"https://www.tiktok.com",group:"social",color:"#0f766e"},
  {name:"Telegram",url:"https://web.telegram.org",group:"social",color:"#229ed9"},
  {name:"WhatsApp",url:"https://web.whatsapp.com",group:"social",color:"#198754"},
  {name:"Reddit",url:"https://www.reddit.com",group:"social",color:"#e8590c"},
  {name:"Coursera",url:"https://www.coursera.org",group:"learning",color:"#0056d2"},
  {name:"Khan Academy",url:"https://www.khanacademy.org",group:"learning",color:"#2f855a"},
  {name:"edX",url:"https://www.edx.org",group:"learning",color:"#02262b"},
  {name:"Udemy",url:"https://www.udemy.com",group:"learning",color:"#a435f0"},
  {name:"freeCodeCamp",url:"https://www.freecodecamp.org",group:"learning",color:"#2b3a67"},
  {name:"Duolingo",url:"https://www.duolingo.com",group:"learning",color:"#58a700"},
  {name:"Wikipedia",url:"https://www.wikipedia.org",group:"learning",color:"#4b5563"},
  {name:"GitHub",url:"https://github.com",group:"learning",color:"#24292f"},
  {name:"Stack Overflow",url:"https://stackoverflow.com",group:"learning",color:"#f48024"}
];
const $ = s => document.querySelector(s);
const CACHE = "hub-cache-v2", THEME = "hub-theme", PW = "hub-pw";
const fresh = () => ({sites: DEFAULTS.map(s => ({...s, pinned:false}))});
let state;
try { state = JSON.parse(localStorage.getItem(CACHE)); } catch(e) {}
if (!state || !Array.isArray(state.sites)) state = fresh();

let statusTimer;
function showStatus(msg, err) {
  const el = $("#status"); el.textContent = msg; el.className = "status" + (err ? " err" : "");
  clearTimeout(statusTimer);
  if (!err && msg !== "Saving...") statusTimer = setTimeout(() => el.textContent = "", 2000);
}

// Where changes are saved: "server" (node server.js), "github" (GitHub Pages + repo file) or "local".
const CFG = window.HUB_CONFIG || {};
const useGh = !!CFG.repo && !CFG.repo.startsWith("YOUR-");
const TOKEN = "hub-gh-token";
let mode = "local", sha = null, saving = false, again = false;
const getTok = () => { try { return localStorage.getItem(TOKEN); } catch(e) { return null; } };
const ghUrl = () => `https://api.github.com/repos/${CFG.repo}/contents/${CFG.path || "docs/data/state.json"}`;
const ghHeaders = () => { const h = {Accept: "application/vnd.github+json"}; const t = getTok(); if (t) h.Authorization = "Bearer " + t; return h; };
const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
const valid = d => d && Array.isArray(d.sites);
const cacheIt = () => { try { localStorage.setItem(CACHE, JSON.stringify(state)); } catch(e) {} };

async function ghGet() {   // read the file through the GitHub API (also gives the version id needed to save)
  const r = await fetch(ghUrl() + "?ref=" + (CFG.branch || "main") + "&t=" + Date.now(), {headers: ghHeaders()});
  if (r.status === 404) { sha = null; return null; }
  if (r.status === 401) throw new Error("GitHub rejected the token. Click Connect GitHub to update it.");
  if (!r.ok) throw 0;
  const j = await r.json(); sha = j.sha; return JSON.parse(dec(j.content));
}
async function saveServer() {
  for (let i = 0; i < 2; i++) {
    const headers = {"Content-Type": "application/json"};
    const pw = sessionStorage.getItem(PW); if (pw) headers["x-edit-password"] = pw;
    const r = await fetch("/api/state", {method: "PUT", headers, body: JSON.stringify(state)});
    if (r.status === 401) {
      const p = i ? null : prompt("Enter the edit password to save changes:");
      if (p) { sessionStorage.setItem(PW, p); continue; }
      throw new Error("Not saved: password needed");
    }
    if (!r.ok) throw 0;
    showStatus("Saved on server"); return;
  }
}
async function saveGithub() {
  if (!getTok()) throw new Error("Saved on this device only. Click Connect GitHub to save for everyone.");
  if (sha === null) await ghGet();
  for (let i = 0; i < 2; i++) {
    const body = {message: "Update links", content: enc(JSON.stringify(state, null, 2)), branch: CFG.branch || "main"};
    if (sha) body.sha = sha;
    const r = await fetch(ghUrl(), {method: "PUT", headers: {...ghHeaders(), "Content-Type": "application/json"}, body: JSON.stringify(body)});
    if (r.ok) { sha = (await r.json()).content.sha; showStatus("Saved to GitHub"); return; }
    if (r.status === 409 || r.status === 422) { await ghGet(); continue; }   // file changed elsewhere: refresh version and retry
    if ([401, 403, 404].includes(r.status)) throw new Error("GitHub rejected the token. Click Connect GitHub to update it.");
    throw 0;
  }
  throw 0;
}
async function save() {
  cacheIt();
  if (saving) { again = true; return; }
  saving = true; showStatus("Saving...");
  try {
    if (mode === "server") await saveServer();
    else if (mode === "github") await saveGithub();
    else showStatus("Saved on this device only", true);
  } catch(e) { showStatus(e && e.message ? e.message : "Could not save. Changes are only on this device.", true); }
  saving = false;
  if (again) { again = false; save(); }
}

function apply(d) { if (valid(d)) { state = {sites: d.sites}; cacheIt(); render(); return true; } return false; }
function updateConnect() {
  const b = $("#connect"); b.hidden = mode !== "github";
  b.textContent = getTok() ? "Disconnect GitHub" : "Connect GitHub";
}
async function load() {
  try {   // 1. host server
    const r = await fetch("/api/state");
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
      mode = "server"; const d = await r.json();
      if (!apply(d) && d === null) save();   // first run: store the defaults
      return;
    }
  } catch(e) {}
  if (useGh) {   // 2. GitHub Pages: owner (with token) reads the API, visitors read the published file
    mode = "github"; updateConnect();
    try {
      if (getTok()) { const d = await ghGet(); if (!apply(d) && d === null) save(); }
      else { const r = await fetch("data/state.json", {cache: "no-store"}); if (r.ok) apply(await r.json()); }
      return;
    } catch(e) { showStatus(e && e.message ? e.message : "Could not load from GitHub. Showing the last saved copy.", true); return; }
  }
  mode = "local";   // 3. plain file or static host with no setup
  showStatus("Saved on this device only", true);
}

function card(site, i) {
  const a = document.createElement("a");
  a.className = "card"; a.href = site.url; a.target = "_blank"; a.rel = "noopener noreferrer";
  const host = new URL(site.url).hostname.replace(/^www\./,"");
  const tile = document.createElement("div");
  tile.className = "tile"; tile.style.background = site.color || "#2f5bea"; tile.textContent = site.name[0].toUpperCase();
  const txt = document.createElement("div");
  const n = document.createElement("div"); n.className = "name"; n.textContent = site.name;
  const h = document.createElement("div"); h.className = "host"; h.textContent = host;
  txt.append(n, h);
  const acts = document.createElement("div"); acts.className = "acts";
  const pin = document.createElement("button");
  pin.textContent = site.pinned ? "Unpin" : "Pin";
  pin.onclick = e => { e.preventDefault(); site.pinned = !site.pinned; save(); render(); };
  const del = document.createElement("button");
  del.textContent = "Remove"; del.onclick = e => { e.preventDefault(); state.sites.splice(i,1); save(); render(); };
  acts.append(pin, del);
  a.append(tile, txt, acts);
  return a;
}

function render() {
  const q = $("#search").value.trim().toLowerCase();
  const groups = {pinned:[], social:[], learning:[]};
  state.sites.forEach((s,i) => {
    if (q && !(s.name + " " + s.url).toLowerCase().includes(q)) return;
    if (s.pinned) groups.pinned.push(card(s,i));
    else groups[s.group].push(card(s,i));
  });
  for (const g in groups) $("#"+g).replaceChildren(...groups[g]);
  $("#pinned-wrap").hidden = !groups.pinned.length;
  $("#social").parentElement.hidden = !groups.social.length && !!q;
  $("#learning").parentElement.hidden = !groups.learning.length && !!q;
  $("#empty").hidden = !q || Object.values(groups).some(g => g.length);
}

function applyTheme() {
  const t = localStorage.getItem(THEME) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
}

$("#search").addEventListener("input", render);
$("#theme").onclick = () => { try { localStorage.setItem(THEME, document.documentElement.dataset.theme === "dark" ? "light" : "dark"); } catch(e) {} applyTheme(); };
$("#add").onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (state.sites.some(s => s.url.replace(/\/$/,"") === f.get("url").replace(/\/$/,""))) { showStatus("Already added", true); return; }
  const colors = ["#2f5bea","#0f766e","#b45309","#7c3aed","#be123c"];
  state.sites.push({name:f.get("name").trim(), url:f.get("url"), group:f.get("group"), color:colors[state.sites.length % colors.length], pinned:false});
  save(); e.target.reset(); render();
};

// Pick up changes made on other devices when the tab regains focus.
addEventListener("focus", load);

$("#connect").onclick = () => {
  if (getTok()) { if (confirm("Disconnect GitHub on this device?")) { try { localStorage.removeItem(TOKEN); } catch(e) {} } }
  else { const t = prompt("Paste your GitHub token (fine-grained, Contents: read and write, this repository only):"); if (t) { try { localStorage.setItem(TOKEN, t.trim()); } catch(e) {} } }
  updateConnect(); sha = null; load();
};
$("#export").onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "my-hub-links.json"; a.click();
  URL.revokeObjectURL(url);
};
$("#import").onchange = async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data.sites)) throw 0;
    state = {sites: data.sites}; save(); render();
  } catch(err) { showStatus("That file isn't a valid backup", true); }
  e.target.value = "";
};

const h = new Date().getHours();
$("#greeting").textContent = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
$("#today").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
applyTheme(); render(); load();
