// Diagnostic: prints how each candidate source answers, so broken ones can be fixed.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const TT = "6718335390845095173", YT = "jNQXAC9IVRw";
const checks = [
  ["GET", `https://www.tikwm.com/api/feed/search?keywords=cat&count=3&cursor=0`],
  ["POST", `https://www.tikwm.com/api/feed/search`, "keywords=cat&count=3&cursor=0"],
  ["GET", `https://www.tikwm.com/api/feed/list?region=US&count=3`],
  ["GET", `https://www.tikwm.com/api/?url=https://www.tiktok.com/@scout2015/video/${TT}&hd=1`],
  ["GET", `https://tikwm.com/api/feed/search?keywords=cat&count=3&cursor=0`],
  ["GET", `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@scout2015/video/${TT}`],
  ["GET", `https://www.tiktok.com/player/v1/${TT}`],
  ["GET", `https://www.tiktok.com/embed/v2/${TT}`],
  ["GET", `https://www.tiktok.com/embed/@scout2015`],
  ["GET", `https://www.reddit.com/r/TikTokCringe/hot.json?limit=5`],
  ["GET", `https://api.reddit.com/r/TikTokCringe/hot?limit=5`],
  ["GET", `https://proxitok.pabloferreiro.es/@scout2015/video/${TT}`],
  ["GET", `https://proxitok.pussthecat.org/trending`],
  ["GET", `https://pipedapi.ducks.party/streams/${YT}`],
  ["GET", `https://api.piped.private.coffee/streams/${YT}`],
  ["GET", `https://yt.chocolatemoo53.com/api/v1/videos/${YT}?local=true`],
  ["GET", `https://yt.chocolatemoo53.com/embed/${YT}`],
  ["GET", `https://yewtu.be/embed/${YT}`],
  ["GET", `https://inv.nadeko.net/embed/${YT}`],
  ["GET", `https://poketube.fun/watch?v=${YT}`],
  ["GET", `https://poketube.fun/embed?v=${YT}`],
  ["GET", `https://tube.cadence.moe/watch?v=${YT}`],
  ["GET", `https://viewtube.io/watch?v=${YT}`],
  ["GET", `https://piped.ducks.party/embed/${YT}`],
];
for (const [method, url, body] of checks) {
  try {
    const res = await fetch(url, {
      method, body, redirect: "follow", signal: AbortSignal.timeout(15000),
      headers: { "user-agent": UA, origin: "https://pallockpro.github.io", referer: "https://pallockpro.github.io/",
        ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    });
    const text = await res.text();
    const h = (k) => res.headers.get(k) || "-";
    console.log(`\n### ${method} ${url}\n status=${res.status} final=${res.url}\n acao=${h("access-control-allow-origin")} xfo=${h("x-frame-options")} csp-fa=${(h("content-security-policy").match(/frame-ancestors[^;]*/) || ["-"])[0]} server=${h("server")}`);
    console.log(" body:", text.slice(0, 400).replace(/\s+/g, " "));
    const ids = [...new Set([...text.matchAll(/video\/(\d{18,20})/g)].map((m) => m[1]))];
    if (ids.length) console.log(" tiktok ids found:", ids.length, ids.slice(0, 3));
  } catch (e) {
    console.log(`\n### ${method} ${url}\n ERROR ${e.message} ${e.cause?.code || ""}`);
  }
}
