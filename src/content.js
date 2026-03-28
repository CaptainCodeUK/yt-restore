/**
 * content.js
 * Main content script for YT Restore.
 *
 * Responsibilities:
 *  - Inject inject.js into the page context so we can access YouTube's globals.
 *  - Observe DOM mutations to attach hover buttons to video thumbnails.
 *  - Inject player-page buttons on /watch pages.
 *  - Bridge CustomEvents between inject.js (page context) and this script.
 *  - Display toast notifications.
 */

"use strict";

const LOG_PREFIX = "[YT Restore]";

// ─── Page-context bridge ─────────────────────────────────────────────────────

/**
 * Injects inject.js into the page's script context so it can access
 * YouTube's internal globals (ytcfg, window.yt, etc.).
 */
function injectPageScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/inject.js");
    script.onload = () => script.remove();
    (document.head ?? document.documentElement).appendChild(script);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to inject page script:`, err);
  }
}

/**
 * Sends a message to inject.js (page context) via a CustomEvent.
 * @param {string} eventName
 * @param {object} detail
 */
function sendToPage(eventName, detail) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// ─── Listen for results from inject.js ──────────────────────────────────────

document.addEventListener("ytr:watchLaterResult", (e) => {
  const { ok, error } = e.detail ?? {};
  if (ok) {
    showToast("✓ Added to Watch Later");
  } else {
    console.warn(`${LOG_PREFIX} Watch Later failed:`, error);
    showToast("✗ Watch Later failed — see console", true);
  }
});

document.addEventListener("ytr:queueResult", (e) => {
  const { ok, error } = e.detail ?? {};
  if (ok) {
    showToast("✓ Added to Queue");
  } else {
    console.warn(`${LOG_PREFIX} Queue failed:`, error);
    showToast("✗ Queue unavailable — see console", true);
  }
});

// ─── Video ID extraction ─────────────────────────────────────────────────────

/**
 * Extracts a YouTube video ID from a URL string or href.
 * @param {string} href
 * @returns {string|null}
 */
function extractVideoId(href) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://www.youtube.com");
    // Standard watch URL
    const v = url.searchParams.get("v");
    if (v) return v;
    // Shorts
    const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

/**
 * Finds the video link anchor within a renderer, handling both the legacy
 * ytd-thumbnail/a#thumbnail structure and the new yt-thumbnail-view-model layout.
 * @param {Element} renderer
 * @returns {HTMLAnchorElement|null}
 */
function findThumbnailAnchor(renderer) {
  // Legacy: explicit thumbnail anchor
  const legacy = renderer.querySelector("a#thumbnail, a.ytd-thumbnail");
  if (legacy) return legacy;

  // New design: yt-thumbnail-view-model is inside a link — walk up to find it
  const thumbModel = renderer.querySelector("yt-thumbnail-view-model");
  if (thumbModel) {
    const ancestor = thumbModel.closest("a[href]");
    if (ancestor) return ancestor;
  }

  // Fallback: any watch/shorts link in the renderer
  return renderer.querySelector("a[href*='watch?v='], a[href*='/shorts/']");
}

/**
 * Finds the thumbnail container element to attach the overlay to.
 * @param {Element} renderer
 * @returns {Element|null}
 */
function findThumbnailContainer(renderer) {
  // New design: use yt-thumbnail-view-model as the overlay parent
  const thumbModel = renderer.querySelector("yt-thumbnail-view-model");
  if (thumbModel) return thumbModel;
  // Legacy: use the anchor itself
  return renderer.querySelector("a#thumbnail, a.ytd-thumbnail");
}

/**
 * Extracts a video ID from a renderer element.
 * @param {Element} renderer
 * @returns {string|null}
 */
function getVideoIdFromRenderer(renderer) {
  const anchor = findThumbnailAnchor(renderer);
  if (!anchor) return null;
  return extractVideoId(anchor.href);
}

// ─── Thumbnail hover buttons ─────────────────────────────────────────────────

/**
 * Creates the overlay button container with Queue and optionally Watch Later.
 * @param {string} videoId
 * @param {boolean} includeWatchLater
 * @returns {HTMLElement}
 */
function createThumbnailOverlay(videoId, includeWatchLater) {
  const overlay = document.createElement("div");
  overlay.className = "ytr-overlay";
  overlay.dataset.videoId = videoId;

  const queueBtn = document.createElement("button");
  queueBtn.className = "ytr-btn ytr-queue-btn";
  queueBtn.title = "Add to Queue";
  queueBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/><circle cx="20" cy="18" r="4" fill="var(--ytr-accent)"/><path d="M20 16v4M18 18h4" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const wlBtn = document.createElement("button");
  wlBtn.className = "ytr-btn ytr-wl-btn";
  wlBtn.title = "Save to Watch Later";
  wlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>`;

  // Stop clicks propagating to the thumbnail link
  [queueBtn, wlBtn].forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  queueBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendToPage("ytr:addToQueue", { videoId });
  });

  wlBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendToPage("ytr:addToWatchLater", { videoId });
  });

  overlay.appendChild(queueBtn);
  if (includeWatchLater) overlay.appendChild(wlBtn);
  return overlay;
}

/**
 * Attaches the hover overlay to a video renderer element if not already attached.
 * @param {Element} renderer
 */
function attachOverlayToRenderer(renderer) {
  if (renderer.dataset.ytrAttached) return;

  const videoId = getVideoIdFromRenderer(renderer);
  if (!videoId) return;

  const isShorts =
    renderer.tagName.toLowerCase() === "ytm-shorts-lockup-view-model" ||
    !!findThumbnailAnchor(renderer)?.href?.includes("/shorts/");

  const container = findThumbnailContainer(renderer);
  if (!container) return;

  // Prevent double-attach when both a parent renderer (e.g. ytd-rich-item-renderer)
  // and a child renderer (e.g. yt-lockup-view-model) match the selector list.
  if (container.querySelector(".ytr-overlay")) return;

  // Do NOT clear overflow — our overlay is positioned within the container's
  // bounds (bottom: 6px; right: 6px) so it won't be clipped. Clearing overflow
  // on ancestor containers causes YouTube's own hover buttons to bleed across
  // adjacent video cards.

  // Ensure the container is a position context for the overlay.
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  // Mark for the CSS hover rule.
  container.classList.add("ytr-thumb-wrap");

  const overlay = createThumbnailOverlay(videoId, !isShorts);
  container.appendChild(overlay);

  renderer.dataset.ytrAttached = "true";
}

// Selectors for all renderer types we want to handle.
// Includes both legacy ytd-* elements and the newer yt-lockup-view-model system.
const RENDERER_SELECTORS = [
  // Legacy
  "ytd-rich-item-renderer",
  "ytd-compact-video-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
  "ytd-reel-item-renderer",
  // New lockup view model system
  "yt-lockup-view-model",
  "ytm-shorts-lockup-view-model",
].join(", ");

/**
 * Scans the document for video renderers and attaches overlays.
 */
function attachAllOverlays() {
  document.querySelectorAll(RENDERER_SELECTORS).forEach(attachOverlayToRenderer);
}

// ─── Player page buttons ──────────────────────────────────────────────────────

let playerButtonsAttached = false;

/**
 * Injects Queue and Watch Later buttons into the video player page's
 * action button row (below the video title).
 */
function attachPlayerButtons() {
  if (playerButtonsAttached) return;

  const videoId = extractVideoId(window.location.href);
  if (!videoId) return;

  // The action buttons row: like, dislike, share, save…
  const actionsRow = document.querySelector(
    "#actions #top-level-buttons-computed, ytd-menu-renderer #top-level-buttons-computed, #actions-inner"
  );
  if (!actionsRow) return;

  if (document.getElementById("ytr-player-btns")) return;

  const container = document.createElement("div");
  container.id = "ytr-player-btns";
  container.className = "ytr-player-btn-group";

  const queueBtn = document.createElement("button");
  queueBtn.className = "ytr-player-btn";
  queueBtn.title = "Add to Queue";
  queueBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      <circle cx="20" cy="18" r="4" fill="currentColor" opacity="0.15"/>
      <path d="M20 16v4M18 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span>Queue</span>`;

  const wlBtn = document.createElement("button");
  wlBtn.className = "ytr-player-btn";
  wlBtn.title = "Save to Watch Later";
  wlBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
    </svg>
    <span>Watch Later</span>`;

  queueBtn.addEventListener("click", () => {
    sendToPage("ytr:addToQueue", { videoId });
  });

  wlBtn.addEventListener("click", () => {
    sendToPage("ytr:addToWatchLater", { videoId });
  });

  container.appendChild(queueBtn);
  container.appendChild(wlBtn);
  actionsRow.prepend(container);

  playerButtonsAttached = true;
}

// ─── Toast notifications ─────────────────────────────────────────────────────

let toastTimeout = null;

/**
 * Shows a brief toast notification in the bottom-right corner.
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function showToast(message, isError = false) {
  let toast = document.getElementById("ytr-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ytr-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = "ytr-toast" + (isError ? " ytr-toast--error" : "");
  toast.classList.add("ytr-toast--visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("ytr-toast--visible");
  }, 2500);
}

// ─── MutationObserver ────────────────────────────────────────────────────────

/**
 * Watches for DOM changes (YouTube is a SPA) and re-runs attachment logic.
 */
function startObserver() {
  const observer = new MutationObserver((mutations) => {
    let needsScan = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          needsScan = true;
          break;
        }
      }
      if (needsScan) break;
    }

    if (needsScan) {
      attachAllOverlays();

      // Re-attach player buttons if we're on /watch and they've been removed from the DOM
      if (
        window.location.pathname === "/watch" &&
        !document.getElementById("ytr-player-btns")
      ) {
        playerButtonsAttached = false;
        attachPlayerButtons();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Route change detection ──────────────────────────────────────────────────

// YouTube uses history.pushState for navigation; we hook into it.
const _originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _originalPushState(...args);
  onRouteChange();
};

window.addEventListener("popstate", onRouteChange);

function onRouteChange() {
  playerButtonsAttached = false;
  setTimeout(() => {
    attachAllOverlays();
    if (window.location.pathname === "/watch") {
      attachPlayerButtons();
    }
  }, 800); // brief delay for YouTube to render the new page
}

// ─── Init ────────────────────────────────────────────────────────────────────

function init() {
  console.log(`${LOG_PREFIX} Initialised.`);
  injectPageScript();
  attachAllOverlays();

  if (window.location.pathname === "/watch") {
    // Player page might not be rendered yet, poll briefly
    let attempts = 0;
    const interval = setInterval(() => {
      attachPlayerButtons();
      if (playerButtonsAttached || ++attempts > 20) clearInterval(interval);
    }, 300);
  }

  startObserver();
}

// Wait for the body to be ready
if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
