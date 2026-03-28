/**
 * inject.js
 * Runs in the page's JavaScript context (not the extension's isolated world).
 * Communicates results back to the content script via CustomEvents.
 */

(function () {
  "use strict";

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function reply(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // ─── Menu infrastructure ─────────────────────────────────────────────────────

  const CARD_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-compact-video-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model",
  ].join(", ");

  /**
   * Finds the "More actions" button for a video by locating its card element
   * and querying within that bounded scope.
   * @param {string} videoId
   * @returns {HTMLButtonElement|null}
   */
  function findMenuButtonForVideo(videoId) {
    const linkSelector = `a[href*="v=${videoId}"], a[href*="/shorts/${videoId}"]`;
    for (const card of document.querySelectorAll(CARD_SELECTORS)) {
      if (!card.querySelector(linkSelector)) continue;
      const btn = card.querySelector(
        "button[title='More actions'], button[aria-label='More actions']"
      );
      if (btn) return btn;
    }
    return null;
  }

  /**
   * Polls for a menu item whose text matches the given pattern, only finding
   * items that appear after this call (never resolves immediately to avoid
   * picking up a stale open menu).
   * @param {RegExp} pattern
   * @param {number} timeoutMs
   * @returns {Promise<Element|null>}
   */
  function waitForMenuItem(pattern, timeoutMs) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const interval = setInterval(() => {
        const candidates = document.querySelectorAll(
          "ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model"
        );
        for (const el of candidates) {
          if (pattern.test(el.textContent)) {
            clearInterval(interval);
            resolve(el);
            return;
          }
        }
        if (Date.now() > deadline) {
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });
  }

  /**
   * Opens the "More actions" menu for a video invisibly, clicks the menu item
   * matching the given pattern, then closes the menu.
   * @param {string} videoId
   * @param {RegExp} itemPattern
   * @returns {Promise<boolean>}
   */
  async function clickMenuItemForVideo(videoId, itemPattern) {
    const menuBtn = findMenuButtonForVideo(videoId);
    if (!menuBtn) return false;

    // Intercept the popup as soon as it appears and hide it from the user.
    let popup = null;
    const observer = new MutationObserver(() => {
      const el = document.querySelector(
        "ytd-menu-popup-renderer, tp-yt-iron-dropdown[aria-hidden='false'], tp-yt-iron-dropdown:not([aria-hidden])"
      );
      if (el && !popup) {
        popup = el;
        popup.style.opacity = "0";
        popup.style.pointerEvents = "none";
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });

    menuBtn.click();

    const menuItem = await waitForMenuItem(itemPattern, 1500);
    observer.disconnect();

    const restore = () => {
      if (popup) {
        popup.style.opacity = "";
        popup.style.pointerEvents = "";
      }
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    };

    if (!menuItem) {
      restore();
      return false;
    }

    menuItem.click();
    restore();
    return true;
  }

  // ─── Queue ───────────────────────────────────────────────────────────────────

  async function addToQueue(videoId) {
    try {
      const ok = await clickMenuItemForVideo(videoId, /add.{0,10}queue/i);
      if (ok) {
        reply("ytr:queueResult", { ok: true, videoId });
      } else {
        reply("ytr:queueResult", {
          ok: false,
          videoId,
          error: "Could not find the video\u2019s menu in the page.",
        });
      }
    } catch (err) {
      reply("ytr:queueResult", { ok: false, videoId, error: err.message });
    }
  }

  // ─── Watch Later ─────────────────────────────────────────────────────────────

  async function addToWatchLater(videoId) {
    try {
      const ok = await clickMenuItemForVideo(videoId, /watch.{0,6}later/i);
      if (ok) {
        reply("ytr:watchLaterResult", { ok: true, videoId });
      } else {
        reply("ytr:watchLaterResult", {
          ok: false,
          videoId,
          error: "Could not find the video\u2019s menu in the page.",
        });
      }
    } catch (err) {
      reply("ytr:watchLaterResult", { ok: false, videoId, error: err.message });
    }
  }

  // ─── Event listeners (from content script) ──────────────────────────────────

  document.addEventListener("ytr:addToWatchLater", (e) => {
    addToWatchLater(e.detail?.videoId);
  });

  document.addEventListener("ytr:addToQueue", (e) => {
    addToQueue(e.detail?.videoId);
  });
})();
