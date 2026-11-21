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
        const url = ctx.getURL();
        if (!url) return;

        const root = document.createElement('div');
        root.className = 'editor-image-preview';
        root.style.cssText = [
          'position:absolute',
          'inset:0',
          'width:100%',
          'height:100%',
          'overflow:hidden',
          'isolation:isolate',
          'background:transparent'
        ].join(';');

        // Opaque images get a blurred, enlarged copy behind the contain-sized
        // foreground image. It stays hidden until alpha has been checked.
        const background = document.createElement('img');
        background.className = 'editor-image-preview-background';
        background.alt = '';
        background.setAttribute('aria-hidden', 'true');
        background.draggable = false;
        background.style.cssText = [
          'position:absolute',
          'inset:0',
          'width:100%',
          'height:100%',
          'max-width:none',
          'max-height:none',
          'display:none',
          'object-fit:cover',
          'object-position:center',
          'filter:blur(32px) brightness(.68) saturate(.9)',
          'transform:scale(1.14)',
          'pointer-events:none',
          'user-select:none',
          'z-index:0'
        ].join(';');

        const img = document.createElement('img');
        img.className = 'editor-image';
        img.alt = String(ctx.file?.name || '');
        img.draggable = false;
        img.style.cssText = [
          'position:absolute',
          'inset:0',
          'width:100%',
          'height:100%',
          'max-width:none',
          'max-height:none',
          'display:block',
          'margin:0',
          'object-fit:contain',
          'object-position:center',
          'z-index:1'
        ].join(';');

        root.append(background, img);
        ctx.host.appendChild(root);

        let checked = false;
        const checkTransparency = () => {
          if (checked || !img.naturalWidth || !img.naturalHeight) return;
          checked = true;
          if (!ctx.isCurrent()) return;

          // A small resampled canvas keeps alpha detection inexpensive even
          // for very large source images. Smoothing preserves tiny transparent
          // details as partial alpha values when the image is downscaled.
          const maxSampleSize = 4096;
          const sampleScale = Math.min(1, maxSampleSize / Math.max(img.naturalWidth, img.naturalHeight));
          const sampleWidth = Math.max(1, Math.round(img.naturalWidth * sampleScale));
          const sampleHeight = Math.max(1, Math.round(img.naturalHeight * sampleScale));
          const canvas = document.createElement('canvas');
          canvas.width = sampleWidth;
          canvas.height = sampleHeight;

          try {
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            context.clearRect(0, 0, sampleWidth, sampleHeight);
            context.imageSmoothingEnabled = true;
            context.drawImage(img, 0, 0, sampleWidth, sampleHeight);

            const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
            let hasTransparency = false;
            for (let i = 3; i < pixels.length; i += 4) {
              if (pixels[i] < 255) {
                hasTransparency = true;
                break;
              }
            }

            // Transparent images deliberately retain empty padding. For
            // opaque images, the same source fills the unused space behind it.
            if (!hasTransparency && ctx.isCurrent()) {
              background.src = url;
              background.style.display = 'block';
            }
          } catch (_) {
            // If alpha cannot be inspected (for example, an SVG with external
            // resources), prefer empty padding over obscuring transparency.
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        };

        img.addEventListener('load', checkTransparency);

        // Small source images are commonly pixel art. Use nearest-neighbour
        // scaling only for these; larger artwork keeps normal interpolation.
        const applyImageRendering = () => {
          if (img.naturalWidth < 256 && img.naturalHeight < 256) {
            img.style.imageRendering = 'pixelated';
          }
        };
        img.addEventListener('load', applyImageRendering, { once: true });
        img.src = url;

        if (img.complete && img.naturalWidth) {
          checkTransparency();
          applyImageRendering();
        }

        ctx.addCleanup(() => {
          img.removeEventListener('load', checkTransparency);
          root.remove();
        });
      }
    }, {
      // Keep the original, unprocessed image renderer available as Raw.
      // This intentionally retains the previous .editor-image sizing behavior.
      id: 'image-raw',
      label: 'Raw',
      priority: 80,
      create(ctx) {
        const img = document.createElement('img');
        img.className = 'editor-image';
        img.src = ctx.getURL();
        ctx.host.appendChild(img);
      }
    }]
  });
})();
