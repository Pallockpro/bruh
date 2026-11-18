// Diagnostic: prints how each candidate source answers, so broken ones can be fixed.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const TT = "6718335390845095173", YT = "jNQXAC9IVRw";
const checks = [
  ["GET", `https://www.tikwm.com/api/user/posts?unique_id=khaby.lame&count=3&cursor=0`],
  ["GET", `https://www.tikwm.com/video/media/play/${TT}.mp4`],
  ["GET", `https://www.tikwm.com/video/media/hdplay/${TT}.mp4`],
];
// Print the play links tikwm hands out, then test them.
try {
  const d = await (await fetch(`https://www.tikwm.com/api/?url=https://www.tiktok.com/@scout2015/video/${TT}&hd=1`, { headers: { "user-agent": UA } })).json();
  console.log("play:", d.data?.play, "\nhdplay:", d.data?.hdplay, "\nwmplay:", d.data?.wmplay);
  for (const k of ["play", "hdplay"]) if (d.data?.[k]) checks.push(["GET", d.data[k].startsWith("/") ? "https://www.tikwm.com" + d.data[k] : d.data[k]]);
  const f = await (await fetch(`https://www.tikwm.com/api/feed/list?region=US&count=2`, { headers: { "user-agent": UA } })).json();
  console.log("feed play:", f.data?.[0]?.play);
  if (f.data?.[0]?.play) checks.push(["GET", f.data[0].play]);
} catch (e) { console.log("tikwm lookup failed", e.message); }
for (const [method, url, body] of checks) {
  try {
    const res = await fetch(url, {
      method, body, redirect: "follow", signal: AbortSignal.timeout(15000),
      headers: { "user-agent": UA, origin: "https://pallockpro.github.io", referer: "https://pallockpro.github.io/",
        ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    });
    const isVideo = /video|octet/.test(res.headers.get("content-type") || "");
    const text = isVideo ? `[video ${res.headers.get("content-type")} ${res.headers.get("content-length")} bytes]` : await res.text();
    const h = (k) => res.headers.get(k) || "-";
    console.log(`\n### ${method} ${url}\n status=${res.status} final=${res.url}\n acao=${h("access-control-allow-origin")} xfo=${h("x-frame-options")} csp-fa=${(h("content-security-policy").match(/frame-ancestors[^;]*/) || ["-"])[0]} server=${h("server")}`);
    console.log(" body:", text.slice(0, 400).replace(/\s+/g, " "));
    const ids = [...new Set([...text.matchAll(/video\/(\d{18,20})/g)].map((m) => m[1]))];
    if (ids.length) console.log(" tiktok ids found:", ids.length, ids.slice(0, 3));
  } catch (e) {
    console.log(`\n### ${method} ${url}\n ERROR ${e.message} ${e.cause?.code || ""}`);
  }
}
