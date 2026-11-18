# bruhtube

A YouTube front-end that runs entirely on GitHub Pages, with no server of its own.

## What it uses

| Service | For |
| --- | --- |
| [Piped](https://github.com/TeamPiped/Piped) API | search, trending, video info, proxied playback |
| [Invidious](https://invidious.io) API | backup for all of the above (`local=true` proxies the video) |
| [SponsorBlock](https://sponsor.ajay.app) | auto-skips sponsor segments |
| [Return YouTube Dislike](https://returnyoutubedislike.com) | like/dislike counts |
| [noembed](https://noembed.com) | title fallback |

## Video sources

The **Source** menu under every video has four groups:

- **Plays here (proxied)**: every working Piped and Invidious API server. The video file is streamed through that server into bruhtube's own player (SponsorBlock skipping works here). If one fails, the next is tried automatically.
- **YouTube players**: YouTube's embed, with and without cookies.
- **Piped players**: piped.video and its mirrors (cf., vc., re., fl., do., nf., az.) plus other Piped sites, each with its own embedded player.
- **Invidious players**: each Invidious server's embedded player, streaming through that server.
- **Other front-ends**: Poketube, CloudTube and ViewTube servers that allow being shown inside another site.

Next to the menu: a button that jumps to the next source, and one that opens the current source in a new tab. Your last pick is remembered.

## Pages

Home (trending + category shelves), Trending, History (saved in your browser only), 8 categories, search, channel pages, watch, and **About**, which explains how this works and compares other YouTube proxies (Invidious, Piped, FreeTube, NewPipe/LibreTube, Materialious, Ultraviolet-style web proxies). Light and dark themes, works on phones.

## bruhtok (`/bruhtok/`)

A swipeable vertical feed with a **TikTok** tab and a **Shorts** tab. For You feed, Explore with tags and search, account pages, likes saved in your browser, paste any TikTok or YouTube link. Arrow keys move between clips, `m` mutes.

| Service | For |
| --- | --- |
| [tikwm](https://www.tikwm.com) API | TikTok For You feed, search, accounts, watermark-free files that play in bruhtok's own player |
| TikTok embed players | official `player/v1` and classic `embed/v2` players |
| [ProxiTok](https://github.com/pablouser1/ProxiTok) | open-source TikTok front-end; each server streams the clip through itself |
| Piped / Invidious | YouTube Shorts: search, proxied playback and embed players |

Tap **Source** on any clip to pick where it plays from.

## Auto-updating

`.github/workflows/update.yml` runs every 6 hours (and on demand from the **Actions** tab). It:

1. pulls the public Piped and Invidious server lists,
2. checks that each server answers a search **and** allows browser requests (CORS),
3. checks which Piped websites and Invidious servers have an embed player that loads and may be shown inside another site,
4. checks Poketube / CloudTube / ViewTube servers, ProxiTok servers (from ProxiTok's official list) and tikwm,
5. commits the working ones to `instances.json` if anything changed.

## Turning it on

1. Merge this into `main` (scheduled workflows only run on the default branch).
2. Settings → Pages → Source: **Deploy from a branch**, branch **main**, folder **/ (root)**.
3. Settings → Actions → General → Workflow permissions: **Read and write**.

Site: `https://pallockpro.github.io/bruh/`

## Files

- `index.html`, `style.css`, `app.js` — bruhtube
- `bruhtok/` — bruhtok
- `instances.json` — working servers (auto-updated)
- `scripts/update-instances.mjs` — the checker the workflow runs
