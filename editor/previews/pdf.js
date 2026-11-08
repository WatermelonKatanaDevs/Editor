(function () {
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'pdf',
    match(file) {
      return file.mime === 'application/pdf' || /\.pdf$/i.test(String(file.name || file.path || ''));
    },
    views: [{
      id: 'pdf-preview',
      label: 'Preview',
      default: true,
      priority: 120,
      create(ctx) {
        const root = document.createElement('section');
        root.className = 'editor-pdf-preview';
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-pdf-toolbar';
        const title = document.createElement('span');
        title.className = 'editor-pdf-title';
        title.textContent = ctx.file.name || ctx.file.path || 'PDF document';
        const url = ctx.getURL(ctx.file.path, 'application/pdf');
        const open = document.createElement('a');
        open.className = 'editor-pdf-action';
        open.href = url;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.textContent = 'Open in new tab';
        const download = document.createElement('a');
        download.className = 'editor-pdf-action';
        download.href = url;
        download.download = ctx.file.name || 'document.pdf';
        download.textContent = 'Download';
        toolbar.append(title, open, download);
        const frame = document.createElement('iframe');
        frame.className = 'editor-pdf-frame';
        frame.title = 'PDF preview: ' + (ctx.file.name || 'document');
        frame.src = url;
        frame.setAttribute('loading', 'lazy');
        root.append(toolbar, frame);
        ctx.host.appendChild(root);
      }
    }]
  });
})();