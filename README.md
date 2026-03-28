# YT Restore — Queue & Watch Later

A lightweight Chrome/Edge extension that brings back the **Add to Queue** and **Save to Watch Later** buttons that YouTube removed from video thumbnails.

---

## Features

- **Thumbnail hover buttons** — hover over any video thumbnail on the home feed, search results, sidebar, or channel pages to reveal buttons at the top-right corner:
  - **Add to Queue** — appends the video to your current watch queue
  - **Watch Later** — saves the video to your Watch Later playlist
- **Shorts support** — Shorts thumbnails get a Queue button (Watch Later is not supported by YouTube for Shorts)
- **Dark mode aware** — buttons adapt to YouTube's light and dark themes
- **SPA-compatible** — uses a `MutationObserver` to handle YouTube's single-page navigation without needing a full page reload
- **No API keys, no fragile endpoints** — both actions use YouTube's own native on-page menu system, so they work exactly as if you'd clicked through the three-dot menu yourself

---

## Installation

### From the store

- Chrome Web Store *(link once published)*
- Edge Add-ons *(link once published)*

### Developer / unpacked

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked**
5. Select the root folder of this repository (the one containing `manifest.json`)
6. Navigate to YouTube — buttons appear on hover

---

## Project structure

```text
yt-restore/
├── manifest.json         # Extension manifest (MV3)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── store/
│   ├── listing.md        # Store description copy
│   └── privacy-policy.html
└── src/
    ├── content.js        # DOM injection, MutationObserver, overlay attachment
    ├── inject.js         # Page-context script — drives YouTube's native menu actions
    └── styles.css        # All injected UI styles
```

---

## How it works

### Overlay injection

`content.js` runs as a content script and watches the DOM for YouTube's video renderer elements (`ytd-rich-item-renderer`, `yt-lockup-view-model`, `ytm-shorts-lockup-view-model`, etc.). When one is found, it appends an overlay div inside the thumbnail element and marks the renderer so it isn't processed again.

YouTube's renderer elements use shadow DOM, so both legacy (`ytd-*`) and newer (`yt-lockup-view-model`) element types are handled.

### Queue and Watch Later actions

Rather than calling undocumented internal APIs (which YouTube changes frequently), both actions work by driving YouTube's own three-dot context menu:

1. The correct **More Actions** button for the video is located by finding the card element that contains a link to that video ID, then querying within that bounded scope
2. The popup menu is opened but immediately hidden from view (`opacity: 0`) using a `MutationObserver`
3. The target menu item ("Add to queue" or "Save to Watch Later") is located and clicked programmatically
4. The menu is closed

This means the actions are performed by YouTube's own code — no custom payloads, no API keys, no risk of breaking when YouTube updates its internals.

```text
content.js  ──CustomEvent──▶  inject.js (page context)
                                    │
                              findMenuButtonForVideo()
                              clickMenuItemForVideo()
                              YouTube's own menu handler
                                    │
            ◀──CustomEvent──  result (ok / error)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Buttons don't appear on thumbnails | Reload the extension at `chrome://extensions`, then hard-refresh YouTube (Ctrl+Shift+R) |
| Queue / Watch Later fails with "Could not find menu" | The video's card may not have a three-dot button — open an issue with the page URL |
| Buttons appear on the wrong video | Open an issue — YouTube may have changed its renderer element structure |
| Buttons not visible on hover | Check the console for `[YT Restore]` errors; YouTube may have changed its thumbnail component names |

---

## Contributing

Pull requests are welcome. The most likely things to need updating as YouTube evolves:

- **`RENDERER_SELECTORS`** in `content.js` — if YouTube introduces new video card element types
- **`findThumbnailContainer`** in `content.js` — if the thumbnail component is renamed
- **`CARD_SELECTORS`** and `findMenuButtonForVideo` in `inject.js` — if the card structure changes
- **`waitForMenuItem` patterns** in `inject.js` — if the menu item text changes

---

## Licence

MIT — do whatever you like with it.
