import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const state = {
  mode: "none", name: "", roomCode: "", started: false,
  stories: [], players: [], db: null, uid: null, roomRef: null,
  unsub: null, isHost: false, submitted: false
};
const statusEl = $("connectionStatus");
const imageCache = new Set();
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function cleanName(value) {
  return value.trim().replace(/[<>]/g, "").slice(0, 24);
}
function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function getPlayerName() {
  const name = cleanName($("playerName").value);
  if (!name) { toast("Digite seu nome primeiro."); $("playerName").focus(); return null; }
  return name;
}
function firebaseConfigured() {
  return firebaseConfig.databaseURL &&
    firebaseConfig.databaseURL.startsWith("https://") &&
    !firebaseConfig.databaseURL.includes("COLE_AQUI");
}
async function connectFirebase() {
  if (!firebaseConfigured()) throw new Error("Firebase ainda não configurado: falta a URL do Realtime Database em firebase-config.js.");
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  const dbMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const credential = await authMod.signInAnonymously(auth);
  state.uid = credential.user.uid;
  state.db = dbMod.getDatabase(app);
  state.dbMod = dbMod;
  statusEl.textContent = "Firebase conectado";
  statusEl.style.color = "var(--mint)";
}
function enterGame({ code, name, mode, host = false }) {
  state.mode = mode; state.name = name; state.roomCode = code; state.isHost = host;
  $("setupPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  $("roomTitle").textContent = `Sala ${code}`;
  $("activeRoomCode").textContent = code;
  $("roomHelp").textContent = mode === "demo" ? "Demonstração local neste navegador." : "Sala online com atualização em tempo real.";
  $("turnStatus").textContent = state.started ? "História em andamento" : "Aguardando início";
  renderPlayers(); renderStories();
}
function renderPlayers() {
  const players = state.players.length ? state.players : [{ id: state.uid || "local", name: state.name || "Você" }];
  $("playerCount").textContent = players.length;
  $("playerList").innerHTML = "";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    const avatar = document.createElement("span");
    avatar.className = "avatar"; avatar.textContent = (p.name || "?").slice(0,1).toUpperCase();
    const name = document.createElement("span"); name.textContent = p.name || "Jogador";
    li.append(avatar, name);
    if ((state.isHost && i === 0) || p.host) { const tag = document.createElement("small"); tag.textContent = "ANFITRIÃO"; li.append(tag); }
    $("playerList").append(li);
  });
}
function renderStories() {
  const root = $("storyList"); root.innerHTML = "";
  if (!state.stories.length) {
    const empty = document.createElement("div"); empty.className = "empty-story";
    empty.innerHTML = '<div class="empty-icon">📖</div><h3>Era uma vez...</h3><p>A primeira frase está esperando por vocês.</p>';
    root.append(empty); return;
  }
  state.stories.forEach((entry, index) => {
    const card = document.createElement("article"); card.className = "story-entry";
    const meta = document.createElement("div"); meta.className = "entry-meta";
    const avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = (entry.name || "?").slice(0,1).toUpperCase();
    const who = document.createElement("span"); who.textContent = `${entry.name || "Jogador"} · trecho ${index + 1}`;
    meta.append(avatar, who);
    const body = document.createElement("div"); body.className = "entry-text"; body.textContent = entry.text;
    card.append(meta, body); root.append(card);
    if (entry.text) searchImages(entry.text);
  });
  root.scrollTop = root.scrollHeight;
}
async function addStory() {
  const text = $("storyInput").value.trim();
  if (!text) { toast("Escreva um trecho antes de enviar."); return; }
  if (text.length > 500) { toast("O trecho deve ter até 500 caracteres."); return; }
  const entry = { name: state.name, text, at: Date.now(), uid: state.uid || "local" };
  if (state.mode === "online" && state.roomRef) {
    try { await state.dbMod.push(state.dbMod.ref(state.db, `${state.roomRef}/stories`), entry); }
    catch (e) { toast("Não foi possível enviar. Confira as regras do Firebase."); console.error(e); return; }
  } else {
    state.stories.push(entry);
    renderStories();
  }
  $("storyInput").value = ""; $("charCount").textContent = "0/500";
  toast("Trecho adicionado à história!");
}
function extractQuery(text) {
  const stop = new Set(["era","uma","vez","que","com","para","pela","pelo","num","numa","dos","das","de","do","da","e","o","a","os","as","um","uns","umas","no","na","em","por","se","foi","seu","sua","seus","suas","então","muito","muita","mais","mas","ele","ela","eles","elas","quando","onde","porque","como","até","depois","antes","sobre","entre","havia","tinha","estava","estavam","ser","ter"]);
  const words = (text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z]{3,}/g) || [])
    .filter(w => !stop.has(w));
  const counts = {};
  words.forEach(w => counts[w] = (counts[w] || 0) + 1);
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3).map(x=>x[0]).join(" ") || "fantasy story illustration";
}
async function searchImages(text) {
  const query = extractQuery(text);
  if (imageCache.has(query)) return;
  imageCache.add(query);
  $("imageStatus").textContent = `Procurando ilustrações para “${query}”…`;
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=6&license=cc0,pdm,by,by-sa`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Openverse respondeu ${response.status}`);
    const data = await response.json();
    const results = (data.results || []).filter(x => x.thumbnail && x.title && x.url);
    if (!results.length) {
      $("imageStatus").textContent = `Não encontrei imagens para “${query}”. Tente outro trecho.`;
      return;
    }
    $("imageStatus").textContent = `Resultados para “${query}” · imagens de fontes externas com licença indicada.`;
    const grid = $("imageGrid");
    results.forEach(item => {
      const card = document.createElement("article"); card.className = "image-card";
      const img = document.createElement("img");
      img.loading = "lazy"; img.src = item.thumbnail; img.alt = item.title || query;
      img.referrerPolicy = "no-referrer";
      img.onerror = () => { card.remove(); };
      const body = document.createElement("div"); body.className = "image-card-body";
      const title = document.createElement("div"); title.className = "image-card-title";
      title.textContent = item.title || "Imagem sem título";
      const link = document.createElement("a"); link.href = item.foreign_landing_url || item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = `Ver fonte · ${item.license || "licença"}`;
      body.append(title, link); card.append(img, body);
      grid.prepend(card);
    });
  } catch (err) {
    console.warn(err);
    $("imageStatus").textContent = "A busca de imagens falhou agora. Você ainda pode continuar a história; tente novamente com outro trecho.";
  }
}
async function createOnlineRoom() {
  const name = getPlayerName(); if (!name) return;
  try {
    await connectFirebase();
    const code = makeCode();
    state.roomRef = `rooms/${code}`;
    const { ref, set, onValue, onChildAdded } = state.dbMod;
    await set(ref(state.db, state.roomRef), {
      code, hostUid: state.uid, started: false, createdAt: Date.now(),
      players: { [state.uid]: { name, joinedAt: Date.now(), host: true } },
      stories: {}
    });
    state.players = [{ id: state.uid, name, host: true }];
    state.stories = [];
    enterGame({ code, name, mode: "online", host: true });
    watchRoom();
    toast("Sala online criada!");
  } catch (e) {
    console.error(e);
    $("setupMessage").textContent = `${e.message} Configure o Realtime Database e ative Authentication > Anonymous.`;
    toast("Não consegui criar a sala online. Veja a mensagem abaixo.");
  }
}
async function joinOnlineRoom() {
  const name = getPlayerName(); if (!name) return;
  const code = $("roomCode").value.trim().toUpperCase();
  if (!code) { toast("Digite o código da sala."); return; }
  try {
    await connectFirebase();
    const roomPath = `rooms/${code}`;
    const roomSnap = await state.dbMod.get(state.dbMod.ref(state.db, roomPath));
    if (!roomSnap.exists()) { toast("Sala não encontrada."); return; }
    state.roomRef = roomPath;
    await state.dbMod.set(state.dbMod.ref(state.db, `${roomPath}/players/${state.uid}`), { name, joinedAt: Date.now(), host: false });
    state.players = []; state.stories = [];
    enterGame({ code, name, mode: "online" });
    watchRoom();
    toast("Você entrou na sala!");
  } catch (e) {
    console.error(e); toast("Falha ao entrar. Confira o código e a configuração do Firebase.");
  }
}
function watchRoom() {
  if (state.unsub) state.unsub();
  const { ref, onValue } = state.dbMod;
  state.unsub = onValue(ref(state.db, state.roomRef), snap => {
    if (!snap.exists()) return;
    const room = snap.val();
    state.players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }));
    state.stories = Object.values(room.stories || {}).sort((a,b) => (a.at || 0) - (b.at || 0));
    state.isHost = room.hostUid === state.uid;
    state.started = !!room.started;
    $("turnStatus").textContent = state.started ? "História em andamento" : "Aguardando início";
    $("startBtn").textContent = state.started ? "História iniciada ✓" : "Começar história";
    $("startBtn").disabled = state.started || !state.isHost;
    renderPlayers(); renderStories();
  }, err => { console.error(err); toast("Conexão com a sala perdida."); });
}
async function startStory() {
  if (state.mode === "online") {
    if (!state.isHost) { toast("Só o anfitrião pode iniciar."); return; }
    try { await state.dbMod.update(state.dbMod.ref(state.db, state.roomRef), { started: true }); }
    catch (e) { toast("Não foi possível iniciar."); }
  } else {
    state.started = true; $("turnStatus").textContent = "História em andamento";
    $("startBtn").textContent = "História iniciada ✓"; $("startBtn").disabled = true;
    toast("A história começou!");
  }
}
function leaveRoom() {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  if (state.mode === "online" && state.db && state.uid && state.roomRef) {
    state.dbMod.remove(state.dbMod.ref(state.db, `${state.roomRef}/players/${state.uid}`)).catch(console.warn);
  }
  state.mode = "none"; state.roomCode = ""; state.roomRef = null; state.stories = []; state.players = []; state.started = false; state.isHost = false;
  $("gamePanel").classList.add("hidden"); $("setupPanel").classList.remove("hidden");
  $("storyInput").value = ""; $("imageGrid").innerHTML = ""; $("turnStatus").textContent = "Aguardando início";
  statusEl.textContent = "Modo demonstração";
  toast("Você saiu da sala.");
}

$("createRoomBtn").addEventListener("click", createOnlineRoom);
$("joinRoomBtn").addEventListener("click", joinOnlineRoom);
$("demoBtn").addEventListener("click", () => {
  const name = getPlayerName(); if (!name) return;
  state.stories = []; state.players = [{ id: "local", name, host: true }]; state.started = false;
  enterGame({ code: "DEMO", name, mode: "demo", host: true });
  statusEl.textContent = "Modo demonstração";
});
$("addStoryBtn").addEventListener("click", addStory);
$("storyInput").addEventListener("input", () => $("charCount").textContent = `${$("storyInput").value.length}/500`);
$("startBtn").addEventListener("click", startStory);
$("leaveBtn").addEventListener("click", leaveRoom);
$("copyCodeBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(state.roomCode); toast("Código copiado!"); }
  catch { toast(`Código da sala: ${state.roomCode}`); }
});
