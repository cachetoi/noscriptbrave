/*
 * NoScript Control v2
 *
 * This file does NOT implement a second permission engine.
 * It reads and drives NoScript's existing popup controls.
 */

'use strict';

(() => {

  const indicatorPanel = document.createElement("div");
  indicatorPanel.id = "control-toolbar-indicator";

  indicatorPanel.innerHTML = `
    <div class="control-toolbar-copy">
      <strong>Toolbar indicator</strong>
      <small>Show this site's permission state on the NoScript icon</small>
    </div>

    <button
      id="control-toolbar-toggle"
      class="control-switch enabled"
      type="button"
      role="switch"
      aria-checked="true">
      <span class="control-switch-track">
        <span class="control-switch-thumb"></span>
      </span>
      <span class="control-switch-label">ON</span>
    </button>
  `;

  const metrics = document.querySelector("#control-metrics");

  if (metrics) {
    metrics.parentNode.insertBefore(indicatorPanel, metrics);
  }

  const toolbarToggle =
    document.querySelector("#control-toolbar-toggle");

  function setToolbarToggleUI(enabled) {
    if (!toolbarToggle) return;

    toolbarToggle.setAttribute(
      "aria-checked",
      enabled ? "true" : "false"
    );

    toolbarToggle.classList.toggle(
      "enabled",
      enabled
    );

    const label =
      toolbarToggle.querySelector(
        ".control-switch-label"
      );

    if (label) {
      label.textContent = enabled ? "ON" : "OFF";
    }
  }

  async function loadToolbarIndicatorSetting() {
    try {
      const response =
        await browser.runtime.sendMessage({
          noscriptControl: true,
          command: "toolbarIndicatorGet"
        });

      setToolbarToggleUI(
        response?.enabled !== false
      );
    } catch (_) {
      setToolbarToggleUI(true);
    }
  }

  async function setToolbarIndicator(enabled) {
    setToolbarToggleUI(enabled);

    try {
      await browser.runtime.sendMessage({
        noscriptControl: true,
        command: "toolbarIndicatorSet",
        enabled
      });
    } catch (e) {
      console.error(
        "NoScript Control: failed to change toolbar indicator",
        e
      );
    }
  }

  toolbarToggle?.addEventListener(
    "click",
    () => {
      const enabled =
        toolbarToggle.getAttribute(
          "aria-checked"
        ) !== "true";

      setToolbarIndicator(enabled);
    }
  );

  loadToolbarIndicatorSetting();


  const $ = selector => document.querySelector(selector);

  const dashboard = $("#control-dashboard");

  if (!dashboard) {
    return;
  }


  const statusMap = {

    DEFAULT: {
      label: "DEFAULT",
      state: "default",
      explanation:
        "Using your normal NoScript default policy for this site."
    },

    TRUSTED: {
      label: "TRUSTED",
      state: "trusted",
      explanation:
        "This site is explicitly trusted using NoScript's Trusted preset."
    },

    T_TRUSTED: {
      label: "TEMPORARY",
      state: "temporary",
      explanation:
        "This site is temporarily trusted. The permission is not intended to be permanent."
    },

    UNTRUSTED: {
      label: "BLOCKED",
      state: "blocked",
      explanation:
        "This site is explicitly Untrusted, so NoScript restricts its active content."
    },

    CUSTOM: {
      label: "CUSTOM",
      state: "custom",
      explanation:
        "This site is using a custom combination of NoScript permissions."
    }

  };


  function mainRow() {

    return (
      $("#sites .site.main") ||
      $("#sites .site")
    );

  }


  function currentPreset(row) {

    if (!row) {
      return "DEFAULT";
    }

    return (
      row.dataset.preset ||
      row.querySelector("input.preset:checked")?.value ||
      "DEFAULT"
    );

  }


  function currentUrl() {

    try {

      if (window.sitesUI?.mainUrl) {
        return sitesUI.mainUrl;
      }

    } catch (_) {
    }

    return null;

  }


  function updateSiteIdentity() {

    const url = currentUrl();

    const domain = $("#control-domain");
    const urlText = $("#control-url");

    if (!url) {

      domain.textContent = "Current site";
      urlText.textContent = "Waiting for NoScript";

      return;
    }


    let displayDomain = "";

    try {

      displayDomain =
        window.sitesUI?.mainDomain ||
        url.hostname ||
        url.host ||
        url.protocol;

    } catch (_) {

      displayDomain =
        url.hostname ||
        url.host ||
        "Current site";

    }


    domain.textContent =
      displayDomain ||
      "Current site";


    urlText.textContent =
      url.hostname
        ? url.href
        : String(url);

  }


  function updatePreset() {

    const row = mainRow();
    const preset = currentPreset(row);

    const config =
      statusMap[preset] ||
      {
        label: preset,
        state: "default",
        explanation:
          "NoScript is using a permission state not recognized by the custom dashboard."
      };


    dashboard.dataset.state =
      config.state;


    $("#control-status").textContent =
      config.label;


    $("#control-explanation").textContent =
      config.explanation;


    document
      .querySelectorAll(".control-action")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.preset === preset
        );

      });

  }


  function updateProtection() {

    let globallyEnforced = false;
    let tabEnforced = true;

    try {

      globallyEnforced =
        !!UI?.policy?.enforced;

      tabEnforced =
        !UI?.unrestrictedTab;

    } catch (_) {
    }


    const output =
      $("#control-protection");

    const pill =
      $("#control-protection-pill");


    if (!globallyEnforced) {

      output.textContent = "OFF";

      pill.textContent =
        "PROTECTION OFF";

      pill.dataset.state =
        "off";

      return;
    }


    if (!tabEnforced) {

      output.textContent =
        "TAB OFF";

      pill.textContent =
        "TAB UNRESTRICTED";

      pill.dataset.state =
        "tab-off";

      return;
    }


    output.textContent =
      "ON";

    pill.textContent =
      "PROTECTED";

    pill.dataset.state =
      "on";

  }


  function updateSiteCount() {

    const rows =
      document.querySelectorAll(
        "#sites .site"
      );

    $("#control-site-count").textContent =
      String(rows.length);

  }


  function reloadNeeded() {

    try {

      return !!(
        window.sitesUI &&
        typeof sitesUI.anyPermissionsChanged === "function" &&
        sitesUI.anyPermissionsChanged()
      );

    } catch (_) {

      return false;

    }

  }


  function updateReloadState() {

    const needed =
      reloadNeeded();


    $("#control-reload-state").textContent =
      needed ? "YES" : "NO";


    $("#control-reload-notice").hidden =
      !needed;

  }


  function updateAll() {

    updateSiteIdentity();
    updatePreset();
    updateProtection();
    updateSiteCount();
    updateReloadState();

  }


  function clickRealPreset(preset) {

    const row =
      mainRow();

    if (!row) {

      console.warn(
        "NoScript Control: main site row is not ready."
      );

      return;

    }


    const input =
      row.querySelector(
        `input.preset[value="${preset}"]`
      );


    if (!input || input.disabled) {

      console.warn(
        "NoScript Control: preset unavailable:",
        preset
      );

      return;

    }


    /*
     * Important:
     * We click NoScript's REAL radio input.
     *
     * NoScript's own event handlers then update its
     * actual policy and settings.
     */

    input.click();


    setTimeout(
      updateAll,
      0
    );


    setTimeout(
      updateAll,
      100
    );

  }


  document
    .querySelectorAll(".control-action")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          clickRealPreset(
            button.dataset.preset
          );

        }
      );

    });


  $("#control-reload-button")
    ?.addEventListener(
      "click",
      () => {

        $("#reload")?.click();

      }
    );


  /*
   * If the user uses NoScript's original advanced controls
   * instead of our quick buttons, update the dashboard too.
   */

  $("#sites")
    ?.addEventListener(
      "change",
      () => {

        setTimeout(
          updateAll,
          0
        );

      },
      true
    );


  $("#sites")
    ?.addEventListener(
      "click",
      () => {

        setTimeout(
          updateAll,
          0
        );

      },
      true
    );


  /*
   * NoScript renders the site list asynchronously.
   * Watch that REAL site list until it appears/changes.
   */

  const sitesContainer =
    $("#sites");


  if (sitesContainer) {

    const siteObserver =
      new MutationObserver(
        () => updateAll()
      );


    siteObserver.observe(
      sitesContainer,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "data-preset",
          "checked"
        ]
      }
    );

  }


  /*
   * Protection state is reflected by NoScript's existing
   * toolbar buttons. Watch their aria-pressed state.
   */

  const top =
    $("#top");


  if (top) {

    const toolbarObserver =
      new MutationObserver(
        () => updateProtection()
      );


    toolbarObserver.observe(
      top,
      {
        subtree: true,
        attributes: true,
        attributeFilter: [
          "aria-pressed",
          "disabled"
        ]
      }
    );

  }


  /*
   * Initial rendering can happen across several frames.
   * These retries keep the dashboard useful without making
   * assumptions about exactly when NoScript finishes.
   */

  updateAll();

  requestAnimationFrame(
    updateAll
  );

  setTimeout(
    updateAll,
    50
  );

  setTimeout(
    updateAll,
    250
  );

  setTimeout(
    updateAll,
    750
  );

})();