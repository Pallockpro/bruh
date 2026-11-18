# BruhTube

A YouTube front-end you can host for free on GitHub Pages.

- Search and browse through public [Invidious](https://invidious.io) servers.
- Paste any YouTube link to play it.
- Pick the playback source under the video: YouTube's no-cookie player, or an Invidious server (which streams the video through that server).

## Auto-updating

`.github/workflows/update.yml` runs every 6 hours. It pulls the public Invidious server list, checks which ones actually answer searches, and commits the working ones to `instances.json`. You can also run it by hand from the **Actions** tab ("Auto-update instances" → "Run workflow").

## Turning it on

1. Merge this into `main`.
2. Settings → Pages → Source: **Deploy from a branch**, branch **main**, folder **/ (root)**.
3. Settings → Actions → General → Workflow permissions: **Read and write**.

The site will be at `https://<your-username>.github.io/bruh/`.
