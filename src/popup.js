"use strict";

const STORAGE_KEY = "ytr-settings";
const DEFAULT_SETTINGS = {
  reverseOverlayOrder: false,
  hideWhenNativeButtonsPresent: false,
};

const reverseOrder = document.getElementById("reverse-order");
const hideNative = document.getElementById("hide-native");
const rebuildButton = document.getElementById("rebuild");
const status = document.getElementById("status");

function setStatus(message) {
  status.textContent = message;
}

async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEY] ?? {}),
  };

  reverseOrder.checked = settings.reverseOverlayOrder;
  hideNative.checked = settings.hideWhenNativeButtonsPresent;
}

async function saveSettings() {
  const settings = {
    reverseOverlayOrder: reverseOrder.checked,
    hideWhenNativeButtonsPresent: hideNative.checked,
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  setStatus("Saved.");
}

async function rebuildOverlays() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("Open YouTube first.");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "ytr:resetOverlays" });
    if (response?.ok) {
      setStatus("Overlays rebuilt.");
    } else {
      setStatus("Unable to rebuild on this tab.");
    }
  } catch {
    setStatus("Open a YouTube tab to rebuild overlays.");
  }
}

reverseOrder.addEventListener("change", saveSettings);
hideNative.addEventListener("change", saveSettings);
rebuildButton.addEventListener("click", rebuildOverlays);

loadSettings().catch(() => {
  setStatus("Unable to load settings.");
});