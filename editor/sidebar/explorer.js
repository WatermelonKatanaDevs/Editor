(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};
  root.Explorer = function(options) {
    const {state, tree, FileManager, contextMenu, fileInput, onOpen, onMove, onDelete, markDirty, updateStatus} = options;
    const manager = new FileManager({
      tree,
      contextMenu,
      fileInput,
      onOpen,
      onMove,
      onDelete,
      onChange: () => { state.markDirty?.(); updateStatus(); },
      projectName: () => state.projectName,
      showHiddenFiles: state.behavior.showHiddenFiles,
      canContextMenu: () => state.sidebar === 'explorer'
    });
    state.fileManager = manager;
    tree.addEventListener('click', e => {
      if (e.target === tree || e.target.tagName === 'UL') manager.clearSelection();
    });
    return {
      fileManager: manager,
      show() {
        manager.hideContextMenu();
        tree.classList.remove('activity-collapsed');
        manager.render();
      },
      setFileSystem(fs) {
        manager.setFileSystem(fs);
        manager.setShowHiddenFiles?.(state.behavior.showHiddenFiles);
        manager.refresh();
      },
      hideContextMenu() { manager.hideContextMenu(); },
      restoreCollapsed(paths) {
        manager.collapsedPaths = new Set(paths || []);
        manager.render();
      }
    };
  };
})();
