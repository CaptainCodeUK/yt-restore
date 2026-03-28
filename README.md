# YT Restore — Queue & Watch Later

A lightweight Chrome extension that brings back the **Add to Queue** and **Save to Watch Later** buttons that YouTube removed from video thumbnails and the watch page.

---

## Features

- **Thumbnail hover buttons** — hover over any video thumbnail on the home page, search results, sidebar, or subscriptions feed to reveal two buttons:
  - ➕ **Add to Queue** — appends the video to your current watch queue
  - 🕐 **Watch Later** — saves the video to your Watch Later playlist
- **Player page buttons** — the same two buttons appear inline with YouTube's existing action buttons (Like, Share, Save…) when watching a video
- **Dark mode aware** — buttons adapt to YouTube's light and dark themes
- **SPA-compatible** — uses a `MutationObserver` to handle YouTube's single-page navigation without needing a full page reload
- **Silent failure** — if YouTube's internal API changes, errors are logged to the console with a `[YT Restore]` prefix and a brief toast is shown rather than breaking the page

---

## Installation (Developer / Unpacked)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked**
5. Select the root folder of this repository (the one containing `manifest.json`)
6. Navigate to YouTube — buttons should appear on hover and on watch pages

---

## Project Structure

```
yt-restore/
├── manifest.json         # Extension manifest (MV3)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── content.js        # Main content script — DOM injection & observer
    ├── inject.js         # Page-context script — accesses YouTube's internal APIs
    └── styles.css        # All injected UI styles
```

### How it works

Chrome extensions run in an *isolated world* — their JS cannot directly access globals on the page like `window.ytcfg`. To get around this, `content.js` injects `inject.js` as a `<script>` tag directly into the page, giving it access to YouTube's internal config. The two scripts communicate via `CustomEvent`s dispatched on `document`.

```
content.js  ──CustomEvent──▶  inject.js (page context)
                                    │
                              ytcfg / YouTube APIs
                                    │
            ◀──CustomEvent──  result (ok / error)
```

---

## Watch Later — How it works

Watch Later is added via YouTube's internal `browse/edit_playlist` endpoint:

```
POST https://www.youtube.com/youtubei/v1/browse/edit_playlist?key={INNERTUBE_API_KEY}
```

The `INNERTUBE_API_KEY` and `INNERTUBE_CONTEXT` are read from `window.ytcfg.data_` which YouTube populates on every page load. The request adds the video to playlist ID `WL` (Watch Later).

> **Note:** This uses an undocumented internal API. If YouTube changes its API key, endpoint, or request format this feature may stop working. Check the console for `[YT Restore]` warnings.

---

## Queue — How it works

YouTube's queue API is partially exposed via the player element. The extension attempts to:

1. Dispatch a `yt-navigate-start` CustomEvent with the video endpoint data
2. Call `ytd-player.addToQueue()` if the method is available

Queue support is more fragile than Watch Later as it depends on the player being active. If the extension can't add to the queue it will show a toast notification.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Buttons don't appear on thumbnails | Try hovering more centrally on the thumbnail; check the console for `[YT Restore]` errors |
| Watch Later fails | YouTube may have rotated their API key — open an issue with the console error |
| Queue doesn't work | Queue API is only available when a video is already playing; navigate to a watch page first |
| Buttons appear in wrong position | YouTube may have updated their renderer element structure — open an issue |

---

## Contributing

Pull requests are welcome. Please keep changes scoped and well-commented. The main areas that may need updating over time as YouTube evolves:

- **`RENDERER_SELECTORS`** in `content.js` — if YouTube adds new renderer types
- **`actionsRow` selector** in `attachPlayerButtons()` — if the player action bar changes
- **`edit_playlist` payload** in `inject.js` — if YouTube's internal API changes

---

## Licence

MIT — do whatever you like with it.
