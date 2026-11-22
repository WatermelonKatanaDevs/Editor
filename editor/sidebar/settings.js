(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};
  root.Settings = function(options) {
    const {
      state,
      tree,
      $,
      saveBehaviorSettings,
      getClosedTabRetentionMs,
      setClosedTabRetentionMs,
      getBrowserSettings,
      saveBrowserSettings,
      subscribeBrowserSettings
    } = options;

    function show() {
      tree.classList.remove('activity-collapsed');
      tree.innerHTML = `
        <div class="editor-settings-page sidebar-settings">
          <div class="editor-settings-header">
            <h2>Settings</h2>
            <p>Editor and workspace behavior.</p>
          </div>
          <div class="editor-settings-section">
            <h3>Saving</h3>
            <label class="setting-check"><input id="setting-auto-save" type="checkbox"><span>Save project before Run</span></label>
            <label class="setting-check"><input id="setting-auto-clear" type="checkbox"><span>Clear terminal before Run</span></label>
          </div>
          <div class="editor-settings-section">
            <h3>Workspace</h3>
            <label class="setting-check"><input id="setting-confirm-replace" type="checkbox"><span>Confirm before replacing the workspace</span></label>
            <label class="setting-check"><input id="setting-confirm-delete" type="checkbox"><span>Confirm before deleting files and folders</span></label>
            <label class="setting-check"><input id="setting-show-hidden" type="checkbox"><span>Show hidden files and folders</span></label>
            <label class="setting-check"><input id="setting-hide-node-modules" type="checkbox"><span>Hide node_modules in the file explorer</span></label>
          </div>
          <div class="editor-settings-section">
            <h3>Recently Closed Tabs</h3>
            <label>Keep closed tabs for
              <div class="setting-duration-control">
                <input id="setting-closed-tab-retention" type="number" min="0" step="1">
                <select id="setting-closed-tab-retention-unit">
                  <option value="1000">Seconds</option>
                  <option value="60000">Minutes</option>
                  <option value="3600000">Hours</option>
                </select>
              </div>
            </label>
            <p class="editor-settings-note">Restore a closed tab with Ctrl+Shift+T while its original editor and preview instances are retained. Set to 0 to dispose immediately.</p>
          </div>
          <div class="editor-settings-section">
            <h3>Git</h3>
            <label class="setting-check"><input id="setting-ignore-node-modules" type="checkbox"><span>Exclude node_modules from Source Control</span></label>
          </div>
          <div class="editor-settings-section">
            <h3>Image Editing</h3>
            <label class="setting-check"><input id="setting-piskel-auto-save" type="checkbox"><span>Auto-save Piskel edits</span></label>
            <p class="editor-settings-note">Automatically saves Piskel changes to the image and its <code>.piskel</code> sidecar.</p>
          </div>
          <div class="editor-settings-section">
            <h3>File Picker</h3>
            <label>Picker display<select id="setting-picker-display-mode"><option value="contained">Contained inside the editor tab</option><option value="overlay">Overlay over the entire Editor</option></select></label>
            <p class="editor-settings-note">Choose whether file dialogs stay within the active app tab or cover the Editor interface.</p>
            <label class="setting-check"><input id="setting-picker-use-in-browser" type="checkbox"><span>Use in Browser</span></label>
            <p class="editor-settings-note">Use the Editor workspace picker for browser uploads and save browser downloads into the workspace. Turn this off to keep the browser’s current upload and download behavior.</p>
          </div>
          <div class="editor-settings-section">
            <h3>Browser</h3>
            <label class="setting-check"><input id="setting-hide-browser-bar" type="checkbox"><span>Hide browser bar</span></label>
            <label class="setting-check"><input id="setting-browser-restore-tabs" type="checkbox"><span>Restore open tabs</span></label>
            <label>Default tab<input id="setting-browser-default-tab" type="text" spellcheck="false"></label>
            <label>CORS proxy gateway<input id="setting-browser-primary-proxy" type="text" spellcheck="false" placeholder="Optional"></label>
            <label>Fallback proxy<input id="setting-browser-fallback-proxy" type="text" spellcheck="false" placeholder="Optional"></label>
            <label>Search engine<select id="setting-browser-search-engine">
              <option value="https://mojeek.com/search?q=">Mojeek</option>
              <option value="https://duckduckgo.com/html/?q=">DuckDuckGo HTML</option>
              <option value="https://html.duckduckgo.com/html/?q=">DuckDuckGo Lite</option>
              <option value="https://search.brave.com/search?q=">Brave</option>
              <option value="https://www.google.com/search?q=">Google</option>
              <option value="https://yandex.com/search/?text=">Yandex</option>
            </select></label>
            <label class="setting-check"><input id="setting-browser-use-fallback" type="checkbox"><span>Use fallback proxy</span></label>
            <label class="setting-check"><input id="setting-browser-obscure-url" type="checkbox"><span>Obscure proxied URLs</span></label>
            <label class="setting-check"><input id="setting-browser-clear-devtools" type="checkbox"><span>Clear DevTools on page reload</span></label>
            <label class="setting-check"><input id="setting-browser-log-xhr" type="checkbox"><span>Log XMLHttpRequests to Console</span></label>
            <label class="setting-check"><input id="setting-browser-autodownload" type="checkbox"><span>Automatically download browser downloads</span></label>
            <p class="editor-settings-note">Browser settings are shared with the Browser panel and its Settings dialog.</p>
          </div>
        </div>`;

      const a = $('setting-auto-save');
      const c = $('setting-auto-clear');
      const r = $('setting-confirm-replace');
      const d = $('setting-confirm-delete');
      const h = $('setting-show-hidden');
      const hideNodeModules = $('setting-hide-node-modules');
      const ignoreNodeModules = $('setting-ignore-node-modules');
      const piskelAutoSave = $('setting-piskel-auto-save');
      const closedTabRetention = $('setting-closed-tab-retention');
      const closedTabRetentionUnit = $('setting-closed-tab-retention-unit');
      const b = $('setting-hide-browser-bar');
      const restoreTabs = $('setting-browser-restore-tabs');
      const defaultTab = $('setting-browser-default-tab');
      const primaryProxy = $('setting-browser-primary-proxy');
      const fallbackProxy = $('setting-browser-fallback-proxy');
      const searchEngine = $('setting-browser-search-engine');
      const useFallback = $('setting-browser-use-fallback');
      const obscureURL = $('setting-browser-obscure-url');
      const clearDevTools = $('setting-browser-clear-devtools');
      const logXHR = $('setting-browser-log-xhr');
      const autoDownload = $('setting-browser-autodownload');
      const pickerDisplayMode = $('setting-picker-display-mode');
      pickerDisplayMode.value = window.EditorWorkspacePicker?.getDisplayMode?.() || 'contained';
      pickerDisplayMode.onchange = () => window.EditorWorkspacePicker?.setDisplayMode?.(pickerDisplayMode.value);
      const pickerUseInBrowser = $('setting-picker-use-in-browser');
      pickerUseInBrowser.checked = window.EditorWorkspacePicker?.getUseInBrowser?.() !== false;
      pickerUseInBrowser.onchange = () => window.EditorWorkspacePicker?.setUseInBrowser?.(pickerUseInBrowser.checked);

      ignoreNodeModules.checked = state.behavior.ignoreNodeModules !== false;
      ignoreNodeModules.onchange = () => {
        state.behavior.ignoreNodeModules = ignoreNodeModules.checked;
        saveBehaviorSettings();
      };

      a.checked = !!state.behavior.autoSaveOnRun;
      c.checked = !!state.behavior.autoClearTerminal;
      r.checked = !!state.behavior.confirmBeforeReplace;
      d.checked = !!state.behavior.confirmBeforeDelete;
      h.checked = !!state.behavior.showHiddenFiles;
      hideNodeModules.checked = !!state.behavior.hideNodeModules;
      const retentionMs = Math.max(0, Number(getClosedTabRetentionMs?.() ?? state.behavior.recentlyClosedRetentionMs ?? 300000) || 0);
      const retentionUnit = retentionMs === 0 ? 60000
        : retentionMs % 3600000 === 0 ? 3600000
        : retentionMs % 60000 === 0 ? 60000 : 1000;
      closedTabRetentionUnit.value = String(retentionUnit);
      closedTabRetention.value = String(retentionMs / retentionUnit);
      try { const stored = localStorage.getItem('node-editor.piskel.autoSave'); piskelAutoSave.checked = stored === null ? true : stored === 'true'; } catch (_) { piskelAutoSave.checked = true; }
      b.checked = !!state.browserSettings.hideBrowserBar;
      restoreTabs.checked = state.browserSettings.restoreTabs !== false;

      a.onchange = () => { state.behavior.autoSaveOnRun = a.checked; saveBehaviorSettings(); };
      c.onchange = () => { state.behavior.autoClearTerminal = c.checked; saveBehaviorSettings(); };
      r.onchange = () => { state.behavior.confirmBeforeReplace = r.checked; saveBehaviorSettings(); };
      d.onchange = () => { state.behavior.confirmBeforeDelete = d.checked; saveBehaviorSettings(); };
      h.onchange = () => {
        state.behavior.showHiddenFiles = h.checked;
        state.fileManager?.setShowHiddenFiles(h.checked);
        saveBehaviorSettings();
      };
      hideNodeModules.onchange = () => {
        state.behavior.hideNodeModules = hideNodeModules.checked;
        state.fileManager?.setHideNodeModules(hideNodeModules.checked);
        saveBehaviorSettings();
      };
      piskelAutoSave.onchange = () => {
        try { localStorage.setItem('node-editor.piskel.autoSave', piskelAutoSave.checked ? 'true' : 'false'); } catch (_) {}
      };
      const saveClosedTabRetention = () => {
        const amount = Number(closedTabRetention.value);
        const unit = Number(closedTabRetentionUnit.value);
        if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(unit) || unit < 1000) {
          closedTabRetention.value = String(retentionMs / retentionUnit);
          closedTabRetentionUnit.value = String(retentionUnit);
          return;
        }
        const value = Math.min(2147483647, amount * unit);
        if (typeof setClosedTabRetentionMs === 'function') {
          setClosedTabRetentionMs(value);
        } else {
          state.behavior.recentlyClosedRetentionMs = value;
          saveBehaviorSettings();
        }
      };
      closedTabRetention.onchange = saveClosedTabRetention;
      closedTabRetentionUnit.onchange = saveClosedTabRetention;
      b.onchange = () => writeBrowserSettings({hideBrowserBar: b.checked});
      restoreTabs.onchange = () => writeBrowserSettings({restoreTabs: restoreTabs.checked});

      function renderBrowserSettings(value) {
        const settings = value || getBrowserSettings?.() || {};
        b.checked = !!settings.hideBrowserBar;
        restoreTabs.checked = settings.restoreTabs !== false;
        defaultTab.value = settings.defaultTab || '';
        primaryProxy.value = settings.primaryProxy || '';
        fallbackProxy.value = settings.fallbackProxy || '';
        searchEngine.value = settings.searchEngine || 'https://mojeek.com/search?q=';
        useFallback.checked = !!settings.useFallback;
        obscureURL.checked = !!settings.obscureURL;
        clearDevTools.checked = settings.clearDevToolsOnReload !== false;
        logXHR.checked = !!settings.logXMLHttpRequests;
        autoDownload.checked = !!settings.autoDownload;
      }

      function writeBrowserSettings(patch) {
        saveBrowserSettings?.(patch);
      }

      defaultTab.onchange = () => writeBrowserSettings({defaultTab: defaultTab.value});
      primaryProxy.onchange = () => writeBrowserSettings({primaryProxy: primaryProxy.value});
      fallbackProxy.onchange = () => writeBrowserSettings({fallbackProxy: fallbackProxy.value});
      searchEngine.onchange = () => writeBrowserSettings({searchEngine: searchEngine.value});
      useFallback.onchange = () => writeBrowserSettings({useFallback: useFallback.checked});
      obscureURL.onchange = () => writeBrowserSettings({obscureURL: obscureURL.checked});
      clearDevTools.onchange = () => writeBrowserSettings({clearDevToolsOnReload: clearDevTools.checked});
      logXHR.onchange = () => writeBrowserSettings({logXMLHttpRequests: logXHR.checked});
      autoDownload.onchange = () => writeBrowserSettings({autoDownload: autoDownload.checked});

      renderBrowserSettings();
      const unsubscribe = subscribeBrowserSettings?.(renderBrowserSettings) || null;
      tree.__settingsBrowserUnsubscribe?.();
      tree.__settingsBrowserUnsubscribe = unsubscribe;
    }
    return {show};
  };
})();
