(function () {
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'image',
    match(file) {
      const mime = String(file.mime || '').toLowerCase();
      const name = String(file.name || file.path || '');
      const isIco = /\.ico$/i.test(name) || ['image/x-icon', 'image/vnd.microsoft.icon'].includes(mime);
      return !isIco && mime.startsWith('image/') && !['image/vnd.radiance', 'image/x-exr'].includes(mime);
    },
    views: [{
      id: 'image-preview',
      label: 'Preview',
      default: true,
      priority: 100,
      create(ctx) {
        const img = document.createElement('img');
        img.className = 'editor-image';
        img.src = ctx.getURL();
        ctx.host.appendChild(img);
      }
    }]
  });
})();
