// bruhtok: a vertical short-video feed.
// TikTok clips come from the tikwm API (feed, search, watermark-free files) and play
// through tikwm, TikTok's own embed players, or ProxiTok servers. YouTube Shorts come
// from Piped / Invidious. Server lists live in ../instances.json, refreshed by
// .github/workflows/update.yml.

const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  search: P('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>'),
  home: P('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'),
  compass: P('<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  info: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>'),
  tube: P('<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>'),
  heart: P('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  chat: P('<path d="M20 12a7.5 7 0 0 1-10.6 6.4L4.5 20l1.4-4A7 7 0 0 1 4.5 12 7.5 7 0 0 1 20 12z"/>'),
  share: P('<path d="M14 5l6 6-6 6v-3.5c-5 0-8 1.5-10 5 .5-5.5 3.5-9.5 10-10.5z"/>'),
  layers: P('<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>'),
  eye: P('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  note: P('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  muted: P('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5"/>'),
  sound: P('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  play: P('<path d="M8 5v14l11-7z"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  moon: P('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
};

const TAGS = ["funny", "dance", "cooking", "animals", "sports", "music", "gaming", "satisfying", "art", "fails", "science", "cars"];
const SHORTS_QUERIES = ["funny #shorts", "satisfying #shorts", "animals #shorts", "cooking #shorts", "sports #shorts",
  "music #shorts", "gaming #shorts", "science #shorts", "art #shorts", "skate #shorts", "comedy #shorts", "dance #shorts"];

const S = {
  piped: [], invidious: [], pipedStreams: [], invidiousStreams: [], pipedFrontends: [], invidiousEmbed: [],
  ytFrontends: [], ytChallenge: [], proxitok: [], tikwm: [], pool: [],
  route: 0, cleanup: null, muted: true, cache: {},
};
const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; }
}
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
const compact = (n) => (n == null || n < 0 || isNaN(n)) ? "" : Intl.NumberFormat("en", { notation: "compact" }).format(n);
const absUrl = (u, base) => !u ? "" : u.startsWith("//") ? "https:" + u : u.startsWith("/") ? base + u : u;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mode = () => store("tokMode") || (S.tikwm.length ? "tiktok" : "shorts");

async function getJSON(url, ms = 10000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
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

function avatar(name, url) {
  if (url) return `<img class="av" src="${esc(url)}" alt="" loading="lazy">`;
  let h = 0;
  for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="av" style="background:hsl(${h} 32% 42%)">${esc(String(name || "?").trim()[0]?.toUpperCase() || "?")}</span>`;
}

/* ---------- data: TikTok via tikwm ---------- */

function fromTikwm(v, b) {
  const a = v.author || {};
  const m = v.music_info || {};
  return {
    kind: "tt", id: String(v.video_id || v.aweme_id || v.id),
    desc: v.title || "", author: a.nickname || a.unique_id, user: a.unique_id,
    avatar: absUrl(a.avatar, b), cover: absUrl(v.cover || v.origin_cover, b),
    play: absUrl(v.play || v.wmplay, b), playBase: b,
    likes: v.digg_count, comments: v.comment_count, shares: v.share_count,
    music: m.title ? `${m.title}${m.author ? " · " + m.author : ""}` : "",
  };
}
const tikwmList = (d) => (Array.isArray(d.data) ? d.data : d.data?.videos || []);
function okTikwm(d) { if (d.code !== 0 && d.code !== undefined) throw new Error(d.msg || "tikwm error"); return d; }

const tt = {
  async feed() {
    return firstOf("tikwm", async (b) => {
      const l = tikwmList(okTikwm(await getJSON(`${b}/api/feed/list?region=US&count=12`))).map((v) => fromTikwm(v, b));
      if (!l.length) throw new Error("empty");
      return l;
    });
  },
  async search(q, cursor = 0) {
    return firstOf("tikwm", async (b) => {
      const d = okTikwm(await getJSON(`${b}/api/feed/search?keywords=${encodeURIComponent(q)}&count=20&cursor=${cursor}`));
      return { items: tikwmList(d).map((v) => fromTikwm(v, b)), cursor: d.data?.cursor, more: d.data?.hasMore };
    });
  },
  async user(name, cursor = 0) {
    return firstOf("tikwm", async (b) => {
      const d = okTikwm(await getJSON(`${b}/api/user/posts?unique_id=${encodeURIComponent(name)}&count=20&cursor=${cursor}`));
      return { items: tikwmList(d).map((v) => fromTikwm(v, b)), cursor: d.data?.cursor, more: d.data?.hasMore };
    });
  },
  // One clip by id or any TikTok link (short links too).
  async one(urlOrId) {
    const url = /^\d+$/.test(urlOrId) ? `https://www.tiktok.com/@_/video/${urlOrId}` : urlOrId;
    return firstOf("tikwm", async (b) => fromTikwm(okTikwm(await getJSON(`${b}/api/?url=${encodeURIComponent(url)}&hd=1`)).data, b));
  },
};

// Clip pool gathered by the GitHub Action (bruhtok/feed.json): used when tikwm's live
// feed or search can't be reached, and for searching captions and accounts.
function fromPool(i) {
  return { kind: "tt", id: String(i.id), desc: i.desc || "", author: i.author || i.user, user: i.user, avatar: i.avatar,
    cover: i.cover, likes: i.likes, comments: i.comments, shares: i.shares, music: i.music || "" };
}
function poolSearch(q) {
  const terms = q.toLowerCase().replace(/^[@#]/, "").split(/\s+/).filter(Boolean);
  const text = (i) => `${i.desc} ${i.author} ${i.user} ${i.music}`.toLowerCase();
  const all = S.pool.filter((i) => terms.every((t) => text(i).includes(t)));
  return all.length ? all : S.pool.filter((i) => terms.some((t) => text(i).includes(t)));
}

/* ---------- data: YouTube Shorts via Piped / Invidious ---------- */

const shortCover = (id, fallback) => [`https://i.ytimg.com/vi/${id}/oar2.jpg`, fallback || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`];

function shortFromPiped(i) {
  const id = (i.url || "").split("v=")[1]?.slice(0, 11);
  return { kind: "yt", id, desc: i.title, author: i.uploaderName, channel: (i.uploaderUrl || "").split("/").pop(),
    avatar: i.uploaderAvatar, covers: shortCover(id, i.thumbnail), views: i.views, seconds: i.duration, isShort: i.isShort };
}
function shortFromInv(v, b) {
  return { kind: "yt", id: v.videoId, desc: v.title, author: v.author, channel: v.authorId,
    covers: shortCover(v.videoId, `${b}/vi/${v.videoId}/hqdefault.jpg`), views: v.viewCount, seconds: v.lengthSeconds };
}
const isShortish = (v) => v.id && (v.isShort || (v.seconds > 0 && v.seconds <= 75));

const yt = {
  async search(q) {
    const e = encodeURIComponent(q);
    let list;
    try {
      list = await firstOf("piped", async (b) =>
        ((await getJSON(`${b}/search?q=${e}&filter=videos`)).items || []).filter((i) => i.url?.includes("watch?v=")).map(shortFromPiped));
    } catch {
      list = await firstOf("invidious", async (b) =>
        (await getJSON(`${b}/api/v1/search?q=${e}&type=video&duration=short`)).filter((v) => v.videoId).map((v) => shortFromInv(v, b)));
    }
    const shorts = list.filter(isShortish);
    return shorts.length ? shorts : list;
  },
  async stream(kind, b, id) {
    if (kind === "piped") {
      const d = await getJSON(`${b}/streams/${id}`, 12000);
      const muxed = (d.videoStreams || []).filter((s) => !s.videoOnly && s.url && /mp4/.test(s.mimeType || s.format || ""));
      muxed.sort((x, y) => (parseInt(y.quality) || 0) - (parseInt(x.quality) || 0));
      return { mp4: muxed[0]?.url, hls: d.hls, meta: { desc: d.title, author: d.uploader, avatar: d.uploaderAvatar, likes: d.likes, views: d.views } };
    }
    const d = await getJSON(`${b}/api/v1/videos/${id}?local=true`, 12000);
    const fmt = (d.formatStreams || []).filter((f) => f.url);
    fmt.sort((x, y) => (parseInt(y.qualityLabel || y.resolution) || 0) - (parseInt(x.qualityLabel || x.resolution) || 0));
    return { mp4: absUrl(fmt[0]?.url, b), hls: absUrl(d.hlsUrl, b), meta: { desc: d.title, author: d.author, likes: d.likeCount, views: d.viewCount } };
  },
};

/* ---------- where each clip can play from ---------- */

function sourcesFor(item) {
  const id = item.id, out = [];
  if (item.kind === "tt") {
    // tikwm's relay links redirect to a fresh copy of the clip on TikTok's servers (checked by scripts/probe.mjs).
    for (const b of S.tikwm.length ? S.tikwm : ["https://www.tikwm.com"]) {
      out.push({ group: "Plays here", label: `tikwm: ${host(b)}`, native: true, resolve: async () => ({ mp4: `${b}/video/media/play/${id}.mp4` }) });
      out.push({ group: "Plays here", label: `tikwm HD: ${host(b)}`, native: true, resolve: async () => ({ mp4: `${b}/video/media/hdplay/${id}.mp4` }) });
      out.push({ group: "Plays here", label: `tikwm lookup: ${host(b)}`, native: true,
        resolve: async () => ({ mp4: item.play && item.playBase === b ? item.play : (await tt.one(id)).play }) });
    }
    out.push(
      { group: "TikTok players", label: "TikTok player", url: `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&music_info=1&description=1&rel=0` },
      { group: "TikTok players", label: "TikTok embed (classic)", url: `https://www.tiktok.com/embed/v2/${id}` },
    );
    for (const b of S.proxitok) out.push({ group: "ProxiTok", label: `ProxiTok: ${host(b)}`, url: `${b}/@${encodeURIComponent(item.user || "placeholder")}/video/${id}` });
  } else {
    for (const b of S.pipedStreams) out.push({ group: "Plays here", label: `Piped API: ${host(b)}`, native: true, resolve: () => yt.stream("piped", b, id) });
    for (const b of S.invidiousStreams) out.push({ group: "Plays here", label: `Invidious API: ${host(b)}`, native: true, resolve: () => yt.stream("invidious", b, id) });
    out.push(
      { group: "YouTube players", label: "YouTube (no-cookie)", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&rel=0&playsinline=1` },
      { group: "YouTube players", label: "YouTube (standard)", url: `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&rel=0&playsinline=1` },
    );
    for (const f of S.pipedFrontends) out.push({ group: "Piped players", label: `Piped: ${host(f)}`, url: `${f}/embed/${id}?autoplay=1` });
    for (const b of S.invidiousEmbed) out.push({ group: "Invidious players", label: `Invidious: ${host(b)}`, url: `${b}/embed/${id}?autoplay=1&local=true` });
    for (const f of S.ytFrontends) out.push({ group: "Other front-ends", label: host(f), url: `${f}/watch?v=${id}` });
    for (const f of S.ytChallenge) out.push({ group: "May ask you to verify first", label: host(f),
      url: `${f}/${/invidious|inv\.|yewtu/.test(f) ? "embed/" + id : "watch?v=" + id}` });
  }
  return out;
}

/* ---------- the feed ---------- */

let hlsLoader = null;
function loadHls() {
  if (window.Hls) return Promise.resolve();
  return hlsLoader ||= new Promise((ok, no) => document.head.append(Object.assign(document.createElement("script"),
    { src: "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js", onload: ok, onerror: no })));
}

const likes = {
  all() { try { return new Set(JSON.parse(store("tokLikes") || "[]")); } catch { return new Set(); } },
  has(k) { return likes.all().has(k); },
  toggle(k) { const s = likes.all(); s.has(k) ? s.delete(k) : s.add(k); store("tokLikes", JSON.stringify([...s].slice(-500))); return s.has(k); },
};

function slideHTML(item, i) {
  const covers = item.covers || (item.cover ? [item.cover] : []);
  const bg = covers.map((c) => `url('${String(c).replace(/'/g, "%27")}')`).join(",");
  const who = item.kind === "tt" && item.user ? `#/@${encodeURIComponent(item.user)}` : `#/explore/${encodeURIComponent(item.author || "")}`;
  const key = `${item.kind}:${item.id}`;
  return `<section class="slide" data-i="${i}">
    <div class="clip" style="background-image:${esc(bg)}">
      <div class="shade"></div>
      <div class="cap">
        <a class="who" href="${who}">${item.user ? "@" + esc(item.user) : esc(item.author || "")}</a>
        <div class="txt">${esc(item.desc)}</div>
        ${item.music ? `<div class="song">${ICON.note}<span>${esc(item.music)}</span></div>` : ""}
      </div>
      <div class="hud"><button class="chipb snd" type="button">${S.muted ? ICON.muted + "Tap for sound" : ICON.sound}</button><span class="status"></span></div>
      <div class="paused" hidden>${ICON.play}</div>
    </div>
    <div class="rail">
      <a href="${who}" title="${esc(item.author)}">${avatar(item.author, item.avatar)}</a>
      <button class="act like ${likes.has(key) ? "liked" : ""}" type="button"><i>${ICON.heart}</i><span>${compact(item.likes) || "Like"}</span></button>
      ${item.kind === "tt" ? `<span class="act"><i>${ICON.chat}</i><span>${compact(item.comments) || "0"}</span></span>`
        : `<span class="act"><i>${ICON.eye}</i><span>${compact(item.views) || "–"}</span></span>`}
      <button class="act shr" type="button"><i>${ICON.share}</i><span>${compact(item.shares) || "Share"}</span></button>
      <button class="act src" type="button"><i>${ICON.layers}</i><span>Source</span></button>
    </div>
  </section>`;
}

// items: initial list; more: async () => next batch (or null when done)
function feed(token, items, more, start = 0) {
  view.innerHTML = `<div class="feed"></div>`;
  const box = $(".feed");
  const seen = new Set();
  const all = [];
  let active = null, loading = false, done = !more;
  const loader = document.createElement("div");
  loader.className = "loader";
  loader.textContent = "Loading…";

  function add(list) {
    const html = [];
    for (const it of list) {
      const k = `${it.kind}:${it.id}`;
      if (!it.id || seen.has(k)) continue;
      seen.add(k);
      html.push(slideHTML(it, all.length));
      all.push({ item: it, sources: null, cur: -1 });
    }
    loader.insertAdjacentHTML("beforebegin", html.join(""));
    box.querySelectorAll(".slide:not([data-o])").forEach((el) => { el.dataset.o = 1; seeObs.observe(el); });
  }

  async function loadMore() {
    if (loading || done || token !== S.route) return;
    loading = true;
    try {
      const list = await more();
      if (token !== S.route) return;
      if (!list || !list.length) { done = true; loader.textContent = all.length ? "You're all caught up." : "Nothing loaded. Try the other tab or search."; }
      else add(list);
    } catch {
      if (token === S.route) { done = !all.length; loader.textContent = all.length ? "Couldn't load more right now." : "No server answered. Try the other tab, or paste a link."; }
    }
    loading = false;
  }

  const seeObs = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting && e.intersectionRatio >= 0.6) activate(+e.target.dataset.i);
  }, { root: box, threshold: [0.6] });
  const endObs = new IntersectionObserver((ents) => ents.some((e) => e.isIntersecting) && loadMore(), { root: box, rootMargin: "200% 0px" });

  function unmount(i) {
    const el = box.querySelector(`.slide[data-i="${i}"]`);
    if (!el) return;
    const v = $("video", el);
    if (v) { v._hls?.destroy(); v.pause(); v.removeAttribute("src"); v.load(); v.remove(); }
    $("iframe", el)?.remove();
    $(".clip", el).classList.remove("framed");
    $(".paused", el).hidden = true;
  }

  function activate(i) {
    if (active === i) return;
    if (active != null) unmount(active);
    active = i;
    const a = all[i];
    if (!a) return;
    a.sources ||= sourcesFor(a.item);
    const pref = store(`tokSrc-${a.item.kind}`);
    const idx = a.sources.findIndex((s) => s.label === pref);
    play(i, idx >= 0 ? idx : 0);
    if (i >= all.length - 3) loadMore();
  }

  async function play(i, si) {
    const a = all[i], el = box.querySelector(`.slide[data-i="${i}"]`);
    if (!a || !el) return;
    unmount(i);
    a.cur = si;
    const s = a.sources[si], clip = $(".clip", el), status = $(".status", el);
    if (!s) { status.textContent = "Nothing could play this one. Scroll on."; return; }
    if (!s.native) {
      clip.classList.add("framed");
      const f = document.createElement("iframe");
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.src = s.url;
      clip.prepend(f);
      $(".snd", el).hidden = true;
      status.textContent = "";
      return;
    }
    $(".snd", el).hidden = false;
    status.textContent = `Loading from ${s.label}…`;
    const v = document.createElement("video");
    Object.assign(v, { loop: true, playsInline: true, muted: S.muted, autoplay: true, preload: "auto" });
    const poster = a.item.cover || a.item.covers?.[0];
    if (poster) v.poster = poster;
    clip.prepend(v);
    const fail = (why) => {
      if (active !== i || a.cur !== si) return;
      const next = si + 1;
      status.textContent = `${s.label}: ${why}`;
      play(i, next);
    };
    v.onerror = () => v.getAttribute("src") && !v._hls && fail("stream failed");
    v.onloadeddata = () => { status.textContent = ""; v.play().catch(() => { $(".paused", el).hidden = false; }); };
    v.onclick = () => { if (v.paused) { v.play(); $(".paused", el).hidden = true; } else { v.pause(); $(".paused", el).hidden = false; } };
    try {
      const r = await s.resolve();
      if (active !== i || a.cur !== si) return;
      if (r.meta) fillMeta(el, a.item, r.meta);
      if (r.mp4) v.src = r.mp4;
      else if (r.hls) {
        if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = r.hls;
        else {
          await loadHls();
          if (!window.Hls?.isSupported()) throw new Error("no stream");
          const h = new Hls();
          v._hls = h;
          h.on(Hls.Events.ERROR, (_, e) => e.fatal && fail("stream failed"));
          h.loadSource(r.hls); h.attachMedia(v);
        }
      } else throw new Error("no stream");
      setTimeout(() => active === i && a.cur === si && v.readyState < 2 && fail("too slow"), 12000);
    } catch (e) {
      fail(e.message === "no stream" ? "no playable file" : "server didn't answer");
    }
  }

  function fillMeta(el, item, m) {
    if (!item.desc && m.desc) $(".txt", el).textContent = item.desc = m.desc;
    if (item.likes == null && m.likes >= 0) { item.likes = m.likes; $(".like span", el).textContent = compact(m.likes); }
  }

  box.addEventListener("click", (e) => {
    const el = e.target.closest(".slide");
    if (!el) return;
    const i = +el.dataset.i, a = all[i];
    if (e.target.closest(".snd")) {
      S.muted = !S.muted;
      box.querySelectorAll("video").forEach((v) => { v.muted = S.muted; });
      box.querySelectorAll(".snd").forEach((b) => { b.innerHTML = S.muted ? ICON.muted + "Tap for sound" : ICON.sound; });
    } else if (e.target.closest(".like")) {
      const on = likes.toggle(`${a.item.kind}:${a.item.id}`);
      e.target.closest(".like").classList.toggle("liked", on);
    } else if (e.target.closest(".shr")) {
      const link = a.item.kind === "tt" ? `https://www.tiktok.com/@${a.item.user || "_"}/video/${a.item.id}` : `https://youtube.com/shorts/${a.item.id}`;
      navigator.clipboard?.writeText(link).then(() => { $(".shr span", el).textContent = "Copied"; });
    } else if (e.target.closest(".src")) {
      a.sources ||= sourcesFor(a.item);
      openSheet(a.sources, a.cur, (si) => { store(`tokSrc-${a.item.kind}`, a.sources[si].label); if (active !== i) el.scrollIntoView(); play(i, si); });
    }
  });

  function onKey(e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = (active ?? 0) + (e.key === "ArrowDown" ? 1 : -1);
      box.querySelector(`.slide[data-i="${n}"]`)?.scrollIntoView({ behavior: "smooth" });
    } else if (e.key === "m") box.querySelector(`.slide[data-i="${active}"] .snd`)?.click();
  }
  addEventListener("keydown", onKey);
  S.cleanup = () => { removeEventListener("keydown", onKey); if (active != null) unmount(active); seeObs.disconnect(); endObs.disconnect(); };

  box.append(loader);
  endObs.observe(loader);
  if (items?.length) {
    add(items);
    if (start > 0) requestAnimationFrame(() => box.querySelector(`.slide[data-i="${start}"]`)?.scrollIntoView());
  } else loadMore();
}

function openSheet(sources, cur, pick) {
  const groups = [...new Set(sources.map((s) => s.group))];
  $("#sheetlist").innerHTML = groups.map((g) => `<h5>${esc(g)}</h5>` + sources.map((s, i) => s.group !== g ? "" :
    `<button class="opt ${i === cur ? "on" : ""}" data-i="${i}" type="button"><span>${esc(s.label)}</span><small>${s.native ? "here" : "embed"}</small></button>`).join("")).join("");
  $("#sheet").hidden = false;
  $("#sheetlist").onclick = (e) => { const b = e.target.closest(".opt"); if (b) { $("#sheet").hidden = true; pick(+b.dataset.i); } };
}
$("#sheet").onclick = (e) => { if (e.target.id === "sheet") $("#sheet").hidden = true; };
$("#sheetx").innerHTML = ICON.x;
$("#sheetx").onclick = () => { $("#sheet").hidden = true; };

/* ---------- feed providers ---------- */

function forYouMore() {
  if (mode() === "tiktok") {
    let usePool = !S.tikwm.length, k = 0;
    const order = shuffle(S.pool.slice());
    return async () => {
      if (!usePool) { try { return await tt.feed(); } catch { usePool = true; } }
      const page = order.slice(k, k + 10);
      k += 10;
      return page.length ? page : null;
    };
  }
  const qs = shuffle(SHORTS_QUERIES.slice());
  let n = 0;
  return async () => (n < qs.length ? shuffle(await yt.search(qs[n++])) : null);
}
function searchMore(q) {
  if (mode() === "tiktok") {
    if (q === "_pool") { let first = true; return async () => (first ? (first = false, shuffle(S.pool.slice()).slice(0, 48)) : null); }
    let cursor = 0, more = !!S.tikwm.length, local = false;
    return async () => {
      if (local) return null;
      if (more) {
        try {
          const r = await tt.search(q, cursor);
          cursor = r.cursor; more = !!r.more;
          if (r.items.length) return r.items;
        } catch {}
      }
      // tikwm search is often blocked; search the clip pool instead.
      local = true;
      return poolSearch(q);
    };
  }
  let first = true;
  return async () => (first ? (first = false, yt.search(`${q} #shorts`)) : null);
}

/* ---------- pages ---------- */

function chrome(page) {
  document.body.className = `page-${page}`;
  const m = mode();
  $("#tabs").innerHTML = `<a href="#" data-m="tiktok" class="${m === "tiktok" ? "on" : ""}">TikTok</a><a href="#" data-m="shorts" class="${m === "shorts" ? "on" : ""}">Shorts</a>`;
  const link = (href, icon, label, key, cls = "") => `<a href="${href}" class="${cls} ${page === key ? "on" : ""}">${ICON[icon]}${label}</a>`;
  const dark = isDark();
  $("#links").innerHTML = link("#/", "home", "For You", "foryou") + link("#/explore", "compass", "Explore", "explore") +
    `<hr>` + link("../", "tube", "BruhTube", "", "small") + link("#/about", "info", "About", "about", "small") +
    `<a href="#" class="small" id="themeb">${dark ? ICON.sun : ICON.moon}${dark ? "Light mode" : "Dark mode"}</a>`;
  $("#themeb").onclick = (e) => {
    e.preventDefault();
    const t = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    store("theme", t);
    chrome(page);
  };
  $("#foot").innerHTML = `tikwm ${S.tikwm.length ? "online" : "offline"} · ${S.pool.length} saved clips · ${S.proxitok.length} ProxiTok · ${S.pipedStreams.length + S.invidiousStreams.length} YouTube players<br><a href="https://github.com/Pallockpro/bruh">Source on GitHub</a>`;
}
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
$("#tabs").onclick = (e) => {
  const a = e.target.closest("a[data-m]");
  if (!a) return;
  e.preventDefault();
  store("tokMode", a.dataset.m);
  route();
};

function forYou(token) {
  chrome("foryou");
  document.title = "For You · bruhtok";
  feed(token, [], forYouMore());
}

function single(token, kind, id) {
  chrome("foryou");
  document.title = "bruhtok";
  const item = kind === "tt" ? { kind: "tt", id } : { kind: "yt", id, covers: shortCover(id) };
  const rest = forYouMore();
  let first = kind === "tt";
  // For TikTok, try to fetch the clip's details first; the feed continues after it.
  feed(token, [item], async () => {
    if (first) {
      first = false;
      try {
        const full = await tt.one(id);
        const slide = $(`.slide[data-i="0"]`);
        if (slide && token === S.route) {
          Object.assign(item, full);
          $(".clip", slide).style.backgroundImage = `url('${full.cover}')`;
          $(".who", slide).textContent = full.user ? "@" + full.user : full.author;
          $(".txt", slide).textContent = full.desc;
        }
      } catch {}
    }
    return rest();
  });
}

function grid(list, q) {
  return `<div class="tgrid">${list.map((it, i) => {
    const cov = it.cover || it.covers?.[0];
    const fb = it.covers?.[1] || "";
    return `<a class="tcard" href="#/feed/${encodeURIComponent(q)}/${i}">
      <div class="cv"><img src="${esc(cov)}" ${fb ? `data-fb="${esc(fb)}"` : ""} alt="" loading="lazy">
        <span class="pc">${ICON.play}${compact(it.kind === "tt" ? it.likes : it.views)}</span></div>
      <div class="tt">${esc(it.desc)}</div><div class="tw">${esc(it.user ? "@" + it.user : it.author)}</div></a>`;
  }).join("")}</div>`;
}
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.dataset.fb) { img.src = img.dataset.fb; delete img.dataset.fb; }
}, true);

async function explore(token, q) {
  chrome("explore");
  document.title = (q ? `${q} · ` : "Explore · ") + "bruhtok";
  view.innerHTML = `<div class="explore">
    <h2>${q ? `Results for “${esc(q)}”` : "Explore"}</h2>
    <div class="tags">${TAGS.map((t) => `<a href="#/explore/${t}">#${t}</a>`).join("")}</div>
    <div id="res"><div class="empty">${q ? "Searching…" : "Pick a tag or search above."}</div></div></div>`;
  if (!q && mode() === "tiktok" && S.pool.length) {
    q = "_pool";
    $(".explore h2").textContent = "Popular right now";
  } else if (!q) {
    q = TAGS[Math.floor(Math.random() * TAGS.length)];
    $(".explore h2").textContent = `Explore: #${q}`;
  }
  const key = `${mode()}:${q}`;
  try {
    const more = searchMore(q);
    const list = S.cache[key]?.list || (await more()) || [];
    if (token !== S.route) return;
    S.cache[key] = { list, more };
    $("#res").innerHTML = list.length ? grid(list, q) : `<div class="empty">Nothing found.</div>`;
  } catch {
    if (token === S.route) $("#res").innerHTML = `<div class="empty">No server answered. Try the other tab.</div>`;
  }
}

async function fromSearch(token, q, start) {
  chrome("explore");
  const key = `${mode()}:${q}`;
  let c = S.cache[key];
  if (!c) {
    const more = searchMore(q);
    try { c = S.cache[key] = { list: (await more()) || [], more }; } catch { c = { list: [], more }; }
    if (token !== S.route) return;
  }
  document.body.className = "page-foryou";
  feed(token, c.list, c.more, start);
}

async function userPage(token, name) {
  chrome("explore");
  document.title = `@${name} · bruhtok`;
  view.innerHTML = `<div class="explore"><h2>@${esc(name)}</h2><div id="res"><div class="empty">Loading…</div></div></div>`;
  try {
    const r = await tt.user(name);
    if (token !== S.route) return;
    const key = `${mode()}:@${name}`;
    let cursor = r.cursor, more = r.more;
    S.cache[key] = { list: r.items, more: async () => { if (!more) return null; const n = await tt.user(name, cursor); cursor = n.cursor; more = n.more; return n.items; } };
    $("#res").innerHTML = r.items.length ? grid(r.items, "@" + name) : `<div class="empty">No videos.</div>`;
    if (r.items[0]) $(".explore h2").insertAdjacentHTML("afterbegin", avatar(r.items[0].author, r.items[0].avatar).replace('class="av"', 'class="av" style="width:56px;height:56px;display:inline-grid;vertical-align:middle;margin-right:12px"'));
  } catch {
    if (token !== S.route) return;
    const mine = S.pool.filter((i) => (i.user || "").toLowerCase() === name.toLowerCase());
    S.cache[`${mode()}:@${name}`] = { list: mine, more: null };
    $("#res").innerHTML = (mine.length ? grid(mine, "@" + name) : "") +
      `<h2 style="margin-top:24px">From TikTok</h2><iframe class="profile" src="https://www.tiktok.com/embed/@${encodeURIComponent(name)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen"></iframe>`;
  }
}

function about() {
  chrome("about");
  document.title = "About · bruhtok";
  view.innerHTML = `<div class="explore"><article class="prose">
    <h2>How bruhtok works</h2>
    <p>bruhtok is the short-video side of <a href="../">bruhtube</a>. It's plain static files with no server of its own; everything comes from public services:</p>
    <table>
      <tr><th>Service</th><th>Used for</th></tr>
      <tr><td><a href="https://www.tikwm.com">tikwm</a></td><td>TikTok For You feed, search, accounts, and watermark-free video files that play right here.</td></tr>
      <tr><td>TikTok embed players</td><td>TikTok's official <code>player/v1</code> and classic <code>embed/v2</code> players.</td></tr>
      <tr><td><a href="https://github.com/pablouser1/ProxiTok">ProxiTok</a></td><td>Open-source TikTok front-end. Each server fetches the clip and streams it through itself.</td></tr>
      <tr><td><a href="https://github.com/TeamPiped/Piped">Piped</a> and <a href="https://invidious.io">Invidious</a></td><td>YouTube Shorts: search, proxied playback, and their embed players.</td></tr>
    </table>
    <p>Tap <b>Source</b> on any clip to switch where it plays from. Sources marked “here” play in bruhtok's own player and skip to the next one by themselves if they fail. Your choice is remembered.</p>
    <p>A GitHub Action checks every server list every 6 hours and keeps only the ones that work.</p>
    <p>Keys: <code>↑</code> <code>↓</code> to move between clips, <code>m</code> to mute.</p>
  </article></div>`;
}

/* ---------- router ---------- */

function route() {
  S.cleanup?.(); S.cleanup = null;
  $("#sheet").hidden = true;
  const token = ++S.route;
  const h = decodeURIComponent(location.hash.slice(1) || "/");
  let m;
  if ((m = h.match(/^\/watch\/(tt|yt)\/([\w-]+)/))) return single(token, m[1], m[2]);
  if ((m = h.match(/^\/feed\/(.+)\/(\d+)$/))) return fromSearch(token, m[1], +m[2]);
  if ((m = h.match(/^\/explore\/?(.*)$/))) return explore(token, m[1]);
  if ((m = h.match(/^\/@([\w.-]+)/))) return userPage(token, m[1]);
  if (h.startsWith("/about")) return about();
  forYou(token);
}

$("#go").innerHTML = ICON.search;
$("#tbsearch").innerHTML = ICON.search;
$("#find").onsubmit = async (e) => {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return;
  $("#q").blur();
  let m;
  if ((m = q.match(/tiktok\.com\/.*?video\/(\d+)/))) { location.hash = `#/watch/tt/${m[1]}`; return; }
  if (/^https?:\/\/(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//.test(q)) {
    try { const it = await tt.one(q); location.hash = `#/watch/tt/${it.id}`; } catch { alert("Couldn't open that TikTok link right now."); }
    return;
  }
  if ((m = q.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/))) { location.hash = `#/watch/yt/${m[1]}`; return; }
  location.hash = `#/explore/${encodeURIComponent(q)}`;
};

(async () => {
  try {
    const d = await getJSON("../instances.json", 6000);
    for (const k of ["piped", "invidious", "pipedStreams", "invidiousStreams", "pipedFrontends", "invidiousEmbed", "ytFrontends", "ytChallenge", "proxitok", "tikwm"]) S[k] = d[k] || [];
    if (!d.pipedStreams) S.pipedStreams = S.piped;
    if (!d.invidiousStreams) S.invidiousStreams = S.invidious;
  } catch {}
  try { S.pool = ((await getJSON("feed.json", 6000)).items || []).map(fromPool); } catch {}
  addEventListener("hashchange", route);
  route();
})();
