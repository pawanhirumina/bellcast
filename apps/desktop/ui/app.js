/* Bellcast desktop SPA. Runs entirely from bundled local assets. */

const tauri = window.__TAURI__;
const invoke = tauri && tauri.core ? tauri.core.invoke : null;
const listen = tauri && tauri.event ? tauri.event.listen : null;

const TOPIC_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const THEMES = [
  {
    id: "light",
    label: "Light",
    note: "White canvas, aubergine accent",
    canvas: "#ffffff",
    panel: "#f4f2f6",
    accent: "#611f69",
  },
  {
    id: "dark",
    label: "Dark",
    note: "Slate canvas, green accent",
    canvas: "#1a1d21",
    panel: "#19171d",
    accent: "#007a5a",
  },
];

const ICONS = {
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bellOff:
    '<path d="M8.7 3A6 6 0 0 1 18 8c0 7 3 9 3 9H8"/><path d="M3 3l18 18"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M6 8a6 6 0 0 0 1.1 3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  inbox:
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  palette:
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c1.4 0 2.2-1.1 2.2-2.3 0-.7-.3-1.3-.7-1.8-.4-.5-.7-1-.7-1.7 0-1 .9-1.9 2-1.9H18a4 4 0 0 0 4-4c0-4.6-4.5-8.3-10-8.3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  sliders:
    '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  copy:
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash:
    '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  wifiOff:
    '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M15.5 6.2A15 15 0 0 1 22 8.8"/><path d="M5 12.6a10 10 0 0 1 5-2.4"/><path d="M14 10.2a10 10 0 0 1 5 2.4"/><path d="M12 20h.01"/>',
  external: '<path d="M7 17 17 7M9 7h8v8"/>',
  alert:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  logOut:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8M15 5l3 3M18 3l3 3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.1 6.1A17 17 0 0 0 2 11s3.5 7 10 7a10.8 10.8 0 0 0 4.5-1"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M2 2l20 20"/>',
};

function icon(name, extra) {
  const body = ICONS[name] || "";
  return `<svg class="icon${extra ? " " + extra : ""}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readTheme() {
  try {
    return localStorage.getItem("bellcast-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.dataset.themeChoice = next;
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem("bellcast-theme", next);
  } catch {
    /* storage can be unavailable */
  }
  return next;
}

const state = {
  ready: false,
  bootError: null,
  screen: "app",
  reconnect: false,
  config: { instance_url: "", has_key: false, paused: false },
  status: "connecting",
  statusMessage: "",
  ifaceOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  topics: [],
  messages: [],
  activeTopic: null,
  query: "",
  loading: false,
  loadError: null,
  hasMore: false,
  loadingOlder: false,
  olderError: null,
  actionError: null,
  sending: false,
  draft: "",
  composerTopic: "general",
  composerError: null,
  modalOpen: false,
  modalError: null,
  theme: readTheme(),
  themeOpen: false,
  health: null,
  healthError: null,
  healthLoading: false,
  busy: false,
  onboarding: {
    url: "",
    key: "",
    showKey: false,
    error: null,
    loading: false,
  },
};

let toastTimer = null;
let refreshToken = 0;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function showToast(message, kind) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = message;
  node.className = kind === "error" ? "toast error" : "toast";
  node.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.hidden = true;
  }, 3200);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
    } catch {
      /* ignore */
    }
    area.remove();
  }
  showToast(message || "Copied");
}

function errorText(error) {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error.message) return String(error.message);
  return String(error);
}

function sortedMessages() {
  return [...state.messages].sort((a, b) => a.seq - b.seq);
}

function messageTopics() {
  const seen = new Map();
  for (const message of state.messages) {
    const current = seen.get(message.topic);
    if (!current || message.seq > current.last_seq) {
      seen.set(message.topic, {
        topic: message.topic,
        last_seq: message.seq,
        last_message_at: message.created_at,
      });
    }
  }
  return seen;
}

function topicsForSidebar() {
  const merged = new Map();
  for (const topic of state.topics) {
    if (topic && topic.topic) merged.set(topic.topic, { ...topic });
  }
  for (const [name, summary] of messageTopics()) {
    const existing = merged.get(name);
    if (!existing || summary.last_seq > existing.last_seq) {
      merged.set(name, summary);
    }
  }
  if (state.activeTopic && !merged.has(state.activeTopic)) {
    merged.set(state.activeTopic, {
      topic: state.activeTopic,
      last_seq: 0,
      last_message_at: null,
    });
  }
  return [...merged.values()].sort((a, b) => {
    const left = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const right = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return right - left;
  });
}

function filteredMessages() {
  const needle = state.query.trim().toLowerCase();
  return sortedMessages().filter((message) => {
    if (state.activeTopic && message.topic !== state.activeTopic) return false;
    if (!needle) return true;
    return (
      (message.title || "").toLowerCase().includes(needle) ||
      (message.body || "").toLowerCase().includes(needle) ||
      (message.topic || "").toLowerCase().includes(needle) ||
      (message.tags || []).some((tag) =>
        String(tag).toLowerCase().includes(needle),
      )
    );
  });
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function relative(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function initials(value) {
  return String(value || "bc").slice(0, 2).toUpperCase();
}

function hue(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 360;
  }
  return hash;
}

function statusInfo() {
  switch (state.status) {
    case "live":
      return { label: "Connected", tone: "live" };
    case "paused":
      return { label: "Paused", tone: "warn" };
    case "offline":
      return { label: "Offline", tone: "warn" };
    case "unauthorized":
      return { label: "Key rejected", tone: "danger" };
    case "unconfigured":
      return { label: "Not connected", tone: "danger" };
    case "error":
      return { label: "Connection lost", tone: "danger" };
    default:
      return { label: "Connecting", tone: "warn" };
  }
}

function instanceBase() {
  return (state.config.instance_url || "").replace(/\/+$/, "");
}

function curlCommand() {
  const base = instanceBase() || "https://your-instance.example.com";
  const topic = state.activeTopic || state.composerTopic || "general";
  return `curl -X POST ${base}/api/v1/publish/${topic} \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Title: Hello from Bellcast" \\\n  -d "It works."`;
}

function themeSwatch(theme) {
  return `<span class="swatch" aria-hidden="true"><i style="background:${theme.canvas}"></i><i style="background:${theme.panel}"></i></span>`;
}

function sectionHead(name, title, description) {
  return `<div class="section-head">${icon(name)}<div><h2>${esc(title)}</h2>${
    description ? `<p>${esc(description)}</p>` : ""
  }</div></div>`;
}

/* ------------------------------------------------------------------ */
/* data loading                                                        */
/* ------------------------------------------------------------------ */

function mergeMessages(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const bySeq = new Map(state.messages.map((message) => [message.seq, message]));
  for (const message of incoming) {
    if (!message || typeof message.seq !== "number") continue;
    bySeq.set(message.seq, message);
  }
  state.messages = [...bySeq.values()];
}

async function loadTopics() {
  try {
    const result = await invoke("fetch_topics");
    if (result && Array.isArray(result.topics)) {
      state.topics = result.topics;
    }
  } catch {
    /* topics are a convenience; messages still load */
  }
}

async function refresh(options) {
  const settings = options || {};
  if (!invoke) return;
  const token = ++refreshToken;
  state.loading = true;
  state.loadError = null;
  if (!settings.quiet) {
    state.status = state.ifaceOnline ? "connecting" : "offline";
  }
  render();

  try {
    const args = { limit: 100 };
    if (state.activeTopic) args.topic = state.activeTopic;
    const [page] = await Promise.all([invoke("fetch_messages", args), loadTopics()]);
    if (token !== refreshToken) return;
    state.messages = page && Array.isArray(page.messages) ? page.messages : [];
    state.hasMore = !!(page && page.hasMore);
    state.loading = false;
    state.loadError = null;
    if (state.ifaceOnline) {
      state.status = state.status === "paused" ? "paused" : "live";
      state.statusMessage = "";
    }
    const newest = state.messages.reduce(
      (value, message) => Math.max(value, message.seq || 0),
      0,
    );
    if (newest > 0) {
      invoke("set_cursor", { seq: newest }).catch(() => undefined);
    }
  } catch (error) {
    if (token !== refreshToken) return;
    state.loading = false;
    state.loadError = errorText(error);
    if (/key|401|403|reject/i.test(state.loadError)) {
      state.status = "unauthorized";
    } else {
      state.status = state.ifaceOnline ? "error" : "offline";
    }
    state.statusMessage = state.loadError;
  }
  render();
  if (!settings.keepScroll) scrollToBottom();
}

async function boot() {
  if (!invoke) {
    state.bootError =
      "The desktop bridge is unavailable. Start Bellcast from the installed desktop app.";
    state.ready = true;
    render();
    return;
  }

  state.ready = false;
  try {
    const config = await invoke("get_config");
    state.config = {
      instance_url: (config && config.instance_url) || "",
      has_key: !!(config && config.has_key),
      paused: !!(config && config.paused),
    };
  } catch (error) {
    state.bootError = errorText(error);
    state.ready = true;
    render();
    return;
  }

  if (!state.config.instance_url || !state.config.has_key) {
    state.onboarding.url = state.config.instance_url || "";
    state.screen = "onboarding";
    state.ready = true;
    render();
    return;
  }

  state.screen = "app";
  state.ready = true;
  await refresh();
  scrollToBottom();
}

async function selectTopic(topic) {
  state.activeTopic = topic;
  state.screen = "app";
  state.query = "";
  state.draft = "";
  state.composerError = null;
  state.olderError = null;
  state.hasMore = false;
  render();
  await refresh();
}

async function loadOlder() {
  if (!invoke || state.loadingOlder || !state.hasMore) return;
  const current = sortedMessages().filter(
    (message) => !state.activeTopic || message.topic === state.activeTopic,
  );
  if (current.length === 0) return;
  state.loadingOlder = true;
  state.olderError = null;
  render();
  try {
    const args = { before: current[0].seq, limit: 100 };
    if (state.activeTopic) args.topic = state.activeTopic;
    const page = await invoke("fetch_messages", args);
    mergeMessages(page && page.messages ? page.messages : []);
    state.hasMore = !!(page && page.hasMore);
    state.olderError = null;
  } catch (error) {
    state.olderError = errorText(error);
  }
  state.loadingOlder = false;
  render();
}

async function loadHealth() {
  if (!invoke) return;
  state.healthLoading = true;
  state.healthError = null;
  render();
  try {
    state.health = await invoke("health");
  } catch (error) {
    state.health = null;
    state.healthError = errorText(error);
  }
  state.healthLoading = false;
  render();
}

async function setPaused(paused) {
  if (!invoke || state.busy) return;
  state.busy = true;
  try {
    await invoke("set_paused", { paused });
    state.config.paused = paused;
    state.status = paused ? "paused" : "live";
    state.statusMessage = paused ? "Notifications are paused." : "";
    showToast(paused ? "Notifications paused" : "Notifications resumed");
  } catch (error) {
    showToast(errorText(error), "error");
  }
  state.busy = false;
  render();
}

async function resetInstance() {
  if (!invoke || state.busy) return;
  const confirmed = window.confirm(
    "Disconnect this app and forget the saved instance URL and API key?",
  );
  if (!confirmed) return;
  state.busy = true;
  try {
    await invoke("reset_instance");
    state.config = { instance_url: "", has_key: false, paused: false };
    state.messages = [];
    state.topics = [];
    state.activeTopic = null;
    state.screen = "onboarding";
    state.reconnect = false;
    state.onboarding = {
      url: "",
      key: "",
      showKey: false,
      error: null,
      loading: false,
    };
    state.health = null;
    state.healthError = null;
    showToast("Instance disconnected");
  } catch (error) {
    showToast(errorText(error), "error");
  }
  state.busy = false;
  render();
}

async function connect() {
  if (!invoke || state.onboarding.loading) return;
  const url = state.onboarding.url.trim();
  const key = state.onboarding.key.trim();
  if (!url) {
    state.onboarding.error = "Enter the URL of your Bellcast instance.";
    render();
    return;
  }
  if (!key) {
    state.onboarding.error = "Enter the API key for this instance.";
    render();
    return;
  }
  if (!state.ifaceOnline) {
    state.onboarding.error =
      "You're offline. Reconnect to the internet before signing in.";
    render();
    return;
  }

  state.onboarding.loading = true;
  state.onboarding.error = null;
  render();
  try {
    const config = await invoke("save_config", {
      instanceUrl: url,
      apiKey: key,
    });
    state.config = {
      instance_url: (config && config.instance_url) || url,
      has_key: !!(config && config.has_key),
      paused: !!(config && config.paused),
    };
    state.onboarding.loading = false;
    state.onboarding.key = "";
    state.reconnect = false;
    state.screen = "app";
    state.status = "connecting";
    showToast("Connected to your instance");
    await refresh();
    scrollToBottom();
  } catch (error) {
    state.onboarding.loading = false;
    state.onboarding.error = errorText(error);
    render();
  }
}

async function sendMessage() {
  if (!invoke || state.sending) return;
  const body = state.draft.trim();
  if (!body) return;
  if (!state.ifaceOnline) {
    state.composerError = "You're offline. Reconnect before sending a message.";
    render();
    return;
  }
  const topic = (state.activeTopic || state.composerTopic || "general")
    .trim()
    .toLowerCase();
  if (!TOPIC_RE.test(topic)) {
    state.composerError =
      "Channels use lowercase letters, numbers, dashes or underscores.";
    render();
    return;
  }

  state.sending = true;
  state.composerError = null;
  updateSendButton();
  try {
    const result = await invoke("publish_message", {
      topic,
      body,
      title: null,
      priority: 2,
      tags: [],
      click: null,
    });
    const message = result && result.message ? result.message : result;
    if (message && typeof message.seq === "number") {
      mergeMessages([message]);
    }
    state.draft = "";
    state.composerError = null;
    state.sending = false;
    state.actionError = null;
    if (!state.activeTopic) state.composerTopic = topic;
    showToast(`Sent to #${topic}`);
    render();
    scrollToBottom();
  } catch (error) {
    state.sending = false;
    state.composerError = errorText(error);
    render();
  }
}

async function submitAdvanced(event) {
  if (!invoke) return;
  const form = event.target;
  const data = new FormData(form);
  const topic = String(data.get("topic") || "")
    .trim()
    .toLowerCase();
  const body = String(data.get("body") || "").trim();
  const title = String(data.get("title") || "").trim();
  const tags = String(data.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
  const click = String(data.get("click") || "").trim();
  const priority = Number(data.get("priority") || 2) || 2;

  const errorNode = document.getElementById("modal-error");
  function fail(message) {
    if (errorNode) {
      errorNode.textContent = message;
      errorNode.hidden = false;
    }
  }

  if (!TOPIC_RE.test(topic)) {
    fail("Channels use lowercase letters, numbers, dashes or underscores.");
    return;
  }
  if (!body && !title) {
    fail("Add a message or a title.");
    return;
  }
  if (!state.ifaceOnline) {
    fail("You're offline. Reconnect before publishing.");
    return;
  }
  if (click && !/^https?:\/\//i.test(click)) {
    fail("The click URL must start with http:// or https://.");
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;

  try {
    const result = await invoke("publish_message", {
      topic,
      body,
      title: title || null,
      priority,
      tags,
      click: click || null,
    });
    const message = result && result.message ? result.message : result;
    if (message && typeof message.seq === "number") {
      mergeMessages([message]);
    }
    state.modalOpen = false;
    state.modalError = null;
    state.screen = "app";
    if (state.activeTopic === topic) {
      state.actionError = null;
    }
    showToast(`Published to #${topic}`);
    render();
    if (state.activeTopic === topic || !state.activeTopic) scrollToBottom();
  } catch (error) {
    if (submit) submit.disabled = false;
    fail(errorText(error));
  }
}

async function deleteMessage(id) {
  if (!invoke) return;
  const message = state.messages.find((item) => item.id === id);
  if (!message) return;
  if (!window.confirm("Delete this message for everyone?")) return;

  try {
    await invoke("delete_message", { id });
    state.messages = state.messages.filter((item) => item.id !== id);
    state.actionError = null;
    showToast("Message deleted");
    render();
  } catch (error) {
    state.actionError = errorText(error);
    render();
  }
}

function openExternal(url) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    showToast("Only http(s) links can be opened.", "error");
    return;
  }
  if (invoke) {
    invoke("open_url", { url }).catch((error) =>
      showToast(errorText(error), "error"),
    );
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ------------------------------------------------------------------ */
/* live events                                                        */
/* ------------------------------------------------------------------ */

async function subscribe() {
  if (!listen) return;
  try {
    await listen("bellcast://messages", (event) => {
      mergeMessages(event.payload);
      state.loading = false;
      state.loadError = null;
      if (state.status === "offline" || state.status === "error") {
        state.status = "live";
        state.statusMessage = "";
      }
      if (state.screen === "settings") {
        render();
        return;
      }
      const nearBottom = isNearBottom();
      render();
      if (nearBottom) scrollToBottom();
    });

    await listen("bellcast://status", (event) => {
      const payload = event.payload || {};
      const next = String(payload.status || "");
      if (next) state.status = next;
      state.statusMessage = payload.message || "";
      if (next === "unconfigured" && state.screen !== "onboarding") {
        state.screen = "onboarding";
        state.onboarding.url = state.config.instance_url || "";
        state.onboarding.key = "";
      }
      render();
    });

    await listen("bellcast://reset", () => {
      state.messages = [];
      render();
      refresh({ keepScroll: false });
    });
  } catch {
    /* events are optional; manual refresh still works */
  }
}

function isNearBottom() {
  const node = document.querySelector(".scroll");
  if (!node) return true;
  return node.scrollHeight - node.scrollTop - node.clientHeight < 80;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const node = document.querySelector(".scroll");
    if (node) node.scrollTop = node.scrollHeight;
  });
}

/* ------------------------------------------------------------------ */
/* rendering                                                          */
/* ------------------------------------------------------------------ */

function render() {
  const root = document.getElementById("root");
  if (!root) return;

  applyTheme(state.theme);

  let focusId = null;
  let selectionStart = null;
  let selectionEnd = null;
  if (document.activeElement && document.activeElement.id) {
    focusId = document.activeElement.id;
    try {
      selectionStart = document.activeElement.selectionStart;
      selectionEnd = document.activeElement.selectionEnd;
    } catch {
      /* not a text input */
    }
  }
  const scrollNode = document.querySelector(".scroll");
  const scrollTop = scrollNode ? scrollNode.scrollTop : null;

  let html;
  if (!state.ready) html = renderBoot();
  else if (state.bootError) html = renderBootError();
  else if (state.screen === "onboarding") html = renderOnboarding();
  else html = renderShell();

  root.innerHTML = html;

  if (focusId) {
    const node = document.getElementById(focusId);
    if (node && typeof node.focus === "function") {
      node.focus();
      if (
        selectionStart != null &&
        typeof node.setSelectionRange === "function"
      ) {
        try {
          node.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (scrollTop != null) {
    const next = document.querySelector(".scroll");
    if (next) next.scrollTop = scrollTop;
  }

  const composer = document.getElementById("composer-input");
  if (composer && composer.value) {
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`;
  }
}

function renderBoot() {
  return `<div class="boot"><div class="spinner" aria-hidden="true"></div><p>Starting Bellcast…</p></div>`;
}

function renderBootError() {
  return `<div class="state-panel"><div class="state-icon">${icon(
    "alert",
  )}</div><h2>Bellcast could not start</h2><p>${esc(
    state.bootError,
  )}</p><div class="section-actions" style="justify-content:center"><button class="btn secondary" data-action="reload">${icon(
    "refresh",
    "icon-sm",
  )}Try again</button></div></div>`;
}

function renderOnboarding() {
  const onboard = state.onboarding;
  const themeButtons = THEMES.map(
    (theme) =>
      `<button type="button" data-action="set-theme" data-theme-id="${
        theme.id
      }" class="${state.theme === theme.id ? "active" : ""}" style="--swatch:${
        theme.accent
      }" aria-label="${esc(theme.label)} theme" title="${esc(
        theme.label,
      )}"></button>`,
  ).join("");

  return `<div class="onboarding">
    <div class="onboard-brand">
      <div class="brand-lockup">
        <span class="onboard-mark">${icon("bell")}</span>
        <div><h1>Bellcast</h1><span class="brand-sub">self-hosted notifications</span></div>
      </div>
      <p class="tagline">Notifications you own, delivered straight to your desktop.</p>
      <p class="lede">Bellcast keeps a connection open to your own instance and shows native notifications in the background. No accounts, no relay, no third party.</p>
      <ul class="onboard-list">
        <li>${icon("shield", "icon-sm")}<span>Your API key stays in a local config file with owner-only permissions.</span></li>
        <li>${icon("database", "icon-sm")}<span>Messages come directly from your instance. Nothing is proxied.</span></li>
        <li>${icon("clock", "icon-sm")}<span>Runs in the tray, starts with your session, and keeps the cursor between launches.</span></li>
      </ul>
    </div>
    <div class="onboard-form">
      <div class="form-inner">
        <h2>${state.reconnect ? "Reconnect your instance" : "Connect your instance"}</h2>
        <p class="sub">Use the address of your deployed Bellcast app and the API key from its environment.</p>
        <form id="connect-form" novalidate>
          <div class="field">
            <label for="connect-url">Instance URL</label>
            <input id="connect-url" name="url" type="url" inputmode="url" spellcheck="false"
              placeholder="https://bellcast.example.com" value="${esc(
                onboard.url,
              )}" autocomplete="off" data-focus="url" />
          </div>
          <div class="field">
            <label for="connect-key">API key</label>
            <div style="position:relative">
              <input id="connect-key" name="key" type="${
                onboard.showKey ? "text" : "password"
              }" spellcheck="false" placeholder="Paste your instance API key" value="${esc(
                onboard.key,
              )}" autocomplete="off" style="padding-right:38px" />
              <button type="button" class="icon-btn" data-action="toggle-key"
                style="position:absolute;right:3px;top:3px" aria-label="${
                  onboard.showKey ? "Hide API key" : "Show API key"
                }">${icon(onboard.showKey ? "eyeOff" : "eye", "icon-sm")}</button>
            </div>
          </div>
          ${
            onboard.error
              ? `<div class="form-error" role="alert">${icon(
                  "alert",
                  "icon-sm",
                )}<span>${esc(onboard.error)}</span></div>`
              : ""
          }
          <button class="btn" type="submit" style="width:100%;height:36px" ${
            onboard.loading ? "disabled" : ""
          }>${onboard.loading ? "Checking instance…" : "Connect"}</button>
          ${
            state.reconnect
              ? `<button class="btn ghost" type="button" data-action="cancel-reconnect" style="width:100%;margin-top:6px">Back to Bellcast</button>`
              : ""
          }
        </form>
        <p class="form-hint">The app checks <span style="font-family:var(--font-mono)">/api/v1/health</span> before saving. Keys are stored locally, never in the webview.</p>
        <div class="onboard-footer">
          <span>Bellcast Desktop v0.2.1</span>
          <div class="theme-strip" role="group" aria-label="Theme">${themeButtons}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderShell() {
  const main =
    state.screen === "settings" ? renderSettings() : renderConversation();
  return `<div class="app">${renderSidebar()}<div class="main">${renderTopbar()}${
    state.screen === "settings" ? "" : renderBanner()
  }${main}</div>${state.modalOpen ? renderModal() : ""}</div>`;
}

function renderSidebar() {
  const status = statusInfo();
  const topics = topicsForSidebar();
  const channelHtml =
    topics.length === 0
      ? `<p class="empty-hint">Channels appear after the first notification lands.</p>`
      : topics
          .map((topic) => {
            const active =
              state.screen === "app" && state.activeTopic === topic.topic;
            return `<button type="button" class="nav-link${
              active ? " active" : ""
            }" data-action="open-topic" data-topic="${esc(topic.topic)}">${icon(
              "hash",
              "icon-sm",
            )}<span>${esc(topic.topic)}</span></button>`;
          })
          .join("");

  return `<aside class="sidebar">
    <div class="brand">
      <span class="brand-mark">${icon("bell")}</span>
      <div><span class="brand-name">Bellcast</span><span class="brand-sub">${
        state.config.instance_url
          ? esc(state.config.instance_url.replace(/^https?:\/\//, ""))
          : "self-hosted"
      }</span></div>
    </div>
    <button type="button" class="compose-btn" data-action="open-modal">${icon(
      "plus",
      "icon-sm",
    )}New notification</button>
    <nav class="nav">
      <button type="button" class="nav-link${
        state.screen === "app" && !state.activeTopic ? " active" : ""
      }" data-action="activity">${icon("inbox", "icon-sm")}<span>Activity</span></button>
      <div class="nav-section"><span>Channels</span><button type="button" data-action="open-modal" aria-label="Publish to a new channel" title="Publish to a new channel">${icon(
        "plus",
        "icon-sm",
      )}</button></div>
      ${channelHtml}
    </nav>
    <div class="sidebar-footer">
      <div class="connection-row">
        <span class="dot ${status.tone}" aria-hidden="true"></span>
        <span>${esc(status.label)}</span>
        ${
          state.status === "error" ||
          state.status === "offline" ||
          state.status === "unauthorized"
            ? `<button type="button" class="retry-link" data-action="retry">Retry</button>`
            : ""
        }
      </div>
      <div class="footer-row">
        <button type="button" class="footer-link${
          state.screen === "settings" ? " active" : ""
        }" data-action="settings">${icon(
          "settings",
          "icon-sm",
        )}<span>Preferences</span></button>
        <button type="button" class="icon-btn" data-action="toggle-theme" aria-label="Change theme" title="Change theme">${icon(
          "palette",
          "icon-sm",
        )}</button>
      </div>
      <div class="user-row">
        <span class="avatar">P</span>
        <span><strong>Owner</strong>API key session</span>
      </div>
    </div>
    ${
      state.themeOpen
        ? `<div class="theme-popover">
            <p>Appearance</p>
            ${THEMES.map(
              (theme) =>
                `<button type="button" class="theme-option${
                  state.theme === theme.id ? " active" : ""
                }" data-action="set-theme" data-theme-id="${theme.id}">${themeSwatch(
                  theme,
                )}<span style="flex:1">${esc(theme.label)}</span>${
                  state.theme === theme.id ? icon("check", "icon-sm") : ""
                }</button>`,
            ).join("")}
          </div>`
        : ""
    }
  </aside>`;
}

function renderTopbar() {
  if (state.screen === "settings") {
    return `<header class="topbar">
      <div class="title-block"><h1>Preferences</h1><p>Connection, notifications and appearance</p></div>
      <div class="topbar-actions" style="margin-left:auto">
        <button type="button" class="icon-btn" data-action="activity" aria-label="Close preferences" title="Close preferences">${icon(
          "x",
          "icon-sm",
        )}</button>
      </div>
    </header>`;
  }

  const subtitle = state.activeTopic
    ? "Everything published to this channel"
    : "Every notification across your channels";
  const total = filteredMessages().length;

  return `<header class="topbar">
    <div class="title-block">
      <h1>${state.activeTopic ? `<span>#</span>${esc(state.activeTopic)}` : "Activity"}</h1>
      <p>${esc(subtitle)} · ${total} message${total === 1 ? "" : "s"}</p>
    </div>
    <div class="search">
      ${icon("search", "icon-sm")}
      <input id="search-input" type="search" value="${esc(
        state.query,
      )}" placeholder="Search messages" aria-label="Search messages" spellcheck="false" />
      ${
        state.query
          ? `<button type="button" class="icon-btn" data-action="clear-search" aria-label="Clear search" style="position:absolute;right:2px;width:26px;height:26px">${icon(
              "x",
              "icon-sm",
            )}</button>`
          : ""
      }
    </div>
    <div class="topbar-actions">
      <button type="button" class="btn" data-action="open-modal">${icon(
        "plus",
        "icon-sm",
      )}New</button>
    </div>
  </header>`;
}

function renderBanner() {
  if (!state.ifaceOnline) {
    return `<div class="banner warn" role="status">${icon(
      "wifiOff",
      "icon-sm",
    )}<strong>You're offline.</strong><span class="grow">Messages already loaded stay readable. Sending is disabled until the connection returns.</span></div>`;
  }

  if (state.status === "unauthorized") {
    return `<div class="banner danger" role="alert">${icon(
      "alert",
      "icon-sm",
    )}<strong>Your API key was rejected.</strong><span class="grow">${esc(
      state.statusMessage || "Reconnect with a valid key to keep syncing.",
    )}</span><button type="button" data-action="reconnect">Reconnect</button></div>`;
  }

  if (state.status === "unconfigured") {
    return `<div class="banner danger" role="alert">${icon(
      "alert",
      "icon-sm",
    )}<strong>No instance configured.</strong><span class="grow">Add your instance URL and API key to start receiving notifications.</span><button type="button" data-action="reconnect">Connect</button></div>`;
  }

  if (state.statusMessage && (state.status === "error" || state.status === "offline")) {
    return `<div class="banner danger" role="alert">${icon(
      "wifiOff",
      "icon-sm",
    )}<strong>Can't reach your instance.</strong><span class="grow">${esc(
      state.statusMessage,
    )}</span><button type="button" data-action="retry">Retry</button></div>`;
  }

  if (state.status === "paused") {
    return `<div class="banner warn" role="status">${icon(
      "bellOff",
      "icon-sm",
    )}<strong>Notifications are paused.</strong><span class="grow">Messages keep syncing, but native alerts are muted.</span><button type="button" data-action="resume">Resume</button></div>`;
  }

  if (state.actionError) {
    return `<div class="banner danger" role="alert">${icon(
      "alert",
      "icon-sm",
    )}<strong>Action failed.</strong><span class="grow">${esc(
      state.actionError,
    )}</span><button type="button" data-action="dismiss">Dismiss</button></div>`;
  }

  return "";
}

function renderConversation() {
  const filtered = filteredMessages();
  return `<div class="scroll">${renderMessages(filtered)}</div>${renderComposer()}`;
}

function renderMessages(filtered) {
  if (state.loading) {
    return `<div aria-busy="true" aria-label="Loading messages">${[1, 2, 3, 4]
      .map(
        () => `<div class="skeleton-row"><div class="skeleton avatar"></div><div style="flex:1;max-width:520px"><div class="skeleton skeleton-line" style="width:28%"></div><div class="skeleton skeleton-line" style="width:92%"></div><div class="skeleton skeleton-line" style="width:64%"></div></div></div>`,
      )
      .join("")}</div>`;
  }

  if (state.loadError) {
    return `<div class="state-panel">${state.ifaceOnline ? "" : `<div class="state-icon">${icon("wifiOff")}</div>`}<h2>${
      state.ifaceOnline ? "Can't load messages" : "This device is offline"
    }</h2><p>${esc(
      state.loadError,
    )}</p><div class="section-actions" style="justify-content:center"><button type="button" class="btn secondary" data-action="retry">${icon(
      "refresh",
      "icon-sm",
    )}Try again</button></div></div>`;
  }

  if (filtered.length === 0) {
    if (state.query) {
      return `<div class="state-panel"><div class="state-icon">${icon(
        "search",
      )}</div><h2>No messages match “${esc(state.query)}”</h2><p>Search covers titles, message text, channels and tags that are loaded on this device.</p><div class="section-actions" style="justify-content:center"><button type="button" class="btn secondary" data-action="clear-search">Clear search</button></div></div>`;
    }
    if (
      state.status === "offline" ||
      state.status === "error" ||
      state.status === "unauthorized" ||
      !state.ifaceOnline
    ) {
      return `<div class="state-panel"><div class="state-icon">${icon(
        "wifiOff",
      )}</div><h2>${
        state.ifaceOnline ? "Can't reach your instance" : "This device is offline"
      }</h2><p>${esc(
        state.statusMessage ||
          "Messages will appear as soon as the connection is back.",
      )}</p><div class="section-actions" style="justify-content:center"><button type="button" class="btn secondary" data-action="retry">${icon(
        "refresh",
        "icon-sm",
      )}Try again</button></div></div>`;
    }
    return renderEmptyChannel();
  }

  let previous = null;
  const rows = [];
  for (const message of filtered) {
    const sameDay =
      previous &&
      new Date(previous.created_at).toDateString() ===
        new Date(message.created_at).toDateString();
    const sameSender =
      previous &&
      !state.query &&
      previous.topic === message.topic &&
      (previous.title || "") === (message.title || "") &&
      Date.parse(message.created_at) - Date.parse(previous.created_at) <
        5 * 60 * 1000;

    if (!sameDay) {
      rows.push(
        `<div class="day-divider"><span></span><b>${esc(
          formatDay(message.created_at),
        )}</b><span></span></div>`,
      );
    }
    rows.push(renderMessage(message, !sameSender));
    previous = message;
  }

  const older = state.hasMore
    ? `<div class="section-actions" style="justify-content:center;padding:0 20px 12px">${
        state.olderError
          ? `<p class="note" style="color:var(--bc-danger);margin:0 0 6px" role="alert">${esc(
              state.olderError,
            )}</p>`
          : ""
      }<button type="button" class="btn secondary" data-action="load-older" ${
        state.loadingOlder ? "disabled" : ""
      }>${icon("clock", "icon-sm")}${
        state.loadingOlder
          ? "Loading…"
          : state.olderError
            ? "Retry older messages"
            : "Load older messages"
      }</button></div>`
    : "";

  return rows.join("") + older;
}

function renderEmptyChannel() {
  const title = state.activeTopic
    ? `#${state.activeTopic} is quiet`
    : "No notifications yet";
  const body = state.activeTopic
    ? "Publish to this channel and it will appear here immediately."
    : "Publish from curl, CI or the composer below. Channels are created automatically.";
  return `<div class="channel-intro">
    <div class="intro-head">
      <span class="state-icon">${icon("message")}</span>
      <div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>
    </div>
    <div class="code-block">
      <div class="code-head"><span>Bash</span><button type="button" data-action="copy-curl">${icon(
        "copy",
        "icon-sm",
      )}Copy</button></div>
      <pre>${esc(curlCommand())}</pre>
    </div>
    <p class="note">Replace <span style="font-family:var(--font-mono);color:var(--bc-muted)">YOUR_API_KEY</span> with the key from your instance environment.</p>
  </div>`;
}

function renderMessage(message, firstInGroup) {
  const high = message.priority >= 4;
  const max = message.priority === 5;
  const avatarHue = hue(message.topic);
  const messageText = [message.title, message.body].filter(Boolean).join("\n");

  const head = firstInGroup
    ? `<div class="msg-head"><strong>${esc(
        message.title || `#${message.topic}`,
      )}</strong>${
        !state.activeTopic
          ? `<button type="button" class="channel-tag" data-action="open-topic" data-topic="${esc(
              message.topic,
            )}">#${esc(message.topic)}</button>`
          : ""
      }${
        high
          ? `<span class="badge ${max ? "max" : "high"}">${
              max ? "Max priority" : "High priority"
            }</span>`
          : ""
      }<time datetime="${esc(message.created_at)}">${esc(
        formatTime(message.created_at),
      )}</time><span class="rel">${esc(
        relative(message.created_at),
      )}</span></div>`
    : "";

  const tags =
    message.tags && message.tags.length
      ? `<div class="tags">${message.tags
          .map((tag) => `<span class="tag">#${esc(tag)}</span>`)
          .join("")}</div>`
      : "";

  const actions =
    message.click || (message.actions && message.actions.length)
      ? `<div class="attachments">${
          message.click
            ? `<button type="button" class="link-btn" data-action="open-link" data-url="${esc(
                message.click,
              )}">${icon("external", "icon-sm")}Open link</button>`
            : ""
        }${(message.actions || [])
          .map(
            (action) =>
              `<button type="button" class="action-btn" data-action="open-link" data-url="${esc(
                action.url,
              )}">${esc(action.label)}</button>`,
          )
          .join("")}</div>`
      : "";

  return `<div class="message${high ? " high" : ""}${max ? " max" : ""}">
    ${
      firstInGroup
        ? `<div class="msg-avatar" style="background:hsl(${avatarHue} 38% 34%)" aria-hidden="true">${esc(
            initials(message.topic),
          )}</div>`
        : `<div class="msg-gutter" aria-hidden="true">${esc(
            formatTime(message.created_at),
          )}</div>`
    }
    <div class="msg-body">${head}${
      message.body
        ? `<p class="msg-text">${esc(message.body)}</p>`
        : ""
    }${tags}${actions}</div>
    <div class="hover-actions">
      <button type="button" data-action="copy-message" data-id="${esc(
        message.id,
      )}" aria-label="Copy message" title="Copy message">${icon(
        "copy",
        "icon-sm",
      )}</button>
      <button type="button" class="danger" data-action="delete-message" data-id="${esc(
        message.id,
      )}" aria-label="Delete message" title="Delete message">${icon(
        "trash",
        "icon-sm",
      )}</button>
    </div>
  </div>`;
}

function renderComposer() {
  const online = state.ifaceOnline;
  const disabled = !online;
  return `<div class="composer">
    ${
      state.composerError
        ? `<div class="composer-error" role="alert">${icon(
            "alert",
            "icon-sm",
          )}<span>${esc(state.composerError)}</span><button type="button" data-action="dismiss-composer" aria-label="Dismiss error">${icon(
            "x",
            "icon-sm",
          )}</button></div>`
        : ""
    }
    <div class="composer-box${online ? "" : " offline"}">
      <textarea id="composer-input" rows="1" placeholder="${
        online
          ? state.activeTopic
            ? `Message #${esc(state.activeTopic)}`
            : `Message #${esc(state.composerTopic || "general")}`
          : "You're offline — reconnect before sending"
      }" aria-label="Message" ${disabled ? "disabled" : ""}>${esc(
        state.draft,
      )}</textarea>
      <div class="composer-tools">
        <button type="button" class="tool-btn" data-action="open-modal">${icon(
          "sliders",
          "icon-sm",
        )}More options</button>
        ${
          !state.activeTopic
            ? `<label class="channel-input"><span aria-hidden="true">#</span><input id="channel-input" value="${esc(
                state.composerTopic || "general",
              )}" aria-label="Channel to publish to" spellcheck="false" ${
                disabled ? "disabled" : ""
              } /></label>`
            : ""
        }
        <span class="composer-hint">Enter to send · Shift + Enter for a new line</span>
        <button type="button" class="btn" id="send-btn" data-action="send" ${
          state.sending || !state.draft.trim() || disabled ? "disabled" : ""
        }>${state.sending ? "Sending…" : `${icon("send", "icon-sm")}Send`}</button>
      </div>
    </div>
  </div>`;
}

function renderSettings() {
  const status = statusInfo();
  const topicList = topicsForSidebar();
  const paused = state.config.paused;

  const healthRows = state.healthLoading
    ? `<div class="rows"><div class="row"><span class="label">Checking instance…</span></div></div>`
    : state.healthError
      ? `<div class="form-error" role="alert">${icon(
          "alert",
          "icon-sm",
        )}<span>${esc(
          state.healthError,
        )}</span></div><div class="section-actions"><button type="button" class="btn secondary" data-action="check-health">${icon(
          "refresh",
          "icon-sm",
        )}Retry health check</button></div>`
      : state.health
        ? `<div class="rows">
            <div class="row"><span class="label">Version</span><span class="value mono">v${esc(
              state.health.version || "unknown",
            )}</span></div>
            <div class="row"><span class="label">Storage</span><span class="value">${esc(
              state.health.store === "supabase"
                ? "Supabase (Postgres)"
                : state.health.store === "file"
                  ? "Local file (dev)"
                  : "Not configured",
            )}</span></div>
            <div class="row"><span class="label">Retention</span><span class="value">${esc(
              state.health.retentionDays,
            )} days</span></div>
            <div class="row"><span class="label">Status</span><span class="value ${
              state.health.configured ? "ok" : "warn"
            }">${state.health.configured ? "Active" : "Not configured"}</span></div>
            <div class="row"><span class="label">Delivery</span><span class="value mono">long-poll</span></div>
          </div>`
        : `<p class="note">Run a health check to see version, storage and retention details.</p>`;

  return `<div class="settings"><div class="settings-inner">
    <div class="section">
      ${sectionHead(
        "palette",
        "Appearance",
        "Two themes, applied instantly and remembered on this device.",
      )}
      <div class="theme-grid">
        ${THEMES.map(
          (theme) =>
            `<button type="button" class="theme-card${
              state.theme === theme.id ? " active" : ""
            }" data-action="set-theme" data-theme-id="${theme.id}">${themeSwatch(
              theme,
            )}<span style="flex:1"><strong>${esc(
              theme.label,
            )}</strong><span>${esc(theme.note)}</span></span>${
              state.theme === theme.id ? icon("check", "icon-sm") : ""
            }</button>`,
        ).join("")}
      </div>
    </div>

    <div class="section">
      ${sectionHead(
        "database",
        "Connection",
        "The self-hosted instance this desktop app talks to.",
      )}
      <div class="rows">
        <div class="row"><span class="label">Instance</span><span class="value mono">${esc(
          state.config.instance_url || "Not connected",
        )}</span></div>
        <div class="row"><span class="label">API key</span><span class="value">${
          state.config.has_key ? "Saved on this device" : "Missing"
        }</span></div>
        <div class="row"><span class="label">Connection</span><span class="value ${
          status.tone === "live" ? "ok" : status.tone === "warn" ? "warn" : ""
        }">${esc(status.label)}</span></div>
        <div class="row"><span class="label">Notifications</span><span class="value ${
          paused ? "warn" : "ok"
        }">${paused ? "Paused" : "Active"}</span></div>
        <div class="row"><span class="label">Messages loaded</span><span class="value">${
          state.messages.length
        }</span></div>
        <div class="row"><span class="label">Channels</span><span class="value">${
          topicList.length
        }</span></div>
      </div>
      <div class="section-actions">
        <button type="button" class="btn secondary" data-action="reconnect">${icon(
          "key",
          "icon-sm",
        )}Reconnect</button>
        <button type="button" class="btn secondary" data-action="toggle-pause" ${
          state.busy ? "disabled" : ""
        }>${icon(paused ? "play" : "pause", "icon-sm")}${
          paused ? "Resume notifications" : "Pause notifications"
        }</button>
        <button type="button" class="btn secondary" data-action="retry">${icon(
          "refresh",
          "icon-sm",
        )}Refresh now</button>
      </div>
    </div>

    <div class="section">
      ${sectionHead(
        "shield",
        "Diagnostics",
        "Health details reported by your instance.",
      )}
      ${healthRows}
      ${
        state.health && !state.healthLoading
          ? `<div class="section-actions"><button type="button" class="btn secondary" data-action="check-health">${icon(
              "refresh",
              "icon-sm",
            )}Recheck</button></div>`
          : ""
      }
    </div>

    <div class="section">
      ${sectionHead(
        "bellOff",
        "Notifications",
        "Native alerts are delivered by the desktop app while it runs in the tray.",
      )}
      <div class="rows">
        <div class="row"><span class="label">Delivery</span><span class="value">${
          paused ? "Paused" : "Background and tray"
        }</span></div>
        <div class="row"><span class="label">Start at login</span><span class="value ok">Enabled</span></div>
        <div class="row"><span class="label">Focus behaviour</span><span class="value">Suppressed while the window is focused</span></div>
      </div>
      <p class="note">Pausing keeps syncing in the background but stops native alerts until you resume.</p>
    </div>

    <div class="section">
      ${sectionHead(
        "alert",
        "Reset",
        "Forget this instance and return to onboarding.",
      )}
      <div class="section-actions">
        <button type="button" class="btn danger" data-action="reset" ${
          state.busy ? "disabled" : ""
        }>${icon("logOut", "icon-sm")}Disconnect and reset</button>
      </div>
    </div>

    <p class="note" style="text-align:center;padding:8px 0 0">Bellcast Desktop v0.2.1 · self-hosted · API key stored locally</p>
  </div></div>`;
}

function renderModal() {
  return `<div class="modal-backdrop" data-action="close-modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="advanced-title">
      <div class="modal-head">
        <div><h2 id="advanced-title">New notification</h2><p>Publish to any channel. New channels are created automatically.</p></div>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${icon(
          "x",
          "icon-sm",
        )}</button>
      </div>
      <form id="advanced-form" class="modal-body">
        <div class="modal-row">
          <div class="field"><label for="advanced-topic">Channel</label><input id="advanced-topic" name="topic" value="${esc(
            state.activeTopic || state.composerTopic || "general",
          )}" spellcheck="false" style="font-family:var(--font-mono);font-size:12px" /></div>
          <div class="field"><label for="advanced-priority">Priority</label><select id="advanced-priority" name="priority"><option value="1">Min</option><option value="2" selected>Low</option><option value="3">Default</option><option value="4">High</option><option value="5">Max</option></select></div>
        </div>
        <div class="field"><label for="advanced-title-input">Title (optional)</label><input id="advanced-title-input" name="title" maxlength="200" placeholder="Backup completed" /></div>
        <div class="field"><label for="advanced-body">Message</label><textarea id="advanced-body" name="body" rows="4" placeholder="Backup completed successfully."></textarea></div>
        <div class="field"><label for="advanced-tags">Tags (optional)</label><input id="advanced-tags" name="tags" placeholder="backup, success" /></div>
        <div class="field"><label for="advanced-click">Click URL (optional)</label><input id="advanced-click" name="click" type="url" placeholder="https://dashboard.example.com" /></div>
        <div class="form-error" id="modal-error" role="alert" hidden></div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">${icon("send", "icon-sm")}Publish</button>
        </div>
      </form>
    </div>
  </div>`;
}

function updateSendButton() {
  const button = document.getElementById("send-btn");
  if (!button) return;
  const disabled =
    state.sending || !state.draft.trim() || !state.ifaceOnline;
  button.disabled = disabled;
  button.innerHTML = state.sending
    ? "Sending…"
    : `${icon("send", "icon-sm")}Send`;
}

/* ------------------------------------------------------------------ */
/* events                                                             */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (event) => {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) {
    if (state.themeOpen) {
      state.themeOpen = false;
      render();
    }
    return;
  }

  const action = actionNode.dataset.action;

  switch (action) {
    case "reload":
      window.location.reload();
      break;
    case "open-modal":
      state.modalOpen = true;
      state.modalError = null;
      render();
      window.setTimeout(() => {
        const node = document.getElementById("advanced-body");
        if (node) node.focus();
      }, 0);
      break;
    case "close-modal":
      state.modalOpen = false;
      state.modalError = null;
      render();
      break;
    case "close-modal-backdrop":
      if (event.target === actionNode) {
        state.modalOpen = false;
        state.modalError = null;
        render();
      }
      break;
    case "activity":
      state.themeOpen = false;
      state.screen = "app";
      selectTopic(null);
      break;
    case "open-topic":
      state.themeOpen = false;
      state.screen = "app";
      selectTopic(actionNode.dataset.topic || null);
      break;
    case "settings":
      state.themeOpen = false;
      state.screen = "settings";
      state.query = "";
      render();
      loadHealth();
      break;
    case "toggle-theme":
      state.themeOpen = !state.themeOpen;
      render();
      break;
    case "set-theme":
      state.theme = applyTheme(actionNode.dataset.themeId);
      state.themeOpen = false;
      render();
      break;
    case "retry":
      state.actionError = null;
      refresh();
      break;
    case "resume":
      setPaused(false);
      break;
    case "toggle-pause":
      setPaused(!state.config.paused);
      break;
    case "pause":
      setPaused(true);
      break;
    case "reconnect":
      startReconnect();
      break;
    case "cancel-reconnect":
      state.screen = "app";
      state.reconnect = false;
      state.onboarding.error = null;
      state.onboarding.loading = false;
      state.onboarding.key = "";
      render();
      if (state.messages.length === 0) refresh();
      break;
    case "dismiss":
      state.actionError = null;
      render();
      break;
    case "dismiss-composer":
      state.composerError = null;
      render();
      break;
    case "copy-curl":
      copyText(curlCommand(), "Command copied");
      break;
    case "copy-message": {
      const message = state.messages.find(
        (item) => item.id === actionNode.dataset.id,
      );
      if (message) {
        copyText(
          [message.title, message.body].filter(Boolean).join("\n"),
          "Message copied",
        );
      }
      break;
    }
    case "delete-message":
      deleteMessage(actionNode.dataset.id);
      break;
    case "open-link":
      openExternal(actionNode.dataset.url);
      break;
    case "clear-search":
      state.query = "";
      render();
      break;
    case "load-older":
      loadOlder();
      break;
    case "send":
      sendMessage();
      break;
    case "check-health":
      loadHealth();
      break;
    case "reset":
      resetInstance();
      break;
    case "toggle-key":
      state.onboarding.showKey = !state.onboarding.showKey;
      render();
      break;
    default:
      break;
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "connect-form") {
    event.preventDefault();
    connect();
  } else if (event.target.id === "advanced-form") {
    event.preventDefault();
    submitAdvanced(event);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!target) return;

  if (target.id === "connect-url") {
    state.onboarding.url = target.value;
    return;
  }
  if (target.id === "connect-key") {
    state.onboarding.key = target.value;
    return;
  }
  if (target.id === "composer-input") {
    state.draft = target.value;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
    updateSendButton();
    return;
  }
  if (target.id === "channel-input") {
    state.composerTopic = target.value;
    return;
  }
  if (target.id === "search-input") {
    state.query = target.value;
    render();
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;

  if (event.key === "Escape") {
    if (state.modalOpen) {
      state.modalOpen = false;
      state.modalError = null;
      render();
      return;
    }
    if (state.themeOpen) {
      state.themeOpen = false;
      render();
    }
    return;
  }

  if (target && target.id === "composer-input") {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
    return;
  }

  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    if (
      state.modalOpen &&
      event.target &&
      event.target.closest("#advanced-form")
    ) {
      event.preventDefault();
      const form = document.getElementById("advanced-form");
      if (form) form.requestSubmit();
    }
  }
});

window.addEventListener("online", () => {
  state.ifaceOnline = true;
  state.status = "connecting";
  state.statusMessage = "";
  render();
  if (state.screen === "app") refresh();
});

window.addEventListener("offline", () => {
  state.ifaceOnline = false;
  state.status = "offline";
  state.statusMessage =
    "This device is offline. Loaded messages stay readable.";
  render();
});

function startReconnect() {
  state.screen = "onboarding";
  state.reconnect = true;
  state.onboarding.url = state.config.instance_url || state.onboarding.url || "";
  state.onboarding.key = "";
  state.onboarding.showKey = false;
  state.onboarding.error = null;
  state.onboarding.loading = false;
  render();
}

/* ------------------------------------------------------------------ */
/* boot                                                               */
/* ------------------------------------------------------------------ */

applyTheme(state.theme);
render();
subscribe();
boot();
