// bruhtube: a static YouTube front-end.
// Data comes from public Piped and Invidious servers (list kept fresh by
// .github/workflows/update.yml), plus Return YouTube Dislike, SponsorBlock
// and noembed for extras.

const CATEGORIES = [
  { slug: "music", name: "Music", q: "new music video", icon: "music" },
  { slug: "gaming", name: "Gaming", q: "gaming", icon: "game" },
  { slug: "news", name: "News", q: "news today", icon: "news" },
  { slug: "sports", name: "Sports", q: "sports highlights", icon: "trophy" },
  { slug: "comedy", name: "Comedy", q: "comedy sketch", icon: "smile" },
  { slug: "science", name: "Science", q: "science explained", icon: "flask" },
  { slug: "movies", name: "Trailers", q: "official trailer", icon: "film" },
  { slug: "podcasts", name: "Podcasts", q: "podcast full episode", icon: "mic" },
];

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  menu: P('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  search: P('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>'),
  home: P('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'),
  fire: P('<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.3 2.4-5.2 3.6-7.4.4 1.6 1.2 2.6 2.4 3.2C11 6.6 12.6 4.4 14.6 3c-.3 2.7.6 4.4 2 5.9 1.3 1.4 2.4 3.1 2.4 5.5 0 3.8-3 6.6-7 6.6z"/>'),
  clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  music: P('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  game: P('<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11.5" r=".6"/><circle cx="18" cy="13.5" r=".6"/>'),
  news: P('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 9h10M7 12.5h10M7 16h6"/>'),
  trophy: P('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'),
  smile: P('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  flask: P('<path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.3 1.3 0 0 0 1.1 2h11.8A1.3 1.3 0 0 0 19 19l-5.5-9.5v-6M7.5 15h9"/>'),
  film: P('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>'),
  mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  info: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: P('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  up: P('<path d="M7 11v9H4v-9zM7 11l4-7.5c1.4 0 2.3 1.1 2 2.5L12.5 9H18a2 2 0 0 1 2 2.3l-1.2 6.8A2.3 2.3 0 0 1 16.5 20H7"/>'),
  down: P('<path d="M17 13V4h3v9zM17 13l-4 7.5c-1.4 0-2.3-1.1-2-2.5l.5-3H6a2 2 0 0 1-2-2.3l1.2-6.8A2.3 2.3 0 0 1 7.5 4H17"/>'),
  share: P('<path d="M14 5l6 6-6 6v-3.5c-5 0-8 1.5-10 5 .5-5.5 3.5-9.5 10-10.5z"/>'),
  skip: P('<path d="M5 5l9 7-9 7zM18 5v14"/>'),
  next: P('<path d="M9 6l6 6-6 6"/>'),
  tok: P('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="m10.5 9 4 3-4 3z"/>'),
  open: P('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};

const S = { piped: [], invidious: [], pipedStreams: [], invidiousStreams: [], pipedFrontends: [], invidiousEmbed: [], ytFrontends: [], ytChallenge: [], route: 0, cleanup: null };
const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; }
}
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };

function dur(s) {
  if (!s || s < 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
}
const compact = (n) => (n == null || n < 0) ? "" : Intl.NumberFormat("en", { notation: "compact" }).format(n);

function ago(d) {
  if (!d) return "";
  if (typeof d === "string" && isNaN(Date.parse(d))) return d;
  const t = typeof d === "number" ? (d < 1e12 ? d * 1000 : d) : Date.parse(d);
  const s = (Date.now() - t) / 1000;
  const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [sec, name] of units) if (s >= sec) { const n = Math.floor(s / sec); return `${n} ${name}${n > 1 ? "s" : ""} ago`; }
  return "just now";
}

function idFrom(text) {
  const t = text.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1, 12);
    if (u.searchParams.get("v")) return u.searchParams.get("v").slice(0, 11);
    const m = u.pathname.match(/\/(?:embed|shorts|live|v|watch)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {}
  return null;
}

async function getJSON(url, ms = 9000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Run fn against each server in a list until one works; move the winner to the front.
async function firstOf(key, fn) {
  let err = new Error(`no ${key} servers`);
  for (const base of S[key]) {
    try {
      const out = await fn(base);
      S[key] = [base, ...S[key].filter((b) => b !== base)];
      return out;
    } catch (e) { err = e; }
  }
  throw err;
}
const nonEmpty = (list) => { if (!list.length) throw new Error("empty"); return list; };

/* ---------- normalizing Piped and Invidious data ---------- */

const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const bestThumb = (list) => (list || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url;
const absUrl = (u, base) => !u ? "" : u.startsWith("//") ? "https:" + u : u.startsWith("/") ? base + u : u;

function fromPiped(i) {
  const id = (i.url || "").split("v=")[1]?.slice(0, 11);
  return {
    id, title: i.title, author: i.uploaderName, channel: (i.uploaderUrl || "").split("/").pop(),
    avatar: i.uploaderAvatar, seconds: i.duration, views: i.views,
    when: i.uploadedDate || i.uploaded, thumb: i.thumbnail || ytThumb(id), live: i.duration === -1,
  };
}
function fromInv(v, base) {
  return {
    id: v.videoId, title: v.title, author: v.author, channel: v.authorId,
    avatar: absUrl(bestThumb(v.authorThumbnails), base),
    seconds: v.lengthSeconds, views: v.viewCount, when: v.publishedText || v.published,
    thumb: `${base}/vi/${v.videoId}/mqdefault.jpg`, live: v.liveNow,
  };
}

const api = {
  async search(q) {
    const e = encodeURIComponent(q);
    try {
      return await firstOf("piped", async (b) => nonEmpty(
        ((await getJSON(`${b}/search?q=${e}&filter=videos`)).items || [])
          .filter((i) => i.url?.includes("watch?v=")).map(fromPiped)));
    } catch {
      return firstOf("invidious", async (b) => nonEmpty(
        (await getJSON(`${b}/api/v1/search?q=${e}&type=video`))
          .filter((v) => v.videoId).map((v) => fromInv(v, b))));
    }
  },

  async trending() {
    const tries = [
      () => firstOf("piped", async (b) => nonEmpty((await getJSON(`${b}/trending?region=US`)).map(fromPiped))),
      () => firstOf("invidious", async (b) => nonEmpty((await getJSON(`${b}/api/v1/trending?region=US`)).map((v) => fromInv(v, b)))),
      () => firstOf("invidious", async (b) => nonEmpty((await getJSON(`${b}/api/v1/popular`)).map((v) => fromInv(v, b)))),
      () => api.search("trending"),
    ];
    for (const t of tries) { try { return await t(); } catch {} }
    throw new Error("trending unavailable");
  },

  async channel(id) {
    try {
      return await firstOf("piped", async (b) => {
        const d = await getJSON(`${b}/channel/${id}`);
        return { name: d.name, avatar: d.avatarUrl, banner: d.bannerUrl, subs: d.subscriberCount,
          videos: (d.relatedStreams || []).filter((i) => i.url?.includes("watch?v=")).map(fromPiped) };
      });
    } catch {
      return firstOf("invidious", async (b) => {
        const d = await getJSON(`${b}/api/v1/channels/${id}`);
        let vids = d.latestVideos || [];
        try { vids = (await getJSON(`${b}/api/v1/channels/${id}/videos`)).videos || vids; } catch {}
        return { name: d.author, avatar: absUrl(bestThumb(d.authorThumbnails), b), banner: absUrl(bestThumb(d.authorBanners), b),
          subs: d.subCount, videos: vids.map((v) => fromInv(v, b)) };
      });
    }
  },

  // Full video info + a playable stream from one specific server.
  async videoFrom(kind, base, id) {
    if (kind === "piped") {
      const d = await getJSON(`${base}/streams/${id}`, 12000);
      const muxed = (d.videoStreams || []).filter((s) => !s.videoOnly && s.url && /mp4/.test(s.mimeType || s.format || ""));
      muxed.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
      return {
        title: d.title, author: d.uploader, channel: (d.uploaderUrl || "").split("/").pop(),
        avatar: d.uploaderAvatar, subs: d.uploaderSubscriberCount,
        views: d.views, likes: d.likes, when: d.uploadDate, desc: htmlToText(d.description),
        related: (d.relatedStreams || []).filter((i) => i.url?.includes("watch?v=")).map(fromPiped),
        mp4: muxed[0]?.url, hls: d.hls,
      };
    }
    const d = await getJSON(`${base}/api/v1/videos/${id}?local=true`, 12000);
    const fmt = (d.formatStreams || []).filter((f) => f.url);
    fmt.sort((a, b) => (parseInt(b.qualityLabel || b.resolution) || 0) - (parseInt(a.qualityLabel || a.resolution) || 0));
    return {
      title: d.title, author: d.author, channel: d.authorId,
      avatar: absUrl(bestThumb(d.authorThumbnails), base), subs: d.subCountText,
      views: d.viewCount, likes: d.likeCount, when: d.publishedText || d.published, desc: d.description,
      related: (d.recommendedVideos || []).map((v) => fromInv(v, base)),
      mp4: absUrl(fmt[0]?.url, base), hls: absUrl(d.hlsUrl, base),
    };
  },
};

function htmlToText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n"), "text/html");
  return doc.body.textContent || "";
}

/* ---------- watch history (this browser only) ---------- */

const watched = {
  list() { try { return JSON.parse(store("history") || "[]"); } catch { return []; } },
  add(v) { store("history", JSON.stringify([v, ...watched.list().filter((x) => x.id !== v.id)].slice(0, 200))); },
};

/* ---------- rendering ---------- */

function avatar(name, url, cls = "av") {
  if (url) return `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">`;
  let h = 0;
  for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="${cls}" style="background:hsl(${h} 32% 42%)">${esc((name || "?").trim()[0]?.toUpperCase() || "?")}</span>`;
}
const chanHref = (v) => v.channel && /^UC[\w-]{22}$/.test(v.channel)
  ? `#/channel/${v.channel}` : `#/search/${encodeURIComponent(v.author || "")}`;
const views = (n) => (n != null && n >= 0) ? `${compact(n)} views` : "";
const dot = (...xs) => xs.filter(Boolean).map(esc).join(" • ");

function thumb(v) {
  return `<a class="th" href="#/watch/${esc(v.id)}"><img loading="lazy" src="${esc(v.thumb)}" data-id="${esc(v.id)}" alt="">
    ${v.live ? `<span class="len live">LIVE</span>` : v.seconds > 0 ? `<span class="len">${dur(v.seconds)}</span>` : ""}</a>`;
}
function card(v) {
  return `<div class="card">${thumb(v)}
    <div class="card-b"><a href="${chanHref(v)}">${avatar(v.author, v.avatar)}</a>
      <div><a href="#/watch/${esc(v.id)}"><h3 class="card-t" title="${esc(v.title)}">${esc(v.title)}</h3></a>
        <div class="sub2"><a href="${chanHref(v)}">${esc(v.author)}</a><br>${dot(views(v.views), ago(v.when))}</div></div></div></div>`;
}
function relItem(v) {
  return `<div class="rel">${thumb(v)}
    <div><a href="#/watch/${esc(v.id)}"><h3 class="card-t">${esc(v.title)}</h3></a>
      <div class="sub2"><a href="${chanHref(v)}">${esc(v.author)}</a><br>${dot(views(v.views), ago(v.when))}</div></div></div>`;
}

// Proxied images sometimes 404; fall back to YouTube's image server, or a letter avatar.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG") return;
  if (img.dataset.id && !img.dataset.fb) { img.dataset.fb = 1; img.src = ytThumb(img.dataset.id); }
  else if (img.classList.contains("av")) img.outerHTML = avatar("?", null);
}, true);

function shelf(title, more) {
  const el = document.createElement("section");
  el.className = "shelf";
  el.innerHTML = `${title ? `<div class="shelf-h"><h2>${esc(title)}</h2>${more ? `<a href="${more}">View all</a>` : ""}</div>` : ""}<div class="note">Loading…</div>`;
  view.append(el);
  return {
    fill(list) {
      const g = document.createElement("div");
      g.className = "grid";
      g.innerHTML = list.map(card).join("");
      el.querySelector(".note")?.replaceWith(g);
    },
    fail(msg) { const n = el.querySelector(".note"); if (n) n.textContent = msg; },
  };
}

function chips(active) {
  const el = document.createElement("div");
  el.className = "chips";
  el.innerHTML = [`<a href="#/" class="${active === "home" ? "on" : ""}">All</a>`,
    `<a href="#/trending" class="${active === "trending" ? "on" : ""}">Trending</a>`,
    ...CATEGORIES.map((c) => `<a href="#/c/${c.slug}" class="${active === c.slug ? "on" : ""}">${c.name}</a>`)].join("");
  view.append(el);
}

function sidebar(active) {
  const item = (href, icon, label, key) =>
    `<a href="${href}" class="${active === key ? "on" : ""}" title="${label}">${ICON[icon]}<span>${label}</span></a>`;
  $("#side").innerHTML = [
    item("#/", "home", "Home", "home"),
    item("#/trending", "fire", "Trending", "trending"),
    item("#/history", "clock", "History", "history"),
    item("bruhtok/", "tok", "BruhTok", "tok"),
    `<div class="full"><hr><h4>Explore</h4></div>`,
    `<div class="full">${CATEGORIES.map((c) => item(`#/c/${c.slug}`, c.icon, c.name, c.slug)).join("")}</div>`,
    `<div class="full"><hr></div>`,
    item("#/about", "info", "About", "about"),
    `<div class="full"><small id="servers"></small><small><a href="https://github.com/Pallockpro/bruh">Source on GitHub</a></small></div>`,
  ].join("");
  const el = $("#servers");
  el.textContent = `${S.piped.length} Piped and ${S.invidious.length} Invidious servers online` +
    (S.updated ? `, checked ${ago(S.updated)}` : "");
}

/* layout mode: full sidebar / mini rail / drawer */
let drawerOpen = false, currentPage = "home";
function layout() {
  const forceDrawer = currentPage === "watch" || innerWidth < 800;
  const mini = !forceDrawer && (innerWidth < 1100 || store("sidebar") === "mini");
  document.body.classList.toggle("drawer", forceDrawer);
  document.body.classList.toggle("mini", mini);
  document.body.classList.toggle("open", forceDrawer && drawerOpen);
}
$("#menu").onclick = () => {
  if (document.body.classList.contains("drawer")) drawerOpen = !drawerOpen;
  else if (innerWidth >= 1100) store("sidebar", document.body.classList.contains("mini") ? "full" : "mini");
  layout();
};
$("#scrim").onclick = () => { drawerOpen = false; layout(); };
addEventListener("resize", layout);

function page(name, title) {
  currentPage = name;
  drawerOpen = false;
  layout();
  sidebar(name);
  view.innerHTML = "";
  document.title = title ? `${title} - bruhtube` : "bruhtube";
}

/* ---------- pages ---------- */

function home(token) {
  page("home");
  chips("home");
  const t = shelf("Trending", "#/trending");
  api.trending().then((l) => token === S.route && t.fill(l.slice(0, 8)))
    .catch(() => token === S.route && t.fail("Couldn't reach any server for trending right now."));
  for (const c of CATEGORIES.slice(0, 4)) {
    const s = shelf(c.name, `#/c/${c.slug}`);
    api.search(c.q).then((l) => token === S.route && s.fill(l.slice(0, 8)))
      .catch(() => token === S.route && s.fail("Nothing loaded."));
  }
}

function trending(token) {
  page("trending", "Trending");
  chips("trending");
  const s = shelf("");
  api.trending().then((l) => token === S.route && s.fill(l))
    .catch(() => token === S.route && s.fail("Couldn't reach any server for trending right now."));
}

function category(token, slug) {
  const c = CATEGORIES.find((x) => x.slug === slug);
  if (!c) return home(token);
  page(slug, c.name);
  chips(slug);
  const s = shelf("");
  api.search(c.q).then((l) => token === S.route && s.fill(l)).catch(() => token === S.route && s.fail("Nothing loaded."));
}

function results(token, q) {
  page("search", q);
  $("#q").value = q;
  const s = shelf("");
  view.firstChild.style.paddingTop = "16px";
  api.search(q).then((l) => token === S.route && s.fill(l))
    .catch(() => token === S.route && s.fail("Search is down on every server right now. Pasting a YouTube link still works."));
}

function historyPage() {
  page("history", "History");
  const l = watched.list();
  view.innerHTML = `<div class="shelf-h"><h2>Watch history</h2>${l.length ? `<a href="#/history" id="clr">Clear all</a>` : ""}</div>`;
  if (!l.length) { view.innerHTML += `<div class="empty">${ICON.clock}<p>Videos you watch show up here. They're saved only in this browser.</p></div>`; return; }
  const g = document.createElement("div");
  g.className = "grid";
  g.innerHTML = l.map(card).join("");
  view.append(g);
  $("#clr").onclick = (e) => { e.preventDefault(); store("history", "[]"); historyPage(); };
}

function channel(token, id) {
  page("channel", "Channel");
  view.innerHTML = `<div class="note">Loading channel…</div>`;
  api.channel(id).then((c) => {
    if (token !== S.route) return;
    document.title = `${c.name} - bruhtube`;
    view.innerHTML = `${c.banner ? `<div class="banner"><img src="${esc(c.banner)}" alt=""></div>` : ""}
      <div class="chead">${avatar(c.name, c.avatar)}<div><h1>${esc(c.name)}</h1>
      <div class="sub2">${c.subs >= 0 && c.subs != null ? `${compact(c.subs)} subscribers` : ""}</div></div></div>
      <div class="shelf-h"><h2>Videos</h2></div>`;
    const g = document.createElement("div");
    g.className = "grid";
    g.innerHTML = c.videos.map((v) => card({ ...v, author: v.author || c.name, channel: v.channel || id, avatar: v.avatar || c.avatar })).join("");
    view.append(g);
  }).catch(() => token === S.route && (view.innerHTML = `<div class="empty">${ICON.info}<p>Couldn't load this channel from any server.</p></div>`));
}

/* ----- watch page and the source list ----- */

function buildSources(id) {
  const out = [];
  // Only servers the updater saw actually play a video.
  for (const b of S.pipedStreams) out.push({ group: "Plays here (proxied)", kind: "piped", base: b, label: `Piped API: ${host(b)}` });
  for (const b of S.invidiousStreams) out.push({ group: "Plays here (proxied)", kind: "invidious", base: b, label: `Invidious API: ${host(b)}` });
  out.push(
    { group: "YouTube players", kind: "embed", label: "YouTube (no-cookie)", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` },
    { group: "YouTube players", kind: "embed", label: "YouTube (standard)", url: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` },
  );
  for (const f of S.pipedFrontends) out.push({ group: "Piped players", kind: "embed", label: `Piped: ${host(f)}`, url: `${f}/embed/${id}?autoplay=1` });
  for (const b of S.invidiousEmbed)
    out.push({ group: "Invidious players", kind: "embed", label: `Invidious: ${host(b)}`, url: `${b}/embed/${id}?autoplay=1&local=true` });
  for (const f of S.ytFrontends) out.push({ group: "Other front-ends", kind: "embed", label: host(f), url: `${f}/watch?v=${id}` });
  for (const f of S.ytChallenge) out.push({ group: "May ask you to verify first", kind: "embed", label: host(f), url: `${f}/${/invidious|inv\.|yewtu/.test(f) ? "embed/" + id : "watch?v=" + id}` });
  return out;
}

function watch(token, id) {
  page("watch");
  view.innerHTML = `<div class="watch">
    <div class="primary">
      <div class="stage"><video controls playsinline autoplay></video><iframe hidden allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="msg"></div></div>
      <h1 id="vt">Loading…</h1>
      <div class="owner">
        <div class="chan" id="chan"></div>
        <div class="acts">
          <span class="pill split"><span>${ICON.up}<b id="lk"></b></span><span>${ICON.down}<b id="dk"></b></span></span>
          <button class="pill" id="cp" type="button">${ICON.share}<span>Share</span></button>
          <label class="pill" title="Uses SponsorBlock. Works on the 'Plays here' sources.">${ICON.skip}<input type="checkbox" id="sb">Skip sponsors</label>
        </div>
      </div>
      <div class="srcbox">
        <label for="src">Source</label>
        <select id="src"></select>
        <button class="ib" id="nx" type="button" title="Next source">${ICON.next}</button>
        <a class="ib" id="ext" target="_blank" rel="noopener" title="Open this source in a new tab">${ICON.open}</a>
      </div>
      <div class="descbox" id="db" hidden><b id="dm"></b><div class="desc" id="dd"></div><div class="more">...more</div></div>
    </div>
    <div class="secondary" id="rel"><div class="note">Loading…</div></div>
  </div>`;

  const video = $(".stage video"), frame = $(".stage iframe"), msg = $(".stage .msg");
  const sel = $("#src"), sb = $("#sb"), db = $("#db");
  const sources = buildSources(id);
  let hls = null, segments = [], votes = null, info = null, infoTried = false, stallTimer = null, current = -1;

  sb.checked = store("skipSponsors") !== "0";
  sb.onchange = () => store("skipSponsors", sb.checked ? "1" : "0");
  $("#cp").onclick = () => navigator.clipboard?.writeText(`https://youtu.be/${id}`)
    .then(() => { $("#cp span").textContent = "Copied"; });

  const groups = [...new Set(sources.map((s) => s.group))];
  sel.innerHTML = groups.map((g) => `<optgroup label="${esc(g)}">${sources.map((s, i) => s.group === g
    ? `<option value="${i}">${esc(s.label)}</option>` : "").join("")}</optgroup>`).join("");

  db.onclick = () => { db.classList.add("open"); $(".more", db).textContent = "Show less"; };
  $(".more", db).onclick = (e) => {
    e.stopPropagation();
    const open = db.classList.toggle("open");
    $(".more", db).textContent = open ? "Show less" : "...more";
  };

  function stop() {
    clearTimeout(stallTimer);
    hls?.destroy(); hls = null;
    video.pause(); video.removeAttribute("src"); video.load();
    frame.src = "about:blank";
  }
  S.cleanup = stop;

  function showVotes() {
    if (token !== S.route) return;
    const likes = votes?.likes ?? info?.likes;
    $("#lk").textContent = likes >= 0 && likes != null ? compact(likes) : "";
    $("#dk").textContent = votes?.dislikes != null ? compact(votes.dislikes) : "";
  }

  function fillInfo(d) {
    if (info?.full || token !== S.route || !d?.title) return;
    info = { ...info, ...d };
    document.title = `${d.title} - bruhtube`;
    $("#vt").textContent = d.title;
    const v = { author: d.author, channel: d.channel };
    const subs = typeof d.subs === "number" ? (d.subs >= 0 ? compact(d.subs) + " subscribers" : "") : (d.subs || "");
    $("#chan").innerHTML = `<a href="${chanHref(v)}">${avatar(d.author, d.avatar)}</a>
      <div><a href="${chanHref(v)}"><b>${esc(d.author)}</b></a><small>${esc(subs)}</small></div>`;
    showVotes();
    if (!d.full) return;
    watched.add({ id, title: d.title, author: d.author, channel: d.channel, avatar: d.avatar, thumb: ytThumb(id), views: d.views, when: d.when });
    db.hidden = false;
    $("#dm").textContent = dot(views(d.views), ago(d.when));
    $("#dd").textContent = d.desc || "";
    if (d.related?.length) $("#rel").innerHTML = d.related.slice(0, 20).map(relItem).join("");
    else relatedFallback(d.author);
  }
  function relatedFallback(q) {
    if (!q) return;
    api.search(q).then((l) => token === S.route && ($("#rel").innerHTML = l.filter((v) => v.id !== id).slice(0, 15).map(relItem).join("")))
      .catch(() => token === S.route && ($("#rel").innerHTML = ""));
  }

  async function useHls(url) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = url; return; }
    if (!window.Hls) await new Promise((ok, no) => {
      document.head.append(Object.assign(document.createElement("script"),
        { src: "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js", onload: ok, onerror: no }));
    });
    if (!window.Hls?.isSupported()) throw new Error("no hls");
    hls = new Hls();
    hls.on(Hls.Events.ERROR, (_, e) => e.fatal && next("stream failed"));
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  // Automatic fallback walks the proxied sources in order, then lands on the first embed.
  function next(why) {
    if (token !== S.route) return;
    const i = current + 1;
    if (i < sources.length) {
      msg.textContent = `${sources[current]?.label}: ${why}. Trying ${sources[i].label}…`;
      play(i);
    }
  }

  async function play(i) {
    stop();
    current = i;
    sel.value = i;
    const s = sources[i];
    const ext = $("#ext");
    if (s.kind === "embed") {
      if (!info?.full && !infoTried) {
        // Still show title, channel, description and up next while an embed plays.
        infoTried = true;
        firstOf("piped", (b) => api.videoFrom("piped", b, id))
          .catch(() => firstOf("invidious", (b) => api.videoFrom("invidious", b, id)))
          .then((d) => fillInfo({ ...d, full: true })).catch(() => {});
      }
      video.hidden = true; frame.hidden = false;
      frame.src = s.url;
      ext.href = s.url.replace("autoplay=1", "autoplay=0");
      setTimeout(() => current === i && (msg.textContent = ""), 2500);
      return;
    }
    ext.href = s.kind === "piped" ? `${s.base}/streams/${id}` : `${s.base}/watch?v=${id}`;
    video.hidden = false; frame.hidden = true;
    if (!msg.textContent) msg.textContent = `Loading from ${host(s.base)}…`;
    try {
      const d = await api.videoFrom(s.kind, s.base, id);
      if (token !== S.route || current !== i) return;
      fillInfo({ ...d, full: true });
      if (d.mp4) video.src = d.mp4;
      else if (d.hls) await useHls(d.hls);
      else throw new Error("no stream");
      stallTimer = setTimeout(() => video.readyState < 2 && next("too slow"), 10000);
    } catch (e) {
      if (current === i) next(e.message === "no stream" ? "no playable stream" : "server didn't answer");
    }
  }

  video.addEventListener("loadeddata", () => { clearTimeout(stallTimer); msg.textContent = ""; });
  video.addEventListener("error", () => { if (video.getAttribute("src") && !hls) next("stream failed"); });
  video.addEventListener("timeupdate", () => {
    if (!sb.checked) return;
    const seg = segments.find(([a, b]) => video.currentTime >= a && video.currentTime < b - 0.3);
    if (seg) { video.currentTime = seg[1]; msg.textContent = "Skipped sponsor"; setTimeout(() => (msg.textContent = ""), 1500); }
  });
  sel.onchange = () => { msg.textContent = ""; store("lastSource", sources[sel.value].label); play(+sel.value); };
  $("#nx").onclick = () => { msg.textContent = ""; const i = (current + 1) % sources.length; store("lastSource", sources[i].label); play(i); };

  // Extras from other APIs, all optional.
  getJSON(`https://sponsor.ajay.app/api/skipSegments?videoID=${id}&categories=${encodeURIComponent('["sponsor","selfpromo","interaction"]')}`)
    .then((l) => (segments = l.map((x) => x.segment))).catch(() => {});
  getJSON(`https://returnyoutubedislikeapi.com/votes?videoId=${id}`).then((r) => { votes = r; showVotes(); }).catch(() => {});
  getJSON(`https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`)
    .then((d) => setTimeout(() => {
      if (info?.full || token !== S.route) return;
      fillInfo({ title: d.title, author: d.author_name });
      watched.add({ id, title: d.title, author: d.author_name, thumb: ytThumb(id) });
      relatedFallback(d.author_name);
    }, 5000)).catch(() => {});

  const last = sources.findIndex((s) => s.label === store("lastSource"));
  play(last >= 0 ? last : 0);
}

function about() {
  page("about", "About");
  view.innerHTML = `<article class="prose">
  <h2>How bruhtube works</h2>
  <p>This site is just static files on GitHub Pages. It has no server of its own. It borrows public servers run by other people:</p>
  <table>
    <tr><th>Service</th><th>Used for</th></tr>
    <tr><td><a href="https://github.com/TeamPiped/Piped">Piped</a></td><td>Search, trending, channels, video info and playback. Piped servers fetch the video from YouTube and stream it through their own proxy, so your browser never talks to YouTube.</td></tr>
    <tr><td><a href="https://invidious.io">Invidious</a></td><td>Backup for all of the above. With <code>local=true</code> the video streams through the Invidious server instead of straight from Google.</td></tr>
    <tr><td><a href="https://sponsor.ajay.app">SponsorBlock</a></td><td>Community-marked sponsor segments, skipped automatically.</td></tr>
    <tr><td><a href="https://returnyoutubedislike.com">Return YouTube Dislike</a></td><td>Like and dislike counts.</td></tr>
    <tr><td><a href="https://noembed.com">noembed</a></td><td>Title and channel when nothing else answers.</td></tr>
  </table>

  <h3>Video sources</h3>
  <p>The <b>Source</b> menu under every video has four groups:</p>
  <ul>
    <li><b>Plays here (proxied)</b>: bruhtube asks a Piped or Invidious server for the video file and plays it in its own player. Sponsor skipping works here. If one fails, the next is tried automatically.</li>
    <li><b>YouTube players</b>: YouTube's own embedded player, with and without cookies.</li>
    <li><b>Piped players</b>: piped.video and its mirrors, each with its own embedded player.</li>
    <li><b>Invidious players</b>: each Invidious server's embedded player, streaming through that server.</li>
    <li><b>Other front-ends</b>: Poketube, CloudTube and ViewTube servers that allow being shown inside another site.</li>
  </ul>
  <p>For short vertical videos, try <a href="bruhtok/">bruhtok</a>: a swipeable feed of TikToks and YouTube Shorts.</p>
  <p>Use the arrow button next to the menu to jump to the next source, or the open button to try that source in its own tab.</p>
  <p>Every 6 hours a GitHub Action re-checks all the public server lists, keeps the ones that answer (and that allow being embedded), and commits them to <code>instances.json</code>.</p>

  <h2>Other YouTube proxies and front-ends</h2>
  <h3>Invidious</h3>
  <p>A self-hostable website written in Crystal. It talks to YouTube's internal API, strips ads and tracking, and can relay the video file through itself. Has a public JSON API.</p>
  <h3>Piped</h3>
  <p>Java back end built on NewPipe's extractor, with a Vue front end. Always proxies video through its own servers and has SponsorBlock built in. piped.video has mirrors on Cloudflare, Vercel, Netlify and others.</p>
  <h3>FreeTube</h3>
  <p>A desktop app for Windows, Mac and Linux. It talks to YouTube directly using YouTube.js, or to Invidious as a fallback. Subscriptions are stored on your computer.</p>
  <h3>NewPipe and LibreTube</h3>
  <p>Android apps. NewPipe pulls streams on the phone itself. LibreTube runs on the Piped API.</p>
  <h3>Poketube, CloudTube, ViewTube</h3>
  <p>Smaller YouTube front-ends. Poketube is written in Node and proxies video; CloudTube is a lightweight front-end that uses Invidious behind the scenes; ViewTube is a Nuxt app with its own player. Working servers show up under “Other front-ends”.</p>
  <h3>ProxiTok and tikwm (for TikTok)</h3>
  <p>ProxiTok is an open-source TikTok front-end that streams clips through its own server. tikwm is a public API that returns TikTok feeds, search results and watermark-free video files. bruhtok uses both.</p>
  <h3>Materialious</h3>
  <p>A Material-style client for Invidious. It doesn't support embeds, so it isn't in the source list.</p>
  <h3>Plain web proxies</h3>
  <p>General proxies (Ultraviolet, Rammerhead and similar) rewrite a whole website so it loads through another server. They work for youtube.com itself, but need a server running all the time, which GitHub Pages can't do.</p>

  <h2>Limits</h2>
  <p>YouTube keeps changing its player to block these tools, and big public servers get rate-limited, so any one server will break now and then. That's why the list is rechecked every few hours and every video has many fallbacks.</p>
  </article>`;
}

/* ---------- router ---------- */

function route() {
  S.cleanup?.(); S.cleanup = null;
  const token = ++S.route;
  const h = location.hash;
  const legacy = h.match(/^#v=([\w-]{11})/);
  if (legacy) return location.replace(`#/watch/${legacy[1]}`);
  const [, name, arg] = h.match(/^#\/([^/]*)\/?(.*)$/) || [];
  scrollTo(0, 0);
  if (name === "watch" && arg) return watch(token, arg.slice(0, 11));
  if (name === "search" && arg) return results(token, decodeURIComponent(arg));
  if (name === "channel" && arg) return channel(token, arg);
  if (name === "c") return category(token, arg);
  if (name === "trending") return trending(token);
  if (name === "history") return historyPage();
  if (name === "about") return about();
  home(token);
}

$("#menu").innerHTML = ICON.menu;
$("#go").innerHTML = ICON.search;
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
const themeIcon = () => ($("#theme").innerHTML = isDark() ? ICON.sun : ICON.moon);
$("#theme").onclick = () => {
  const t = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  store("theme", t);
  themeIcon();
};
themeIcon();

$("#search").onsubmit = (e) => {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return;
  $("#q").blur();
  const id = idFrom(q);
  location.hash = id ? `#/watch/${id}` : `#/search/${encodeURIComponent(q)}`;
};

(async () => {
  try {
    const d = await getJSON("instances.json", 6000);
    S.piped = d.piped || [];
    S.invidious = d.invidious || d.instances || [];
    S.pipedFrontends = d.pipedFrontends || [];
    S.invidiousEmbed = d.invidiousEmbed || [];
    S.ytFrontends = d.ytFrontends || [];
    S.ytChallenge = d.ytChallenge || [];
    S.pipedStreams = d.pipedStreams || d.piped || [];
    S.invidiousStreams = d.invidiousStreams || d.invidious || [];
    S.updated = d.updated;
  } catch {}
  addEventListener("hashchange", route);
  route();
})();
