(function () {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  function toBytes(value) {
    if (value instanceof Uint8Array) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) return Uint8Array.from(value);
    if (typeof value === 'string') {
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
      return bytes;
    }
    throw new Error('The editor could not read this ICO file as binary data.');
  }

  function parseDirectory(bytes) {
    if (bytes.length < 6) throw new Error('The file is too small to contain an ICO directory.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) {
      throw new Error('This is not a valid Windows icon (.ico) file.');
    }

    const count = view.getUint16(4, true);
    if (!count || count > 256 || 6 + count * 16 > bytes.length) {
      throw new Error('The ICO image directory is invalid or incomplete.');
    }

    const entries = [];
    const directoryEnd = 6 + count * 16;
    for (let i = 0; i < count; i++) {
      const offset = 6 + i * 16;
      const width = bytes[offset] || 256;
      const height = bytes[offset + 1] || 256;
      const bitCount = view.getUint16(offset + 6, true);
      const byteLength = view.getUint32(offset + 8, true);
      const imageOffset = view.getUint32(offset + 12, true);

      if (!byteLength || imageOffset < directoryEnd || imageOffset + byteLength > bytes.length) continue;
      entries.push({ width, height, bitCount, offset: imageOffset, byteLength });
    }

    if (!entries.length) throw new Error('No readable icon images were found in this ICO file.');
    return entries.sort((a, b) => (a.width * a.height) - (b.width * b.height) || a.bitCount - b.bitCount);
  }

  function isPNG(bytes) {
    return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
  }

  function dibToDataURL(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 40) throw new Error('Unsupported bitmap header.');
    const headerSize = view.getUint32(0, true);
    if (headerSize < 40 || headerSize > bytes.length) throw new Error('Invalid bitmap header.');

    const dibWidth = view.getInt32(4, true);
    const doubledHeight = view.getInt32(8, true);
    const width = Math.abs(dibWidth);
    const height = Math.floor(Math.abs(doubledHeight) / 2);
    const bitCount = view.getUint16(14, true);
    const compression = view.getUint32(16, true);
    const colorsUsed = view.getUint32(32, true);

    if (!width || !height || width > 1024 || height > 1024 || width * height > 1048576) {
      throw new Error('The bitmap dimensions are invalid or too large.');
    }
    if (![1, 4, 8, 16, 24, 32].includes(bitCount) || compression !== 0) {
      throw new Error('This ICO bitmap uses a compression or color format that is not supported yet.');
    }

    const paletteCount = bitCount <= 8 ? (colorsUsed || (1 << bitCount)) : 0;
    if (paletteCount > (1 << bitCount)) throw new Error('The ICO bitmap color palette is invalid.');
    const paletteOffset = headerSize;
    const xorOffset = paletteOffset + paletteCount * 4;
    const xorStride = Math.floor((width * bitCount + 31) / 32) * 4;
    const xorLength = xorStride * height;
    const maskOffset = xorOffset + xorLength;
    const maskStride = Math.floor((width + 31) / 32) * 4;
    const hasAndMask = maskOffset + maskStride * height <= bytes.length;

    if (xorOffset > bytes.length || maskOffset > bytes.length) {
      throw new Error('The ICO bitmap pixel data is incomplete.');
    }

    const palette = [];
    for (let i = 0; i < paletteCount; i++) {
      const p = paletteOffset + i * 4;
      if (p + 3 >= bytes.length) throw new Error('The ICO color palette is incomplete.');
      palette.push([bytes[p + 2], bytes[p + 1], bytes[p]]);
    }

    const sourceYFor = y => doubledHeight < 0 ? y : height - 1 - y;
    let hasAlpha = false;
    if (bitCount === 32) {
      for (let y = 0; y < height && !hasAlpha; y++) {
        const row = xorOffset + sourceYFor(y) * xorStride;
        for (let x = 0; x < width; x++) {
          if (bytes[row + x * 4 + 3] !== 0) { hasAlpha = true; break; }
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    const image = context.createImageData(width, height);
    const rgba = image.data;

    for (let y = 0; y < height; y++) {
      const sourceY = sourceYFor(y);
      const row = xorOffset + sourceY * xorStride;
      for (let x = 0; x < width; x++) {
        let red = 0, green = 0, blue = 0, alpha = 255;
        if (bitCount === 1) {
          const index = (bytes[row + (x >> 3)] >> (7 - (x & 7))) & 1;
          [red, green, blue] = palette[index] || [0, 0, 0];
        } else if (bitCount === 4) {
          const packed = bytes[row + (x >> 1)];
          const index = (x & 1) ? (packed & 15) : (packed >> 4);
          [red, green, blue] = palette[index] || [0, 0, 0];
        } else if (bitCount === 8) {
          const index = bytes[row + x];
          [red, green, blue] = palette[index] || [0, 0, 0];
        } else if (bitCount === 16) {
          const pixel = view.getUint16(row + x * 2, true);
          red = Math.round(((pixel >> 10) & 31) * 255 / 31);
          green = Math.round(((pixel >> 5) & 31) * 255 / 31);
          blue = Math.round((pixel & 31) * 255 / 31);
        } else if (bitCount === 24) {
          const p = row + x * 3;
          blue = bytes[p];
          green = bytes[p + 1];
          red = bytes[p + 2];
        } else {
          const p = row + x * 4;
          blue = bytes[p];
          green = bytes[p + 1];
          red = bytes[p + 2];
          alpha = bytes[p + 3];
        }

        const maskByteOffset = maskOffset + sourceY * maskStride + (x >> 3);
        const masked = hasAndMask && ((bytes[maskByteOffset] >> (7 - (x & 7))) & 1) !== 0;
        if (bitCount !== 32 || !hasAlpha) alpha = masked ? 0 : 255;

        const target = (y * width + x) * 4;
        rgba[target] = red;
        rgba[target + 1] = green;
        rgba[target + 2] = blue;
        rgba[target + 3] = alpha;
      }
    }

    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function makePreviewSource(bytes, entry, objectURLs) {
    const payload = bytes.subarray(entry.offset, entry.offset + entry.byteLength);
    if (isPNG(payload)) {
      const url = URL.createObjectURL(new Blob([payload], { type: 'image/png' }));
      objectURLs.push(url);
      return url;
    }
    return dibToDataURL(payload);
  }

  function addError(host, message) {
    const error = document.createElement('div');
    error.className = 'editor-ico-error';
    error.textContent = message;
    host.appendChild(error);
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'ico',
    match(file) {
      const name = String(file.name || file.path || '');
      const mime = String(file.mime || '').toLowerCase();
      return /\.ico$/i.test(name) || mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon';
    },
    views: [{
      id: 'ico-preview',
      label: 'ICO Preview',
      default: true,
      priority: 140,
      async create(ctx) {
        let bytes, entries;
        try {
          bytes = toBytes(ctx.readBinary());
          entries = parseDirectory(bytes);
        } catch (error) {
          addError(ctx.host, error?.message || 'Unable to read this ICO file.');
          return;
        }

        const preview = document.createElement('section');
        preview.className = 'editor-ico-preview';
        const heading = document.createElement('h2');
        heading.className = 'editor-ico-heading';
        heading.textContent = 'Icon sizes';
        const summary = document.createElement('p');
        summary.className = 'editor-ico-summary';
        summary.textContent = entries.length + ' embedded ' + (entries.length === 1 ? 'image' : 'images');
        const grid = document.createElement('div');
        grid.className = 'editor-ico-grid';
        const objectURLs = [];
        ctx.addCleanup(() => objectURLs.forEach(url => {
          try { URL.revokeObjectURL(url); } catch (_) {}
        }));

        for (const entry of entries) {
          const card = document.createElement('div');
          card.className = 'editor-ico-card';
          const imageWrap = document.createElement('div');
          imageWrap.className = 'editor-ico-image-wrap';
          const image = document.createElement('img');
          image.alt = entry.width + ' by ' + entry.height + ' icon';
          image.draggable = false;
          let source = '';
          try {
            source = makePreviewSource(bytes, entry, objectURLs);
            image.src = source;
          } catch (error) {
            imageWrap.textContent = 'Preview unavailable';
            imageWrap.title = error?.message || 'Could not decode this icon image.';
          }
          if (source) imageWrap.appendChild(image);
          const label = document.createElement('div');
          label.className = 'editor-ico-label';
          label.textContent = entry.width + ' × ' + entry.height;
          card.append(imageWrap, label);
          grid.appendChild(card);
        }

        preview.append(heading, summary, grid);
        ctx.host.appendChild(preview);
      }
    }]
  });
})();