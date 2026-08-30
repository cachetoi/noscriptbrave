"use strict";

(() => {
  const action = browser.action || browser.browserAction;
  if (!action) return;

  const STORAGE_KEY = "noscriptControlToolbarIndicator";

  const STATES = {
    DEFAULT:    { text: "•", color: [120,130,149,255], label: "Default" },
    TRUSTED:    { text: "•", color: [56,212,135,255],  label: "Trusted" },
    T_TRUSTED:  { text: "•", color: [230,187,69,255],  label: "Temporary" },
    UNTRUSTED:  { text: "•", color: [241,91,100,255],  label: "Blocked" },
    CUSTOM:     { text: "•", color: [155,134,255,255], label: "Custom" },
    OFF:        { text: "•", color: [70,75,85,255],    label: "Protection off" }
  };

  async function getEnabled() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] !== false;
  }

  async function clearBadge(tabId) {
    await action.setBadgeText({ tabId, text: "" });
  }

  async function getStateForTab(tabId) {
    try {
      if (globalThis.ns?.initializing) {
        await ns.initializing;
      }

      const tab = await browser.tabs.get(tabId);
      if (!tab?.url) return "DEFAULT";

      if (typeof ns?.isEnforced === "function" && !ns.isEnforced(tabId)) {
        return "OFF";
      }

      const policy = ns.getPolicy(tab.cookieStoreId);
      if (!policy) return "DEFAULT";

      const result = policy.get(tab.url, tab.url);
      const perms = result?.perms;

      if (!perms) return "DEFAULT";

      if (policy.TRUSTED?.tempTwin?.sameAs?.(perms)) {
        return "T_TRUSTED";
      }

      if (policy.TRUSTED?.sameAs?.(perms)) {
        return "TRUSTED";
      }

      if (policy.UNTRUSTED?.sameAs?.(perms)) {
        return "UNTRUSTED";
      }

      if (policy.DEFAULT?.sameAs?.(perms)) {
        return "DEFAULT";
      }

      return "CUSTOM";
    } catch {
      return "DEFAULT";
    }
  }

  async function updateBadge(tabId) {
    if (!(await getEnabled())) {
      await clearBadge(tabId);
      return;
    }

    const state = await getStateForTab(tabId);
    const config = STATES[state] || STATES.DEFAULT;

    await action.setBadgeBackgroundColor({
      tabId,
      color: config.color
    });

    if (typeof action.setBadgeTextColor === "function") {
      await action.setBadgeTextColor({
        tabId,
        color: [255,255,255,255]
      });
    }

    await action.setBadgeText({
      tabId,
      text: config.text
    });

    await action.setTitle({
      tabId,
      title: `NoScript — ${config.label}`
    });
  }

  async function refreshAllTabs() {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id >= 0) {
        updateBadge(tab.id);
      }
    }
  }

  browser.tabs.onActivated.addListener(({ tabId }) => {
    updateBadge(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (
      changeInfo.url ||
      changeInfo.status === "loading" ||
      changeInfo.status === "complete"
    ) {
      updateBadge(tabId);
    }
  });

  browser.storage.onChanged.addListener(() => {
    refreshAllTabs();
  });

  browser.runtime.onMessage.addListener((message) => {
    if (!message?.noscriptControl) return;

    if (message.command === "toolbarIndicatorGet") {
      return getEnabled().then(enabled => ({ enabled }));
    }

    if (message.command === "toolbarIndicatorSet") {
      return browser.storage.local.set({
        [STORAGE_KEY]: !!message.enabled
      }).then(() => refreshAllTabs())
        .then(() => ({ enabled: !!message.enabled }));
    }

    if (message.command === "toolbarIndicatorRefresh") {
      return refreshAllTabs().then(() => ({ ok: true }));
    }
  });

  refreshAllTabs();
})();