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

Next to the menu: a button that jumps to the next source, and one that opens the current source in a new tab. Your last pick is remembered.

## Pages

Home (trending + category shelves), Trending, History (saved in your browser only), 8 categories, search, channel pages, watch, and **About**, which explains how this works and compares other YouTube proxies (Invidious, Piped, FreeTube, NewPipe/LibreTube, Materialious, Ultraviolet-style web proxies). Light and dark themes, works on phones.

## Auto-updating

`.github/workflows/update.yml` runs every 6 hours (and on demand from the **Actions** tab). It:

1. pulls the public Piped and Invidious server lists,
2. checks that each server answers a search **and** allows browser requests (CORS),
3. checks which Piped websites and Invidious servers have an embed player that loads and may be shown inside another site,
4. commits the working ones to `instances.json` if anything changed.

## Turning it on

1. Merge this into `main` (scheduled workflows only run on the default branch).
2. Settings → Pages → Source: **Deploy from a branch**, branch **main**, folder **/ (root)**.
3. Settings → Actions → General → Workflow permissions: **Read and write**.

Site: `https://pallockpro.github.io/bruh/`

## Files

- `index.html`, `style.css`, `app.js` — the site
- `instances.json` — working servers (auto-updated)
- `scripts/update-instances.mjs` — the checker the workflow runs
