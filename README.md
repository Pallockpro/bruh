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

Video plays in a normal `<video>` tag streamed through a Piped or Invidious server. If one fails, the page automatically moves to the next server, then to the Invidious and YouTube no-cookie embeds. You can also choose the source under the video.

The site has pages for Home (trending + categories), categories, search, watch, and **About**, which explains how this works and compares other YouTube proxies (Invidious, Piped, FreeTube, NewPipe/LibreTube, Ultraviolet-style web proxies).

## Auto-updating

`.github/workflows/update.yml` runs every 6 hours (and on demand from the **Actions** tab). It:

1. pulls the public Piped and Invidious server lists,
2. checks that each server answers a search **and** allows browser requests (CORS),
3. keeps the 10 fastest of each and commits them to `instances.json` if the list changed.

## Turning it on

1. Merge this into `main` (scheduled workflows only run on the default branch).
2. Settings → Pages → Source: **Deploy from a branch**, branch **main**, folder **/ (root)**.
3. Settings → Actions → General → Workflow permissions: **Read and write**.

Site: `https://pallockpro.github.io/bruh/`

## Files

- `index.html`, `style.css`, `app.js` — the site
- `instances.json` — working servers (auto-updated)
- `scripts/update-instances.mjs` — the checker the workflow runs
