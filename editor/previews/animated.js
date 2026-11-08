(function () {
  const MAX_FRAMES = 240;
  const MAX_DIMENSION = 4096;
  const MAX_TOTAL_PIXELS = 120000000;
  const scripts = new Map();
  const GIFENC_URL = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm';
  const UPNG_URL = 'https://unpkg.com/@pdf-lib/upng@1.0.1/dist/UPNG.min.js';
  const GIF_URL = 'https://cdn.jsdelivr.net/npm/omggif@1.0.10/omggif.js';
  const WEBPMUX_BASE = 'https://cdn.jsdelivr.net/gh/SumiMakito/webpxmux.js@d2a02f004c6702b48446f493a24e92da0958e94c/dist/';

  function loadScript(url, test) {
    if (test()) return Promise.resolve();
    if (scripts.has(url)) return scripts.get(url);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => test() ? resolve() : reject(new Error('The image codec loaded but did not expose its API.'));
      script.onerror = () => reject(new Error('Could not load the image codec: ' + url));
      document.head.appendChild(script);
    });
    scripts.set(url, promise);
    promise.catch(() => scripts.delete(url));
    return promise;
  }

  function toBytes(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    if (typeof value === 'string') {
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
      return bytes;
    }
    throw new Error('The file could not be read as binary image data.');
  }

  function exactBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  function readAscii(bytes, offset, length) {
    let value = '';
    for (let i = 0; i < length && offset + i < bytes.length; i++) value += String.fromCharCode(bytes[offset + i]);
    return value;
  }

  function hasPngChunk(bytes, wanted) {
    if (bytes.length < 20 || readAscii(bytes, 1, 3) !== 'PNG') return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset, false);
      if (offset + 12 + length > bytes.length) break;
      if (readAscii(bytes, offset + 4, 4) === wanted) return true;
      offset += length + 12;
    }
    return false;
  }

  function isAnimatedWebP(bytes) {
    if (bytes.length < 16 || readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const type = readAscii(bytes, offset, 4);
      const length = view.getUint32(offset + 4, true);
      if (type === 'ANIM' || type === 'ANMF') return true;
      offset += 8 + length + (length & 1);
    }
    return false;
  }

  function isAnimatedAvif(bytes) {
    if (bytes.length < 16 || readAscii(bytes, 4, 4) !== 'ftyp') return false;
    const end = Math.min(bytes.length, 64);
    return readAscii(bytes, 8, end - 8).includes('avis');
  }

  function isAnimationFile(file, state) {
    const name = String(file.name || file.path || '').toLowerCase();
    const mime = String(file.mime || '').toLowerCase();
    if (name.endsWith('.gif') || mime === 'image/gif' || name.endsWith('.apng') || mime === 'image/apng') return true;
    const fs = state?.fs;
    if (!fs?.readFileSync) return false;
    try {
      const bytes = toBytes(fs.readFileSync(file.path, 'binary'));
      if (name.endsWith('.png') || mime === 'image/png') return hasPngChunk(bytes, 'acTL');
      if (name.endsWith('.webp') || mime === 'image/webp') return isAnimatedWebP(bytes);
      if (name.endsWith('.avif') || mime === 'image/avif') return isAnimatedAvif(bytes);
    } catch (_) {}
    return false;
  }

  function validateDimensions(width, height, frameCount) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > 16777216) {
      throw new Error('This animation has dimensions outside the editor limit (4096 × 4096, 16 megapixels per frame).');
    }
    if (frameCount > MAX_FRAMES || width * height * frameCount > MAX_TOTAL_PIXELS) {
      throw new Error('This animation contains too much image data for a safe in-memory edit. The limit is ' + MAX_FRAMES + ' frames and 120 million total pixels.');
    }
  }

  function imageDataFromCanvas(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    return new Uint8ClampedArray(context.getImageData(0, 0, canvas.width, canvas.height).data);
  }

  async function decodeWithImageDecoder(bytes, mime) {
    if (typeof window.ImageDecoder !== 'function') return null;
    try {
      if (typeof window.ImageDecoder.isTypeSupported === 'function' &&
          !(await window.ImageDecoder.isTypeSupported(mime))) return null;
      const decoder = new window.ImageDecoder({ data: bytes, type: mime });
      try {
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const count = Math.max(1, Number(track?.frameCount) || 1);
        const width = Number(track?.codedWidth || decoder.displayWidth);
        const height = Number(track?.codedHeight || decoder.displayHeight);
        validateDimensions(width, height, count);
        const frames = [];
        for (let i = 0; i < count; i++) {
          const decoded = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
          const image = decoded.image;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          frames.push({
            data: imageDataFromCanvas(canvas),
            duration: Math.max(10, Math.round((Number(image.duration) || 100000) / 1000))
          });
          image.close?.();
        }
        return { width, height, frames, loopCount: Number(track?.repetitionCount) > 0 ? Number(track.repetitionCount) : 0 };
      } finally {
        decoder.close();
      }
    } catch (_) {
      return null;
    }
  }

  async function loadUPNG() {
    await loadScript(UPNG_URL, () => !!window.UPNG?.decode);
    return window.UPNG;
  }

  async function decodeAPNG(bytes) {
    const upng = await loadUPNG();
    const image = upng.decode(exactBuffer(bytes));
    const rgba = upng.toRGBA8(image);
    const count = Math.max(1, rgba.length);
    validateDimensions(image.width, image.height, count);
    const frames = rgba.map((buffer, index) => ({
      data: new Uint8ClampedArray(buffer),
      duration: Math.max(10, Number(image.frames?.[index]?.delay) || 100)
    }));
    return { width: image.width, height: image.height, frames, loopCount: Number(image.tabs?.acTL?.num_plays) || 0 };
  }

  async function decodeGIF(bytes) {
    await loadScript(GIF_URL, () => typeof window.GifReader === 'function');
    const reader = new window.GifReader(bytes);
    const width = reader.width, height = reader.height, count = reader.numFrames();
    validateDimensions(width, height, count);
    const composite = new Uint8ClampedArray(width * height * 4);
    const frames = [];
    for (let i = 0; i < count; i++) {
      const info = reader.frameInfo(i);
      const previous = info.disposal === 3 ? composite.slice() : null;
      reader.decodeAndBlitFrameRGBA(i, composite);
      frames.push({ data: composite.slice(), duration: Math.max(20, Number(info.delay || 10) * 10) });
      if (info.disposal === 2) {
        for (let y = info.y; y < info.y + info.height; y++) {
          const start = (y * width + info.x) * 4;
          composite.fill(0, start, start + info.width * 4);
        }
      } else if (info.disposal === 3 && previous) {
        composite.set(previous);
      }
    }
    return { width, height, frames, loopCount: Number(reader.loopCount?.()) || 0 };
  }

  async function loadWebPMux() {
    await loadScript(WEBPMUX_BASE + 'webpxmux.min.js', () => typeof window.WebPXMux === 'function');
    if (!window.__editorWebPMux) {
      window.__editorWebPMux = window.WebPXMux(WEBPMUX_BASE + 'webpxmux.wasm');
      await window.__editorWebPMux.waitRuntime();
    }
    return window.__editorWebPMux;
  }

  async function decodeWebP(bytes) {
    const mux = await loadWebPMux();
    const result = await mux.decodeFrames(bytes);
    validateDimensions(result.width, result.height, result.frameCount);
    const frames = result.frames.map(frame => {
      const source = frame.rgba instanceof Uint32Array ? frame.rgba : new Uint32Array(frame.rgba);
      const data = new Uint8ClampedArray(source.length * 4);
      for (let i = 0; i < source.length; i++) {
        const value = source[i];
        const p = i * 4;
        data[p] = value >>> 24;
        data[p + 1] = (value >>> 16) & 255;
        data[p + 2] = (value >>> 8) & 255;
        data[p + 3] = value & 255;
      }
      return { data, duration: Math.max(10, Number(frame.duration) || 100) };
    });
    return { width: result.width, height: result.height, frames, loopCount: Number(result.loopCount) || 0 };
  }

  async function decodeStill(bytes, mime) {
    const blob = new Blob([bytes], { type: mime || 'image/png' });
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (_) {
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, frames: [{ data: imageDataFromCanvas(canvas), duration: 100 }], loopCount: 0 };
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    try {
      const width = bitmap.width, height = bitmap.height;
      validateDimensions(width, height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      return { width, height, frames: [{ data: imageDataFromCanvas(canvas), duration: 100 }], loopCount: 0 };
    } finally {
      bitmap.close?.();
    }
  }

  function isImageFile(file) {
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type.startsWith('image/') || /\.(?:png|apng|gif|jpe?g|bmp|webp|avif|svg|ico|tiff?)$/i.test(name);
  }

  function inferMime(file) {
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('image/')) return type;
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.apng')) return 'image/apng';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.avif')) return 'image/avif';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.bmp')) return 'image/bmp';
    if (name.endsWith('.svg')) return 'image/svg+xml';
    return 'image/png';
  }

  async function decodeFile(file) {
    const bytes = toBytes(new Uint8Array(await file.arrayBuffer()));
    const mime = inferMime(file);
    const modern = await decodeWithImageDecoder(bytes, mime);
    if (modern) return modern;
    if (mime === 'image/gif') return decodeGIF(bytes);
    if (mime === 'image/apng' || (mime === 'image/png' && hasPngChunk(bytes, 'acTL'))) return decodeAPNG(bytes);
    if (mime === 'image/webp' && isAnimatedWebP(bytes)) return decodeWebP(bytes);
    if (mime === 'image/avif' && isAnimatedAvif(bytes)) {
      throw new Error('Animated AVIF editing requires WebCodecs ImageDecoder support in this browser.');
    }
    return decodeStill(bytes, mime);
  }

  function normalizeFrame(data, sourceWidth, sourceHeight, width, height) {
    if (sourceWidth === width && sourceHeight === height) return new Uint8ClampedArray(data);
    const source = document.createElement('canvas');
    source.width = sourceWidth;
    source.height = sourceHeight;
    source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), sourceWidth, sourceHeight), 0, 0);
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d');
    context.clearRect(0, 0, width, height);
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(source, Math.round((width - drawWidth) / 2), Math.round((height - drawHeight) / 2), drawWidth, drawHeight);
    return imageDataFromCanvas(output);
  }

  function button(label, className) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className || 'editor-animation-button';
    element.textContent = label;
    element.title = label;
    return element;
  }

  function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    if (value < 1024) return value + ' B';
    if (value < 1048576) return (value / 1024).toFixed(1) + ' KB';
    return (value / 1048576).toFixed(2) + ' MB';
  }

  function cleanFileName(value) {
    return String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+$/, '').slice(0, 120);
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function canvasBlob(frame, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this frame as PNG.')), 'image/png');
    });
  }

  function frameFileSync(frame, width, height, name) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), width, height), 0, 0);
    const dataURL = canvas.toDataURL('image/png');
    const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png', lastModified: Date.now() });
  }

  async function encodeGIF(frames, width, height, loopCount) {
    const gifenc = await import(GIFENC_URL);
    const encoder = gifenc.GIFEncoder();
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const opaque = new Uint8Array(frame.data.length);
      for (let p = 0; p < frame.data.length; p += 4) {
        opaque[p] = frame.data[p];
        opaque[p + 1] = frame.data[p + 1];
        opaque[p + 2] = frame.data[p + 2];
        opaque[p + 3] = 255;
      }
      const colors = gifenc.quantize(opaque, 255, { format: 'rgb565' });
      const palette = [[0, 0, 0]].concat(colors);
      const indexed = gifenc.applyPalette(opaque, colors, 'rgb565');
      for (let p = 0; p < indexed.length; p++) indexed[p] = frame.data[p * 4 + 3] < 128 ? 0 : indexed[p] + 1;
      encoder.writeFrame(indexed, width, height, {
        palette,
        transparent: true,
        transparentIndex: 0,
        dispose: 2,
        delay: Math.max(20, Math.round(frame.duration / 10) * 10),
        repeat: i === 0 ? (loopCount === 1 ? -1 : (loopCount > 1 ? loopCount - 1 : 0)) : undefined
      });
    }
    encoder.finish();
    return encoder.bytes();
  }

  function crc32(bytes, start, end) {
    let crc = 0xffffffff;
    for (let i = start; i < end; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function setAPNGLoopCount(bytes, loopCount) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset, false);
      const end = offset + 12 + length;
      if (end > bytes.length) break;
      if (readAscii(bytes, offset + 4, 4) === 'acTL' && length === 8) {
        view.setUint32(offset + 12, Math.max(0, Number(loopCount) || 0), false);
        view.setUint32(offset + 16, crc32(bytes, offset + 4, offset + 16), false);
        return bytes;
      }
      offset = end;
    }
    return bytes;
  }

  async function encodeAPNG(frames, width, height, loopCount) {
    const upng = await loadUPNG();
    const buffers = frames.map(frame => exactBuffer(frame.data));
    const delays = frames.map(frame => Math.max(10, Math.round(frame.duration)));
    const encoded = new Uint8Array(upng.encode(buffers, width, height, 0, delays));
    return frames.length > 1 ? setAPNGLoopCount(encoded, loopCount) : encoded;
  }

  async function encodeWebP(frames, width, height, loopCount) {
    const mux = await loadWebPMux();
    const packed = frames.map(frame => {
      const rgba = new Uint32Array(width * height);
      for (let i = 0; i < rgba.length; i++) {
        const p = i * 4;
        rgba[i] = (((frame.data[p] << 24) | (frame.data[p + 1] << 16) | (frame.data[p + 2] << 8) | frame.data[p + 3]) >>> 0);
      }
      return { duration: Math.max(10, Math.round(frame.duration)), isKeyframe: true, rgba };
    });
    return await mux.encodeFrames({ frameCount: packed.length, width, height, loopCount: Number(loopCount) || 0, bgColor: 0, frames: packed });
  }

  function extensionFor(format) {
    return format === 'apng' ? '.png' : '.' + format;
  }

  function extensionFormat(name, bytes) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.gif')) return 'gif';
    if (lower.endsWith('.webp')) return 'webp';
    if (lower.endsWith('.apng') || (lower.endsWith('.png') && hasPngChunk(bytes, 'acTL'))) return 'apng';
    if (lower.endsWith('.png')) return 'apng';
    return 'gif';
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'animated-image',
    match(file, state) {
      return isAnimationFile(file, state);
    },
    views: [{
      id: 'animated-image-editor',
      label: 'Animation Editor',
      default: true,
      priority: 160,
      async create(ctx) {
        const root = document.createElement('section');
        root.className = 'editor-animation-editor';

        const top = document.createElement('div');
        top.className = 'editor-animation-topbar';
        const leftActions = document.createElement('div');
        leftActions.className = 'editor-animation-actions';
        const addButton = button('Add Frames');
        const blankButton = button('Add Blank');
        const duplicateButton = button('Duplicate');
        const previousButton = button('←');
        previousButton.title = 'Move frame left';
        const nextButton = button('→');
        nextButton.title = 'Move frame right';
        const removeButton = button('Remove');
        const playButton = button('▶ Play', 'editor-animation-button primary');
        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'editor-animation-summary';
        leftActions.append(addButton, blankButton, duplicateButton, previousButton, nextButton, removeButton, playButton);
        top.append(leftActions, sizeLabel);

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.gif,.apng,.webp,.avif';
        input.multiple = true;
        input.hidden = true;

        const work = document.createElement('div');
        work.className = 'editor-animation-workspace';
        const stageWrap = document.createElement('div');
        stageWrap.className = 'editor-animation-stage-wrap';
        const stage = document.createElement('canvas');
        stage.className = 'editor-animation-stage';
        stage.width = 1;
        stage.height = 1;
        stageWrap.appendChild(stage);

        const settings = document.createElement('aside');
        settings.className = 'editor-animation-settings';
        const durationLabel = document.createElement('label');
        durationLabel.textContent = 'Frame duration';
        const durationRow = document.createElement('div');
        durationRow.className = 'editor-animation-duration-row';
        const duration = document.createElement('input');
        duration.type = 'number';
        duration.min = '10';
        duration.max = '60000';
        duration.step = '10';
        duration.value = '100';
        duration.setAttribute('aria-label', 'Selected frame duration in milliseconds');
        const durationUnit = document.createElement('span');
        durationUnit.textContent = 'ms';
        durationRow.append(duration, durationUnit);
        const applyAllLabel = document.createElement('label');
        applyAllLabel.className = 'editor-animation-check';
        const applyAll = document.createElement('input');
        applyAll.type = 'checkbox';
        applyAllLabel.append(applyAll, document.createTextNode('Apply timing to all frames'));

        const loopLabel = document.createElement('label');
        loopLabel.textContent = 'Loop playback';
        const loop = document.createElement('select');
        [['0','Forever'],['1','Once'],['2','2 times'],['3','3 times'],['5','5 times']].forEach(pair => {
          const option = document.createElement('option');
          option.value = pair[0];
          option.textContent = pair[1];
          loop.appendChild(option);
        });
        loop.value = '0';
        const playbackLabel = document.createElement('label');
        playbackLabel.textContent = 'Preview speed';
        const playbackSpeed = document.createElement('input');
        playbackSpeed.type = 'range';
        playbackSpeed.min = '0.25';
        playbackSpeed.max = '3';
        playbackSpeed.step = '0.25';
        playbackSpeed.value = '1';
        const playbackSpeedText = document.createElement('span');
        playbackSpeedText.className = 'editor-animation-speed';
        playbackSpeedText.textContent = '1×';
        const speedRow = document.createElement('div');
        speedRow.className = 'editor-animation-speed-row';
        speedRow.append(playbackSpeed, playbackSpeedText);

        const outputTitle = document.createElement('div');
        outputTitle.className = 'editor-animation-section-title';
        outputTitle.textContent = 'Export';
        const outputName = document.createElement('input');
        outputName.type = 'text';
        const originalName = String(ctx.file.name || 'animation').replace(/\.[^.]+$/, '');
        outputName.value = originalName + '-edited';
        outputName.setAttribute('aria-label', 'Output filename');
        const outputFormat = document.createElement('select');
        [['gif','GIF'],['apng','APNG (PNG)'],['webp','Animated WebP']].forEach(pair => {
          const option = document.createElement('option');
          option.value = pair[0];
          option.textContent = pair[1];
          outputFormat.appendChild(option);
        });
        const sourceBytes = toBytes(ctx.readBinary());
        outputFormat.value = extensionFormat(ctx.file.name, sourceBytes);
        const saveCopyButton = button('Save Copy to Project', 'editor-animation-button primary');
        const saveOriginalButton = button('Overwrite Original');
        const downloadAnimationButton = button('Download Animation');
        const saveFrameButton = button('Save Selected Frame');
        const downloadFrameButton = button('Download Selected Frame');
        const saveFramesButton = button('Save All Frames to Project');
        const downloadZipButton = button('Download Frames ZIP');
        const exportActions = document.createElement('div');
        exportActions.className = 'editor-animation-export-actions';
        exportActions.append(saveCopyButton, saveOriginalButton, downloadAnimationButton,
          saveFrameButton, downloadFrameButton, saveFramesButton, downloadZipButton);

        settings.append(durationLabel, durationRow, applyAllLabel, loopLabel, loop, playbackLabel, speedRow,
          outputTitle, outputName, outputFormat, exportActions);

        work.append(stageWrap, settings);
        const timelineWrap = document.createElement('div');
        timelineWrap.className = 'editor-animation-timeline-wrap';
        const timelineHeader = document.createElement('div');
        timelineHeader.className = 'editor-animation-timeline-header';
        const timelineTitle = document.createElement('strong');
        timelineTitle.textContent = 'FRAMES';
        const timelineHelp = document.createElement('span');
        timelineHelp.textContent = 'Drop images here · drag frames to reorder';
        timelineHeader.append(timelineTitle, timelineHelp);
        const timeline = document.createElement('div');
        timeline.className = 'editor-animation-timeline';
        const status = document.createElement('div');
        status.className = 'editor-animation-status';
        timelineWrap.append(timelineHeader, timeline, status);
        root.append(top, work, timelineWrap, input);
        ctx.host.appendChild(root);

        let width = 0, height = 0, frames = [], selected = 0, playing = false, playbackTimer = null, busy = false;
        let currentLoopCount = 0;
        const cleanup = () => {
          playing = false;
          if (playbackTimer) clearTimeout(playbackTimer);
          playbackTimer = null;
        };
        ctx.addCleanup(cleanup);

        function say(message, error) {
          status.textContent = message || '';
          status.classList.toggle('is-error', !!error);
        }

        function writeStatus() {
          sizeLabel.textContent = width + ' × ' + height + ' · ' + frames.length + ' frame' + (frames.length === 1 ? '' : 's');
        }

        function renderStage() {
          if (!frames.length) return;
          stage.width = width;
          stage.height = height;
          const context = stage.getContext('2d');
          context.clearRect(0, 0, width, height);
          context.putImageData(new ImageData(new Uint8ClampedArray(frames[selected].data), width, height), 0, 0);
          duration.value = String(frames[selected].duration);
          writeStatus();
        }

        function renderTimeline() {
          timeline.innerHTML = '';
          frames.forEach((frame, index) => {
            const item = document.createElement('div');
            item.className = 'editor-animation-frame' + (index === selected ? ' selected' : '');
            item.draggable = true;
            item.dataset.index = String(index);
            const thumbnail = document.createElement('canvas');
            thumbnail.className = 'editor-animation-thumb';
            thumbnail.width = 64;
            thumbnail.height = 64;
            const thumbContext = thumbnail.getContext('2d');
            const scale = Math.min(64 / width, 64 / height);
            const thumbWidth = Math.max(1, Math.round(width * scale));
            const thumbHeight = Math.max(1, Math.round(height * scale));
            const offsetX = Math.round((64 - thumbWidth) / 2);
            const offsetY = Math.round((64 - thumbHeight) / 2);
            const thumbData = thumbContext.createImageData(thumbWidth, thumbHeight);
            for (let ty = 0; ty < thumbHeight; ty++) {
              const sy = Math.min(height - 1, Math.floor((ty + 0.5) * height / thumbHeight));
              for (let tx = 0; tx < thumbWidth; tx++) {
                const sx = Math.min(width - 1, Math.floor((tx + 0.5) * width / thumbWidth));
                const src = (sy * width + sx) * 4;
                const dst = (ty * thumbWidth + tx) * 4;
                thumbData.data[dst] = frame.data[src];
                thumbData.data[dst + 1] = frame.data[src + 1];
                thumbData.data[dst + 2] = frame.data[src + 2];
                thumbData.data[dst + 3] = frame.data[src + 3];
              }
            }
            thumbContext.clearRect(0, 0, 64, 64);
            thumbContext.putImageData(thumbData, offsetX, offsetY);
            const label = document.createElement('span');
            label.className = 'editor-animation-frame-number';
            label.textContent = String(index + 1).padStart(2, '0');
            const time = document.createElement('span');
            time.className = 'editor-animation-frame-time';
            time.textContent = frame.duration + ' ms';
            item.append(thumbnail, label, time);
            item.onclick = () => {
              if (playing) stopPlayback();
              selected = index;
              renderStage();
              renderTimeline();
            };
            item.addEventListener('dragstart', event => {
              event.dataTransfer.effectAllowed = 'copyMove';
              event.dataTransfer.setData('application/x-wk-animation-frame', String(index));
              const name = originalName + '-frame-' + String(index + 1).padStart(3, '0') + '.png';
              try {
                const exportedFile = frameFileSync(frame, width, height, name);
                event.dataTransfer.items?.add?.(exportedFile);
                const token = window.__editorFileDropBridge?.registerProvider?.(() => [exportedFile]) || '';
                if (token) {
                  event.dataTransfer.setData('application/x-wk-editor-files', token);
                  item._exportDragToken = token;
                }
              } catch (error) {
                say(error?.message || 'Could not prepare this frame for dragging.', true);
              }
            });
            item.addEventListener('dragend', () => {
              if (item._exportDragToken) window.__editorFileDropBridge?.release?.(item._exportDragToken);
              item._exportDragToken = '';
            });
            item.addEventListener('dragover', event => {
              if (!event.dataTransfer?.types?.includes('application/x-wk-animation-frame')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            });
            item.addEventListener('drop', event => {
              const raw = event.dataTransfer.getData('application/x-wk-animation-frame');
              if (!raw) return;
              event.preventDefault();
              event.stopPropagation();
              const from = Number(raw), to = index;
              if (!Number.isInteger(from) || from < 0 || from >= frames.length || from === to) return;
              const moved = frames.splice(from, 1)[0];
              frames.splice(to, 0, moved);
              selected = to;
              renderStage();
              renderTimeline();
              say('Frame order updated.');
            });
            timeline.appendChild(item);
          });
        }

        function refresh() {
          renderStage();
          renderTimeline();
        }

        function stopPlayback() {
          playing = false;
          if (playbackTimer) clearTimeout(playbackTimer);
          playbackTimer = null;
          playButton.textContent = '▶ Play';
        }

        function startPlayback() {
          if (frames.length < 2) return;
          if (playing) { stopPlayback(); return; }
          playing = true;
          playButton.textContent = 'Ⅱ Pause';
          const tick = () => {
            if (!playing || !frames.length) return;
            selected = (selected + 1) % frames.length;
            renderStage();
            timeline.querySelectorAll('.editor-animation-frame').forEach((item, index) => item.classList.toggle('selected', index === selected));
            const multiplier = Number(playbackSpeed.value) || 1;
            playbackTimer = setTimeout(tick, Math.max(10, frames[selected].duration / multiplier));
          };
          playbackTimer = setTimeout(tick, Math.max(10, frames[selected].duration / (Number(playbackSpeed.value) || 1)));
        }

        function checkAndResize(imported) {
          if (!imported.width || !imported.height || !imported.frames?.length) throw new Error('No readable image frames were found.');
          if (!width || !height) {
            width = imported.width;
            height = imported.height;
            validateDimensions(width, height, imported.frames.length);
          } else {
            validateDimensions(width, height, frames.length + imported.frames.length);
          }
          return imported.frames.map(frame => ({
            data: normalizeFrame(frame.data, imported.width, imported.height, width, height),
            duration: Math.max(10, Math.min(60000, Number(frame.duration) || 100)),
            source: 'Imported'
          }));
        }

        async function importFiles(files) {
          if (busy) return;
          stopPlayback();
          const images = Array.from(files || []).filter(isImageFile);
          if (!images.length) {
            say('Drop image files to add frames.', true);
            return;
          }
          busy = true;
          setBusy(true);
          let importedCount = 0;
          const additions = [];
          try {
            for (const file of images) {
              if (frames.length + additions.length >= MAX_FRAMES) throw new Error('The frame limit is ' + MAX_FRAMES + '.');
              const decoded = await decodeFile(file);
              const normalized = checkAndResize(decoded);
              if (frames.length + additions.length + normalized.length > MAX_FRAMES) {
                throw new Error('Adding these files would exceed the ' + MAX_FRAMES + '-frame limit.');
              }
              additions.push(...normalized);
              importedCount += normalized.length;
            }
            frames.splice(selected + 1, 0, ...additions);
            selected = Math.min(frames.length - 1, selected + additions.length);
            refresh();
            say('Added ' + importedCount + ' frame' + (importedCount === 1 ? '' : 's') + '.');
          } catch (error) {
            say(error?.message || 'Could not import those images.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        function setBusy(value) {
          [addButton, blankButton, duplicateButton, previousButton, nextButton, removeButton,
            saveCopyButton, saveOriginalButton, downloadAnimationButton, saveFrameButton, downloadFrameButton,
            saveFramesButton, downloadZipButton]
            .forEach(control => { control.disabled = !!value; });
        }

        function moveSelected(direction) {
          stopPlayback();
          const destination = selected + direction;
          if (destination < 0 || destination >= frames.length) return;
          const frame = frames.splice(selected, 1)[0];
          frames.splice(destination, 0, frame);
          selected = destination;
          refresh();
        }

        async function encode(format) {
          if (!frames.length) throw new Error('Add at least one frame before exporting.');
          validateDimensions(width, height, frames.length);
          if (format === 'gif') return new Uint8Array(await encodeGIF(frames, width, height, currentLoopCount));
          if (format === 'apng') return new Uint8Array(await encodeAPNG(frames, width, height, currentLoopCount));
          if (format === 'webp') return new Uint8Array(await encodeWebP(frames, width, height, currentLoopCount));
          throw new Error('Unsupported animation format.');
        }

        function currentFormat() {
          const name = String(ctx.file.name || '').toLowerCase();
          if (name.endsWith('.gif')) return 'gif';
          if (name.endsWith('.webp')) return 'webp';
          if (name.endsWith('.apng') || hasPngChunk(sourceBytes, 'acTL') || name.endsWith('.png')) return 'apng';
          return outputFormat.value;
        }

        function parentPath(path) {
          const normalized = String(path || '').replace(/\\/g, '/');
          const at = normalized.lastIndexOf('/');
          return at < 0 ? '' : normalized.slice(0, at);
        }

        function pathExists(path) {
          return !!ctx.state.fs?.existsSync?.(path);
        }

        function writeProjectFile(path, bytes) {
          ctx.writeBinary(new Uint8Array(bytes), path);
          ctx.state.fileManager?.refresh?.();
          ctx.state.updateStatus?.();
        }

        async function saveCopy() {
          if (busy) return;
          const base = cleanFileName(outputName.value);
          if (!base) { say('Enter a filename for the exported animation.', true); return; }
          busy = true;
          setBusy(true);
          try {
            const format = outputFormat.value;
            const bytes = await encode(format);
            const path = [parentPath(ctx.file.path), base + extensionFor(format)].filter(Boolean).join('/');
            if (pathExists(path) && !confirm('Replace ' + path + '?')) return;
            writeProjectFile(path, bytes);
            say('Saved ' + path + ' · ' + formatBytes(bytes.byteLength));
          } catch (error) {
            say(error?.message || 'Could not export this animation.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        async function overwriteOriginal() {
          if (busy) return;
          busy = true;
          setBusy(true);
          try {
            const format = currentFormat();
            const bytes = await encode(format);
            writeProjectFile(ctx.file.path, bytes);
            say('Updated ' + ctx.file.path + ' · ' + formatBytes(bytes.byteLength));
          } catch (error) {
            say(error?.message || 'Could not update the original animation.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        async function downloadAnimation() {
          if (busy) return;
          busy = true;
          setBusy(true);
          try {
            const format = outputFormat.value;
            const bytes = await encode(format);
            downloadBlob(new Blob([bytes], { type: format === 'gif' ? 'image/gif' : format === 'webp' ? 'image/webp' : 'image/png' }),
              cleanFileName(outputName.value || 'animation') + extensionFor(format));
            say('Animation downloaded · ' + formatBytes(bytes.byteLength));
          } catch (error) {
            say(error?.message || 'Could not download this animation.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        function nextAvailablePath(path) {
          if (!pathExists(path)) return path;
          const dot = path.lastIndexOf('.');
          const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
          const extension = dot > path.lastIndexOf('/') ? path.slice(dot) : '';
          let number = 2, candidate;
          do { candidate = stem + '-' + number++ + extension; } while (pathExists(candidate));
          return candidate;
        }

        async function saveSelectedFrame() {
          if (busy || !frames.length) return;
          busy = true;
          setBusy(true);
          try {
            const blob = await canvasBlob(frames[selected], width, height);
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const base = cleanFileName(originalName || 'animation') || 'animation';
            const path = nextAvailablePath([parentPath(ctx.file.path), base + '-frame-' + String(selected + 1).padStart(3, '0') + '.png'].filter(Boolean).join('/'));
            writeProjectFile(path, bytes);
            say('Saved selected frame to ' + path);
          } catch (error) {
            say(error?.message || 'Could not save the selected frame.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        async function downloadSelectedFrame() {
          if (busy || !frames.length) return;
          try {
            const blob = await canvasBlob(frames[selected], width, height);
            downloadBlob(blob, (cleanFileName(originalName || 'animation') || 'animation') +
              '-frame-' + String(selected + 1).padStart(3, '0') + '.png');
            say('Downloaded selected frame as PNG.');
          } catch (error) {
            say(error?.message || 'Could not download the selected frame.', true);
          }
        }

        async function saveAllFrames() {
          if (!frames.length) return;
          busy = true;
          setBusy(true);
          try {
            const folderName = cleanFileName(originalName || 'animation') + '_frames';
            let folder = [parentPath(ctx.file.path), folderName].filter(Boolean).join('/');
            let suffix = 2;
            while (ctx.state.fs?.isDirectorySync?.(folder) || pathExists(folder + '/frame-001.png')) {
              folder = [parentPath(ctx.file.path), folderName + '-' + suffix++].filter(Boolean).join('/');
            }
            ctx.state.fs.mkdirSync(folder);
            for (let i = 0; i < frames.length; i++) {
              const blob = await canvasBlob(frames[i], width, height);
              const bytes = new Uint8Array(await blob.arrayBuffer());
              const path = folder + '/frame-' + String(i + 1).padStart(3, '0') + '.png';
              ctx.writeBinary(bytes, path);
            }
            ctx.state.fileManager?.refresh?.();
            ctx.state.updateStatus?.();
            say('Saved ' + frames.length + ' PNG frames to ' + folder + '/');
          } catch (error) {
            say(error?.message || 'Could not save the frames.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        async function downloadFramesZip() {
          if (busy) return;
          if (typeof JSZip === 'undefined') { say('ZIP export is not available.', true); return; }
          busy = true;
          setBusy(true);
          try {
            const zip = new JSZip();
            for (let i = 0; i < frames.length; i++) {
              const blob = await canvasBlob(frames[i], width, height);
              zip.file('frame-' + String(i + 1).padStart(3, '0') + '.png', blob);
            }
            const blob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(blob, cleanFileName(originalName || 'animation') + '-frames.zip');
            say('Downloaded ' + frames.length + ' PNG frames in a ZIP archive.');
          } catch (error) {
            say(error?.message || 'Could not create the frame archive.', true);
          } finally {
            busy = false;
            setBusy(false);
          }
        }

        addButton.onclick = () => input.click();
        input.addEventListener('change', () => {
          importFiles(input.files);
          input.value = '';
        });
        blankButton.onclick = () => {
          if (busy || !width || !height || frames.length >= MAX_FRAMES) return;
          stopPlayback();
          frames.splice(selected + 1, 0, { data: new Uint8ClampedArray(width * height * 4), duration: 100, source: 'Blank' });
          selected++;
          refresh();
          say('Added a blank frame.');
        };
        duplicateButton.onclick = () => {
          if (busy || frames.length >= MAX_FRAMES) return;
          stopPlayback();
          const copy = { data: new Uint8ClampedArray(frames[selected].data), duration: frames[selected].duration, source: 'Duplicate' };
          frames.splice(selected + 1, 0, copy);
          selected++;
          refresh();
          say('Duplicated the selected frame.');
        };
        previousButton.onclick = () => moveSelected(-1);
        nextButton.onclick = () => moveSelected(1);
        removeButton.onclick = () => {
          if (busy) return;
          if (frames.length <= 1) { say('Keep at least one frame in the animation.', true); return; }
          stopPlayback();
          frames.splice(selected, 1);
          selected = Math.min(selected, frames.length - 1);
          refresh();
          say('Removed a frame.');
        };
        playButton.onclick = startPlayback;
        duration.addEventListener('change', () => {
          stopPlayback();
          const value = Math.max(10, Math.min(60000, Number(duration.value) || 100));
          if (applyAll.checked) frames.forEach(frame => { frame.duration = value; });
          else frames[selected].duration = value;
          duration.value = String(value);
          renderTimeline();
          say(applyAll.checked ? 'Updated timing for all frames.' : 'Updated selected frame timing.');
        });
        loop.addEventListener('change', () => { currentLoopCount = Number(loop.value) || 0; });
        playbackSpeed.addEventListener('input', () => { playbackSpeedText.textContent = playbackSpeed.value + '×'; });
        saveCopyButton.onclick = saveCopy;
        saveOriginalButton.onclick = overwriteOriginal;
        downloadAnimationButton.onclick = downloadAnimation;
        saveFrameButton.onclick = saveSelectedFrame;
        downloadFrameButton.onclick = downloadSelectedFrame;
        saveFramesButton.onclick = saveAllFrames;
        downloadZipButton.onclick = downloadFramesZip;

        root.addEventListener('dragover', event => {
          if (event.dataTransfer?.types?.includes('application/x-wk-animation-frame')) return;
          event.preventDefault();
          root.classList.add('dragover');
          event.dataTransfer.dropEffect = 'copy';
        });
        root.addEventListener('dragleave', event => {
          if (!root.contains(event.relatedTarget)) root.classList.remove('dragover');
        });
        root.addEventListener('drop', async event => {
          if (event.dataTransfer?.types?.includes('application/x-wk-animation-frame')) return;
          event.preventDefault();
          event.stopPropagation();
          root.classList.remove('dragover');
          let files = [];
          try {
            const editorToken = event.dataTransfer.getData('application/x-wk-editor-files');
            const browserToken = event.dataTransfer.getData('application/x-proxy-download');
            if (editorToken || browserToken) {
              const token = editorToken || browserToken;
              const payload = await window.__editorFileDropBridge?.take?.(token);
              files = (Array.isArray(payload) ? payload : [payload]).filter(file => file && typeof file.arrayBuffer === 'function');
            } else if (event.dataTransfer.files?.length) {
              files = Array.from(event.dataTransfer.files);
            }
          } catch (error) {
            say(error?.message || 'Could not read the dropped files.', true);
            return;
          }
          importFiles(files);
        });

        try {
          const initialMime = String(ctx.file.mime || inferMime({ name: ctx.file.name }));
          let decoded = await decodeWithImageDecoder(sourceBytes, initialMime);
          if (!decoded) {
            if (initialMime === 'image/gif') decoded = await decodeGIF(sourceBytes);
            else if (initialMime === 'image/webp' && isAnimatedWebP(sourceBytes)) decoded = await decodeWebP(sourceBytes);
            else if (hasPngChunk(sourceBytes, 'acTL')) decoded = await decodeAPNG(sourceBytes);
            else decoded = await decodeStill(sourceBytes, initialMime);
          }
          validateDimensions(decoded.width, decoded.height, decoded.frames.length);
          width = decoded.width;
          height = decoded.height;
          frames = decoded.frames.map(frame => ({
            data: new Uint8ClampedArray(frame.data),
            duration: Math.max(10, Math.min(60000, Number(frame.duration) || 100)),
            source: 'Original'
          }));
          currentLoopCount = Number(decoded.loopCount) || 0;
          loop.value = String([0,1,2,3,5].includes(currentLoopCount) ? currentLoopCount : 0);
          refresh();
          say('Loaded ' + frames.length + ' frame' + (frames.length === 1 ? '' : 's') + ' from ' + ctx.file.name + '.');
        } catch (error) {
          say(error?.message || 'Could not decode this animation.', true);
          const errorPanel = document.createElement('div');
          errorPanel.className = 'editor-animation-error';
          errorPanel.textContent = 'The animation could not be decoded. Try importing the frames as separate images.';
          stageWrap.appendChild(errorPanel);
          addButton.disabled = false;
        }

        if (!frames.length) {
          width = height = 1;
          frames = [{ data: new Uint8ClampedArray(4), duration: 100, source: 'Blank' }];
          refresh();
        }
      }
    }]
  });
})();