// bruhtube — a static YouTube front-end.
// Data comes from public Piped and Invidious servers (list kept fresh by
// .github/workflows/update.yml), plus Return YouTube Dislike, SponsorBlock
// and noembed for extras.

const CATEGORIES = [
  { slug: "music", name: "Music", q: "new music video" },
  { slug: "gaming", name: "Gaming", q: "gaming" },
  { slug: "news", name: "News", q: "news today" },
  { slug: "sports", name: "Sports", q: "sports highlights" },
  { slug: "comedy", name: "Comedy", q: "comedy sketch" },
  { slug: "science", name: "Science", q: "science explained" },
  { slug: "movies", name: "Trailers", q: "official trailer" },
];

const S = { piped: [], invidious: [], route: 0, cleanup: null };
const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

/* ---------- small helpers ---------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; }
}

function dur(s) {
  if (!s || s < 0) return "";
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
}
const compact = (n) => (n == null || n < 0) ? "" : Intl.NumberFormat("en", { notation: "compact" }).format(n);

function ago(d) {
  if (!d) return "";
  if (typeof d === "string" && isNaN(Date.parse(d))) return d; // already "3 days ago"
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

/* ---------- normalizing Piped and Invidious data ---------- */

const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function fromPiped(i) {
  const id = (i.url || "").split("v=")[1]?.slice(0, 11);
  return {
    id, title: i.title, author: i.uploaderName, channel: (i.uploaderUrl || "").split("/").pop(),
    seconds: i.duration, views: i.views, when: i.uploadedDate || i.uploaded, thumb: i.thumbnail || ytThumb(id),
  };
}
function fromInv(v, base) {
  return {
    id: v.videoId, title: v.title, author: v.author, channel: v.authorId,
    seconds: v.lengthSeconds, views: v.viewCount, when: v.publishedText || v.published,
    thumb: `${base}/vi/${v.videoId}/mqdefault.jpg`, live: v.liveNow,
  };
}
const nonEmpty = (list) => { if (!list.length) throw new Error("empty"); return list; };

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

  // Full video info + a playable stream from one specific server.
  async videoFrom(kind, base, id) {
    if (kind === "piped") {
      const d = await getJSON(`${base}/streams/${id}`, 12000);
      const muxed = (d.videoStreams || []).filter((s) => !s.videoOnly && s.url && /mp4/.test(s.mimeType || s.format || ""));
      muxed.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
      return {
        title: d.title, author: d.uploader, channel: (d.uploaderUrl || "").split("/").pop(),
        views: d.views, likes: d.likes, dislikes: d.dislikes, when: d.uploadDate,
        desc: htmlToText(d.description),
        related: (d.relatedStreams || []).filter((i) => i.url?.includes("watch?v=")).map(fromPiped),
        mp4: muxed[0]?.url, hls: d.hls,
      };
    }
    const d = await getJSON(`${base}/api/v1/videos/${id}?local=true`, 12000);
    const fmt = (d.formatStreams || []).filter((f) => f.url);
    fmt.sort((a, b) => (parseInt(b.qualityLabel || b.resolution) || 0) - (parseInt(a.qualityLabel || a.resolution) || 0));
    const abs = (u) => u && (u.startsWith("http") ? u : base + u);
    return {
      title: d.title, author: d.author, channel: d.authorId,
      views: d.viewCount, likes: d.likeCount, when: d.publishedText || d.published,
      desc: d.description,
      related: (d.recommendedVideos || []).map((v) => fromInv(v, base)),
      mp4: abs(fmt[0]?.url), hls: abs(d.hlsUrl),
    };
  },
};

function htmlToText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n"), "text/html");
  return doc.body.textContent || "";
}

/* ---------- rendering ---------- */

function card(v) {
  const meta = [v.author, v.views != null && v.views >= 0 ? compact(v.views) + " views" : "", ago(v.when)].filter(Boolean).join(" · ");
  return `<a class="card" href="#/watch/${esc(v.id)}">
    <div class="th"><img loading="lazy" src="${esc(v.thumb)}" data-id="${esc(v.id)}" alt="">
      <span class="len">${v.live ? "LIVE" : dur(v.seconds)}</span></div>
    <div class="t">${esc(v.title)}</div>
    <div class="m">${esc(meta)}</div></a>`;
}
function rowItem(v) {
  return `<a class="row" href="#/watch/${esc(v.id)}">
    <div class="th"><img loading="lazy" src="${esc(v.thumb)}" data-id="${esc(v.id)}" alt="">
      <span class="len">${dur(v.seconds)}</span></div>
    <div><div class="t">${esc(v.title)}</div><div class="m">${esc(v.author)}</div></div></a>`;
}

// Proxied thumbnails sometimes 404; fall back to YouTube's image server.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.dataset.id && !img.dataset.fb) {
    img.dataset.fb = 1;
    img.src = ytThumb(img.dataset.id);
  }
}, true);

function section(title, more) {
  const el = document.createElement("section");
  el.className = "sec";
  el.innerHTML = `<h2 class="sec-h">${esc(title)}${more ? `<a href="${more}">more →</a>` : ""}</h2><div class="note">loading…</div>`;
  view.append(el);
  return {
    fill(list) { el.querySelector(".note")?.replaceWith(Object.assign(document.createElement("div"), { className: "grid", innerHTML: list.map(card).join("") })); },
    fail(msg) { el.querySelector(".note").textContent = msg; },
  };
}

function setNav(active) {
  $("#nav").innerHTML = [`<a href="#/" class="${active === "home" ? "on" : ""}">Home</a>`,
    ...CATEGORIES.map((c) => `<a href="#/c/${c.slug}" class="${active === c.slug ? "on" : ""}">${c.name}</a>`),
    `<a href="#/about" class="${active === "about" ? "on" : ""}">About</a>`].join("");
}

/* ---------- pages ---------- */

function home(token) {
  setNav("home");
  view.innerHTML = "";
  document.title = "bruhtube";
  const t = section("Trending");
  api.trending().then((l) => token === S.route && t.fill(l.slice(0, 12)))
    .catch(() => token === S.route && t.fail("couldn't reach any server for trending right now."));
  for (const c of CATEGORIES.slice(0, 4)) {
    const s = section(c.name, `#/c/${c.slug}`);
    api.search(c.q).then((l) => token === S.route && s.fill(l.slice(0, 8)))
      .catch(() => token === S.route && s.fail("nothing loaded."));
  }
}

function category(token, slug) {
  const c = CATEGORIES.find((x) => x.slug === slug);
  if (!c) return home(token);
  setNav(slug);
  view.innerHTML = "";
  document.title = `${c.name} · bruhtube`;
  const s = section(c.name);
  api.search(c.q).then((l) => token === S.route && s.fill(l)).catch(() => token === S.route && s.fail("nothing loaded."));
}

function results(token, q) {
  setNav("");
  view.innerHTML = "";
  $("#q").value = q;
  document.title = `${q} · bruhtube`;
  const s = section(`Results for “${q}”`);
  api.search(q).then((l) => token === S.route && s.fill(l))
    .catch(() => token === S.route && s.fail("search is down on every server right now. pasting a youtube link still works."));
}

async function watch(token, id) {
  setNav("");
  document.title = "bruhtube";
  view.innerHTML = `<div class="watch">
    <div>
      <div class="stage"><video controls playsinline autoplay></video><iframe hidden allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><div class="msg"></div></div>
      <h1 id="vt">&nbsp;</h1>
      <div class="by" id="vb"></div>
      <div class="tools">
        <label>source <select id="src"></select></label>
        <label><input type="checkbox" id="sb"> skip sponsors</label>
        <button id="cp" type="button">copy link</button>
      </div>
      <details id="vd" hidden><summary>description</summary><p class="desc"></p></details>
    </div>
    <aside class="next"><h3>Up next</h3><div id="rel"><div class="note">loading…</div></div></aside>
  </div>`;

  const video = $(".stage video"), frame = $(".stage iframe"), msg = $(".stage .msg");
  const sel = $("#src"), sb = $("#sb");
  let hls = null, segments = [], votes = null, filled = false, stallTimer = null, current = -1;

  sb.checked = store("skipSponsors") !== "0";
  sb.onchange = () => store("skipSponsors", sb.checked ? "1" : "0");
  $("#cp").onclick = () => navigator.clipboard?.writeText(`https://youtu.be/${id}`).then(() => ($("#cp").textContent = "copied"));

  const sources = [
    ...S.piped.map((b) => ({ kind: "piped", base: b, label: `piped · ${new URL(b).hostname}` })),
    ...S.invidious.map((b) => ({ kind: "invidious", base: b, label: `invidious · ${new URL(b).hostname}` })),
    { kind: "invembed", label: "invidious player (embed)" },
    { kind: "yt", label: "youtube player (embed)" },
  ];
  sel.innerHTML = sources.map((s, i) => `<option value="${i}">${esc(s.label)}</option>`).join("");

  function stop() {
    clearTimeout(stallTimer);
    hls?.destroy(); hls = null;
    video.pause(); video.removeAttribute("src"); video.load();
    frame.src = "about:blank";
  }
  S.cleanup = stop;

  function fillInfo(d) {
    if (filled || token !== S.route || !d?.title) return;
    filled = true;
    document.title = `${d.title} · bruhtube`;
    $("#vt").textContent = d.title;
    const bits = [];
    if (d.author) bits.push(`<a href="#/search/${encodeURIComponent(d.author)}">${esc(d.author)}</a>`);
    if (d.views >= 0 && d.views != null) bits.push(`<span>${compact(d.views)} views</span>`);
    if (d.when) bits.push(`<span>${esc(ago(d.when))}</span>`);
    bits.push(`<span id="votes">${d.likes >= 0 && d.likes != null ? `▲ ${compact(d.likes)}` : ""}</span>`);
    $("#vb").innerHTML = bits.join("");
    showVotes();
    if (d.desc) { $("#vd").hidden = false; $("#vd .desc").textContent = d.desc; }
    if (d.related?.length) $("#rel").innerHTML = d.related.slice(0, 20).map(rowItem).join("");
    else if (d.author) api.search(d.author).then((l) => token === S.route && ($("#rel").innerHTML = l.filter((v) => v.id !== id).slice(0, 15).map(rowItem).join("")));
  }

  async function useHls(url) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = url; return; }
    if (!window.Hls) await new Promise((ok, no) => {
      const s = Object.assign(document.createElement("script"), { src: "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js", onload: ok, onerror: no });
      document.head.append(s);
    });
    if (!window.Hls?.isSupported()) throw new Error("no hls");
    hls = new Hls();
    hls.on(Hls.Events.ERROR, (_, e) => e.fatal && next("stream failed"));
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  function next(why) {
    if (token !== S.route) return;
    if (current + 1 < sources.length) { msg.textContent = `${sources[current]?.label}: ${why}, trying next…`; play(current + 1); }
    else msg.textContent = "nothing could play this video. try another source from the list.";
  }

  async function play(i) {
    stop();
    current = i;
    sel.value = i;
    const s = sources[i];
    if (s.kind === "yt" || s.kind === "invembed") {
      video.hidden = true; frame.hidden = false;
      frame.src = s.kind === "yt"
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
        : `${S.invidious[0] || "https://yewtu.be"}/embed/${id}?autoplay=1&local=true`;
      msg.textContent = "";
      return;
    }
    video.hidden = false; frame.hidden = true;
    msg.textContent = `loading from ${new URL(s.base).hostname}…`;
    try {
      const d = await api.videoFrom(s.kind, s.base, id);
      if (token !== S.route || current !== i) return;
      fillInfo(d);
      if (d.mp4) video.src = d.mp4;
      else if (d.hls) await useHls(d.hls);
      else throw new Error("no stream");
      stallTimer = setTimeout(() => video.readyState < 2 && next("too slow"), 15000);
    } catch (e) {
      if (current === i) next(e.message === "no stream" ? "no playable stream" : "server didn't answer");
    }
  }

  video.addEventListener("loadeddata", () => { clearTimeout(stallTimer); msg.textContent = ""; store("lastSource", sources[current]?.label); });
  video.addEventListener("error", () => { if (video.getAttribute("src") && !hls) next("stream failed"); });
  video.addEventListener("timeupdate", () => {
    if (!sb.checked) return;
    const seg = segments.find(([a, b]) => video.currentTime >= a && video.currentTime < b - 0.3);
    if (seg) { video.currentTime = seg[1]; msg.textContent = "skipped sponsor"; setTimeout(() => (msg.textContent = ""), 1500); }
  });
  sel.onchange = () => { store("lastSource", sources[sel.value].label); play(+sel.value); };

  // Extras from other APIs, all optional.
  getJSON(`https://sponsor.ajay.app/api/skipSegments?videoID=${id}&categories=${encodeURIComponent('["sponsor","selfpromo","interaction"]')}`)
    .then((l) => (segments = l.map((x) => x.segment))).catch(() => {});
  function showVotes() {
    const v = $("#votes");
    if (v && votes && token === S.route) v.textContent = `▲ ${compact(votes.likes)}  ▼ ${compact(votes.dislikes)}`;
  }
  getJSON(`https://returnyoutubedislikeapi.com/votes?videoId=${id}`).then((r) => { votes = r; showVotes(); }).catch(() => {});
  getJSON(`https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`)
    .then((d) => setTimeout(() => fillInfo({ title: d.title, author: d.author_name }), 4000)).catch(() => {});

  const last = sources.findIndex((s) => s.label === store("lastSource"));
  play(last >= 0 ? last : 0);
}

function about() {
  setNav("about");
  document.title = "how this works · bruhtube";
  view.innerHTML = `<article class="prose">
  <h2>How bruhtube works</h2>
  <p>This site is just static files on GitHub Pages. It has no server of its own. It borrows public servers run by other people:</p>
  <table>
    <tr><th>Service</th><th>Used for</th></tr>
    <tr><td><a href="https://github.com/TeamPiped/Piped">Piped</a></td><td>Search, trending, video info and playback. Piped servers download the video from YouTube and stream it through their own proxy, so your browser never talks to YouTube.</td></tr>
    <tr><td><a href="https://invidious.io">Invidious</a></td><td>Backup for everything above. With <code>local=true</code> the video is streamed through the Invidious server instead of straight from Google.</td></tr>
    <tr><td><a href="https://sponsor.ajay.app">SponsorBlock</a></td><td>Community-submitted sponsor segments, skipped automatically.</td></tr>
    <tr><td><a href="https://returnyoutubedislike.com">Return YouTube Dislike</a></td><td>Like and dislike counts.</td></tr>
    <tr><td><a href="https://noembed.com">noembed</a></td><td>Title and channel name when nothing else answers.</td></tr>
  </table>
  <p>Every 6 hours a GitHub Action re-checks the public server lists, keeps the ones that actually answer, and commits them to <code>instances.json</code>. The page loads that file and tries servers in order until one works. If a video won't play, it moves on to the next server by itself, or you can pick one under the video.</p>

  <h2>Other YouTube proxies and front-ends</h2>
  <h3>Invidious</h3>
  <p>A self-hostable website written in Crystal. It scrapes YouTube's own internal API, strips ads and tracking, and can relay the video file through itself. Has a public JSON API, which this site uses.</p>
  <h3>Piped</h3>
  <p>Java back end built on NewPipe's extractor, with a Vue front end. Always proxies video through its own servers, and builds SponsorBlock in. Its public API is the main source here.</p>
  <h3>FreeTube</h3>
  <p>A desktop app (Windows, Mac, Linux). It talks to YouTube directly using YouTube.js, or to Invidious as a fallback. Subscriptions are stored on your computer.</p>
  <h3>NewPipe and LibreTube</h3>
  <p>Android apps. NewPipe extracts streams on the phone itself. LibreTube runs on the Piped API.</p>
  <h3>Plain web proxies</h3>
  <p>General proxies (Ultraviolet, Rammerhead and the like) rewrite a whole website so it loads through another server. They work for youtube.com itself, but they are heavy and need a server running all the time, which GitHub Pages can't do.</p>

  <h2>Limits</h2>
  <p>YouTube keeps changing its player to block these tools, and big public servers get rate-limited. So any one server will break now and then. That's why the list is rechecked every few hours, and why every video has a few fallbacks.</p>
  </article>`;
}

/* ---------- router ---------- */

function route() {
  S.cleanup?.(); S.cleanup = null;
  const token = ++S.route;
  const h = location.hash;
  const legacy = h.match(/^#v=([\w-]{11})/);
  if (legacy) return location.replace(`#/watch/${legacy[1]}`);
  const [, page, arg] = h.match(/^#\/([^/]*)\/?(.*)$/) || [];
  scrollTo(0, 0);
  if (page === "watch" && arg) return watch(token, arg.slice(0, 11));
  if (page === "search" && arg) return results(token, decodeURIComponent(arg));
  if (page === "c") return category(token, arg);
  if (page === "about") return about();
  home(token);
}

$("#search").onsubmit = (e) => {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return;
  const id = idFrom(q);
  location.hash = id ? `#/watch/${id}` : `#/search/${encodeURIComponent(q)}`;
};

(async () => {
  try {
    const d = await getJSON("instances.json", 6000);
    S.piped = d.piped || [];
    S.invidious = d.invidious || d.instances || [];
    $("#servers").textContent = `${S.piped.length} piped + ${S.invidious.length} invidious servers` +
      (d.updated ? ` · checked ${ago(d.updated)}` : "");
  } catch {
    $("#servers").textContent = "server list didn't load";
  }
  addEventListener("hashchange", route);
  route();
})();
