(function () {
  const FILE_SAVED_EVENT = 'editor-audio-file-saved';
  const AUDIO_EXTENSION = /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|wave|webm)$/i;
  let tagFormSequence = 0;
  const FIELDS = [
    ['title', 'Title', 'text'],
    ['artist', 'Artist', 'text'],
    ['album', 'Album', 'text'],
    ['albumArtist', 'Album artist', 'text'],
    ['genre', 'Genre', 'text'],
    ['year', 'Year', 'text'],
    ['track', 'Track number', 'text'],
    ['disc', 'Disc number', 'text'],
    ['composer', 'Composer', 'text'],
    ['comment', 'Comment', 'textarea'],
    ['lyrics', 'Lyrics', 'textarea']
  ];

  function isTaggable(file) {
    const name = String(file.name || file.path || '');
    const mime = String(file.mime || '').toLowerCase();
    return /\.mp3$/i.test(name) || /\.wav$/i.test(name) ||
      mime === 'audio/mpeg' || mime === 'audio/mp3' ||
      ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(mime);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + String(secs).padStart(2, '0');
  }

  function makeIcon(path, solid = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', solid ? 'currentColor' : 'none');
    svg.setAttribute('stroke', solid ? 'none' : 'currentColor');
    if (!solid) {
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
  }

  function makeButton(label, iconPath, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || 'editor-audio-button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(makeIcon(iconPath));
    return button;
  }

  function metadataFrom(ctx) {
    try {
      const bytes = ctx.readBinary();
      return window.EditorAudioTags.read(bytes, isWav(ctx.file) ? 'wav' : 'mp3');
    } catch (_) {
      return { tags: {}, picture: null, frames: [], format: isWav(ctx.file) ? 'wav' : 'mp3' };
    }
  }

  function isWav(file) {
    return /\.wav$/i.test(String(file.name || file.path || '')) ||
      ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(String(file.mime || '').toLowerCase());
  }

  function makeArtwork(host, picture, className) {
    host.innerHTML = '';
    host.classList.toggle('has-artwork', !!picture?.data?.length);
    if (picture?.data?.length) {
      const url = URL.createObjectURL(new Blob([picture.data], { type: picture.mime || 'image/jpeg' }));
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Album artwork';
      host.appendChild(img);
      return url;
    }
    const art = document.createElement('div');
    art.className = 'editor-audio-art-placeholder';
    art.innerHTML = '<span class="editor-audio-note">♫</span><span class="editor-audio-art-glow"></span>';
    host.appendChild(art);
    return null;
  }

  function applyArtworkAccent(root, image) {
    const reset = () => {
      root.style.removeProperty('--audio-cover-accent');
      root.style.removeProperty('--audio-cover-secondary');
      root.style.removeProperty('--audio-cover-primary-light');
      root.style.removeProperty('--audio-cover-glow');
      root.style.removeProperty('--audio-cover-accent-ink');
    };
    if (!image) {
      reset();
      return;
    }
    const sample = () => {
      if (!image.isConnected) return;
      if (!image.naturalWidth || !image.naturalHeight) {
        reset();
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const bins = Array.from({ length: 36 }, () => ({
          weight: 0, x: 0, y: 0, saturation: 0, lightness: 0, count: 0
        }));
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3] / 255;
          if (alpha < 0.45) continue;
          const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
          if (max < 0.075 || delta < 0.025) continue;
          const saturation = max ? delta / max : 0;
          // Ignore genuinely neutral highlights, not bright saturated colors.
          // The previous max > 0.97 cutoff discarded vivid yellow/cyan artwork,
          // allowing a smaller green object to become the chosen accent.
          if (saturation < 0.14 || (max > 0.985 && saturation < 0.23)) continue;
          let hue;
          if (max === r) hue = 60 * (((g - b) / delta) % 6);
          else if (max === g) hue = 60 * ((b - r) / delta + 2);
          else hue = 60 * ((r - g) / delta + 4);
          if (hue < 0) hue += 360;
          const weight = alpha * (0.72 + Math.min(1, saturation) * 0.28);
          const bin = bins[Math.floor(hue / 10) % 36];
          const radians = hue * Math.PI / 180;
          bin.weight += weight;
          bin.x += Math.cos(radians) * weight;
          bin.y += Math.sin(radians) * weight;
          bin.saturation += saturation * weight;
          bin.lightness += ((max + min) / 2) * weight;
          bin.count++;
        }

        const hueOf = bin => {
          let hue = Math.atan2(bin.y, bin.x) * 180 / Math.PI;
          return hue < 0 ? hue + 360 : hue;
        };
        const hueDistance = (a, b) => {
          const delta = Math.abs(a - b) % 360;
          return Math.min(delta, 360 - delta);
        };
        const scoreAt = index => {
          const previous = bins[(index + 35) % 36];
          const current = bins[index];
          const next = bins[(index + 1) % 36];
          return current.weight + (previous.weight + next.weight) * 0.35;
        };
        const candidates = bins.map((bin, index) => ({
          bin, hue: hueOf(bin), score: scoreAt(index)
        })).filter(candidate => candidate.bin.weight > 0);
        candidates.sort((a, b) => b.score - a.score);
        const primary = candidates[0];
        if (!primary || primary.score < 1.25) {
          reset();
          return;
        }
        const secondary = candidates.find(candidate =>
          hueDistance(candidate.hue, primary.hue) >= 28 &&
          candidate.score >= Math.max(1.1, primary.score * 0.16)
        );
        const toColor = (candidate, fallback) => {
          if (!candidate) return fallback;
          const bin = candidate.bin;
          const saturation = Math.max(48, Math.min(84, (bin.saturation / bin.weight) * 100));
          const lightness = Math.max(40, Math.min(68, (bin.lightness / bin.weight) * 100));
          return 'hsl(' + Math.round(candidate.hue) + ' ' + Math.round(saturation) + '% ' + Math.round(lightness) + '%)';
        };
        const primaryColor = toColor(primary);
        // If artwork is effectively monochrome, use a lighter tint of its
        // actual dominant hue instead of inventing a different hue.
        const secondaryColor = toColor(secondary) ||
          'hsl(' + Math.round((primary.hue + 12) % 360) + ' 42% 70%)';
        const primaryHue = Math.round(primary.hue);
        const primaryLight = 'hsl(' + primaryHue + ' 42% 74%)';
        root.style.setProperty('--audio-cover-accent', primaryColor);
        root.style.setProperty('--audio-cover-secondary', secondaryColor);
        root.style.setProperty('--audio-cover-primary-light', primaryLight);
        root.style.setProperty('--audio-cover-glow', 'hsl(' + primaryHue + ' 42% 22%)');
        root.style.setProperty('--audio-cover-accent-ink', 'hsl(' + primaryHue + ' 28% 11%)');
      } catch (_) {
        // Tainted or unsupported image formats should leave the default theme intact.
        reset();
      }
    };
    if (image.complete) sample();
    else {
      image.addEventListener('load', sample, { once: true });
      image.addEventListener('error', () => {
        if (image.isConnected) reset();
      }, { once: true });
    }
  }

  function updateRangeFill(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Math.min(max, Math.max(min, Number(input.value || 0)));
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    const fill = 'var(--audio-cover-accent, #d8e9da)';
    input.style.background = 'linear-gradient(to right, ' + fill + ' 0%, ' + fill + ' ' + percent + '%, #ffffff35 ' + percent + '%, #ffffff35 100%)';
  }

  function makePlayer(ctx) {
    const root = document.createElement('section');
    root.className = 'editor-audio-player';

    const card = document.createElement('div');
    card.className = 'editor-audio-card';

    const art = document.createElement('div');
    art.className = 'editor-audio-artwork';

    const details = document.createElement('div');
    details.className = 'editor-audio-details';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'editor-audio-eyebrow';
    eyebrow.textContent = 'NOW PLAYING';
    const title = document.createElement('h2');
    title.className = 'editor-audio-title';
    const artist = document.createElement('div');
    artist.className = 'editor-audio-artist';
    const album = document.createElement('div');
    album.className = 'editor-audio-album';
    details.append(eyebrow, title, artist, album);

    const tags = document.createElement('div');
    tags.className = 'editor-audio-tags';
    details.appendChild(tags);
    card.append(art, details);

    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = ctx.getURL();
    audio.className = 'editor-audio-source';
    audio.setAttribute('aria-label', 'Audio playback source');

    const controls = document.createElement('div');
    controls.className = 'editor-audio-controls';
    const play = makeButton('Play', 'M8 5v14l11-7z', 'editor-audio-play');
    const current = document.createElement('span');
    current.className = 'editor-audio-time';
    current.textContent = '0:00';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.max = '1000';
    progress.step = '1';
    progress.value = '0';
    progress.className = 'editor-audio-progress';
    progress.setAttribute('aria-label', 'Playback position');
    const duration = document.createElement('span');
    duration.className = 'editor-audio-time';
    duration.textContent = '0:00';
    const volumeButton = makeButton('Mute', 'M11 5 6 9H3v6h3l5 4z M15 9a5 5 0 0 1 0 6 M18 6a9 9 0 0 1 0 12', 'editor-audio-button editor-audio-volume-button');
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.01';
    volume.value = '1';
    volume.className = 'editor-audio-volume';
    volume.setAttribute('aria-label', 'Volume');
    const speed = document.createElement('select');
    speed.className = 'editor-audio-speed';
    speed.setAttribute('aria-label', 'Playback speed');
    speed.title = 'Playback speed';
    for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      const option = document.createElement('option');
      option.value = String(rate);
      option.textContent = (rate === 1 ? '1' : String(rate)) + '×';
      speed.appendChild(option);
    }
    speed.value = '1';
    controls.append(play, current, progress, duration, volumeButton, volume, speed);
    updateRangeFill(progress);
    updateRangeFill(volume);

    const footer = document.createElement('div');
    footer.className = 'editor-audio-footer';
    const filename = document.createElement('span');
    filename.className = 'editor-audio-filename';
    filename.textContent = ctx.file.name;
    const format = document.createElement('span');
    format.className = 'editor-audio-format';
    format.textContent = isWav(ctx.file) ? 'WAV AUDIO' : /\.mp3$/i.test(ctx.file.name) ? 'MP3 AUDIO' : String(ctx.file.mime || 'AUDIO').toUpperCase();
    footer.append(filename, format);

    root.append(card, audio, controls, footer);
    ctx.host.appendChild(root);

    let metadata = metadataFrom(ctx);
    let artworkURL = null;
    let dragging = false;
    let disposed = false;

    const updateMetadata = data => {
      const values = data?.tags || {};
      title.textContent = values.title || ctx.file.name.replace(/\.[^.]+$/, '');
      artist.textContent = values.artist || 'Unknown artist';
      album.textContent = values.album ? 'Album · ' + values.album : '';
      tags.innerHTML = '';
      const items = [
        values.albumArtist ? 'Album artist: ' + values.albumArtist : '',
        values.genre ? values.genre : '',
        values.year ? values.year : '',
        values.track ? 'Track ' + values.track : '',
        values.disc ? 'Disc ' + values.disc : ''
      ].filter(Boolean);
      for (const item of items) {
        const chip = document.createElement('span');
        chip.className = 'editor-audio-tag';
        chip.textContent = item;
        tags.appendChild(chip);
      }
      if (artworkURL) URL.revokeObjectURL(artworkURL);
      artworkURL = makeArtwork(art, data?.picture, 'artwork');
      applyArtworkAccent(root, art.querySelector('img'));
    };

    const updatePlayButton = () => {
      play.innerHTML = '';
      if (audio.paused) {
        play.appendChild(makeIcon('M8 5v14l11-7z', true));
        play.setAttribute('aria-label', 'Play');
        play.title = 'Play';
      } else {
        play.appendChild(makeIcon('M7 5h4v14H7z M15 5h4v14h-4z', true));
        play.setAttribute('aria-label', 'Pause');
        play.title = 'Pause';
      }
    };

    play.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    audio.addEventListener('play', updatePlayButton);
    audio.addEventListener('pause', updatePlayButton);
    audio.addEventListener('ended', updatePlayButton);
    audio.addEventListener('loadedmetadata', () => {
      duration.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      current.textContent = formatTime(audio.currentTime);
      duration.textContent = formatTime(audio.duration);
      if (!dragging) progress.value = String(audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0);
      updateRangeFill(progress);
    });
    progress.addEventListener('input', () => { dragging = true; updateRangeFill(progress); });
    progress.addEventListener('change', () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = Number(progress.value) / 1000 * audio.duration;
      dragging = false;
    });
    volume.addEventListener('input', () => {
      audio.volume = Number(volume.value);
      audio.muted = audio.volume === 0;
      updateRangeFill(volume);
    });
    audio.addEventListener('volumechange', () => {
      if (audio.muted) volume.value = '0';
      else volume.value = String(audio.volume);
      updateRangeFill(volume);
      volumeButton.title = audio.muted ? 'Unmute' : 'Mute';
      volumeButton.setAttribute('aria-label', volumeButton.title);
    });
    volumeButton.addEventListener('click', () => {
      audio.muted = !audio.muted;
      if (!audio.muted && audio.volume === 0) audio.volume = 1;
      volume.value = audio.muted ? '0' : String(audio.volume || 1);
      updateRangeFill(volume);
    });
    speed.addEventListener('change', () => {
      audio.playbackRate = Number(speed.value) || 1;
    });
    const refresh = event => {
      if (event?.detail?.path !== ctx.file.path || disposed) return;
      const wasPlaying = !audio.paused;
      const time = audio.currentTime;
      metadata = metadataFrom(ctx);
      updateMetadata(metadata);
      const nextURL = ctx.getURL();
      if (!nextURL) return;
      audio.src = nextURL;
      audio.load();
      audio.addEventListener('loadedmetadata', function restore() {
        audio.removeEventListener('loadedmetadata', restore);
        if (Number.isFinite(time) && time < audio.duration) audio.currentTime = time;
        if (wasPlaying) audio.play().catch(() => {});
      }, { once: true });
    };
    window.addEventListener(FILE_SAVED_EVENT, refresh);

    updateMetadata(metadata);
    updatePlayButton();
    ctx.addCleanup(() => {
      disposed = true;
      window.removeEventListener(FILE_SAVED_EVENT, refresh);
      if (artworkURL) URL.revokeObjectURL(artworkURL);
      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
    });
  }

  function makeRawPlayer(ctx) {
    const wrap = document.createElement('div');
    wrap.className = 'editor-audio-raw';
    const audio = document.createElement('audio');
    audio.className = 'editor-media';
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = ctx.getURL();
    wrap.appendChild(audio);
    ctx.host.appendChild(wrap);

    let disposed = false;
    const refresh = event => {
      if (event?.detail?.path !== ctx.file.path || disposed) return;
      const wasPlaying = !audio.paused;
      const time = audio.currentTime;
      const nextURL = ctx.getURL();
      if (!nextURL) return;
      audio.src = nextURL;
      audio.load();
      audio.addEventListener('loadedmetadata', function restore() {
        audio.removeEventListener('loadedmetadata', restore);
        if (Number.isFinite(time) && time < audio.duration) audio.currentTime = time;
        if (wasPlaying) audio.play().catch(() => {});
      }, { once: true });
    };
    window.addEventListener(FILE_SAVED_EVENT, refresh);
    ctx.addCleanup(() => {
      disposed = true;
      window.removeEventListener(FILE_SAVED_EVENT, refresh);
      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
    });
  }

  function makeTagEditor(ctx) {
    const format = isWav(ctx.file) ? 'wav' : 'mp3';
    let parsed;
    try {
      parsed = window.EditorAudioTags.read(ctx.readBinary(), format);
    } catch (error) {
      const message = document.createElement('div');
      message.className = 'editor-audio-editor-error';
      message.textContent = error?.message || 'Could not read this audio file.';
      ctx.host.appendChild(message);
      return;
    }

    const root = document.createElement('section');
    root.className = 'editor-audio-editor';
    const header = document.createElement('div');
    header.className = 'editor-audio-editor-heading';
    const heading = document.createElement('div');
    heading.innerHTML = '<h2>Edit audio tags</h2><p>Metadata is written into the audio file, not just the project preview.</p>';
    const formatPill = document.createElement('span');
    formatPill.className = 'editor-audio-format-pill';
    formatPill.textContent = format === 'wav' ? 'WAV · RIFF + ID3' : 'MP3 · ID3v2.4';
    header.append(heading, formatPill);

    const layout = document.createElement('div');
    layout.className = 'editor-audio-editor-layout';
    const form = document.createElement('form');
    form.className = 'editor-audio-fields';
    // The Save button lives in the footer, outside this form. Associate it
    // explicitly so clicking it (and implicit Enter submission) fires submit.
    form.id = 'editor-audio-fields-' + (++tagFormSequence);
    const inputs = {};

    for (const [key, label, type] of FIELDS) {
      const field = document.createElement('label');
      field.className = 'editor-audio-field';
      const caption = document.createElement('span');
      caption.textContent = label;
      let input;
      if (type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = type;
        if (key === 'year') input.placeholder = 'e.g. 2025';
        if (key === 'track') input.placeholder = 'e.g. 3 or 3/12';
        if (key === 'disc') input.placeholder = 'e.g. 1';
        if (key === 'lyrics') input.rows = 7;
      }
      input.name = key;
      input.value = parsed.tags?.[key] || '';
      inputs[key] = input;
      field.append(caption, input);
      form.appendChild(field);
    }

    const coverPanel = document.createElement('aside');
    coverPanel.className = 'editor-audio-cover-panel';
    const coverLabel = document.createElement('div');
    coverLabel.className = 'editor-audio-cover-label';
    coverLabel.textContent = 'ALBUM COVER';
    const coverFrame = document.createElement('div');
    coverFrame.className = 'editor-audio-cover-frame';
    let cover = parsed.picture ? { ...parsed.picture, data: new Uint8Array(parsed.picture.data) } : null;
    let coverObjectURL = null;
    let replaceCover = false;
    const renderCover = () => {
      coverFrame.innerHTML = '';
      if (coverObjectURL) URL.revokeObjectURL(coverObjectURL);
      coverObjectURL = null;
      if (cover?.data?.length) {
        coverObjectURL = URL.createObjectURL(new Blob([cover.data], { type: cover.mime || 'image/jpeg' }));
        const image = document.createElement('img');
        image.src = coverObjectURL;
        image.alt = 'Selected album cover';
        coverFrame.appendChild(image);
      } else {
        const empty = document.createElement('div');
        empty.className = 'editor-audio-cover-empty';
        empty.textContent = '♫';
        coverFrame.appendChild(empty);
      }
    };
    const dropHint = document.createElement('div');
    dropHint.className = 'editor-audio-cover-drop-hint';
    dropHint.textContent = 'Drop an image here from your computer, browser downloads, or an editor file tree';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'editor-audio-cover-input';
    fileInput.multiple = true;
    coverFrame.setAttribute('role', 'button');
    coverFrame.setAttribute('tabindex', '0');
    coverFrame.setAttribute('aria-label', 'Choose album cover image');
    coverFrame.title = 'Click or drop an image to set the album cover';
    coverFrame.addEventListener('click', () => fileInput.click());
    coverFrame.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      fileInput.click();
    });

    const convertCoverToPng = async (file, bytes, sourceMime) => {
      const source = new Blob([bytes], { type: sourceMime });
      let bitmap = null;
      let image = null;
      let objectURL = null;
      try {
        if (typeof createImageBitmap === 'function') {
          try { bitmap = await createImageBitmap(source); } catch (_) {}
        }
        if (!bitmap) {
          objectURL = URL.createObjectURL(source);
          image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('The browser could not decode this image format.'));
            image.src = objectURL;
          });
        }
        const width = bitmap?.width || image?.naturalWidth || image?.width || 0;
        const height = bitmap?.height || image?.naturalHeight || image?.height || 0;
        if (!width || !height || width * height > 100000000) {
          throw new Error('This image has invalid or excessively large dimensions.');
        }
        const scale = Math.min(1, 1600 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('The browser could not prepare this image for album artwork.');
        context.drawImage(bitmap || image, 0, 0, canvas.width, canvas.height);
        const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!png) throw new Error('The browser could not convert this image to PNG.');
        return new Uint8Array(await png.arrayBuffer());
      } finally {
        try { bitmap?.close?.(); } catch (_) {}
        if (objectURL) URL.revokeObjectURL(objectURL);
      }
    };

    const setCoverFromFile = async file => {
      if (!file || typeof file.arrayBuffer !== 'function') return false;
      if (file.size > 10 * 1024 * 1024) {
        status.textContent = 'Album artwork must be 10 MB or smaller.';
        return false;
      }
      try {
        let bytes = new Uint8Array(await file.arrayBuffer());
        let mime = window.EditorAudioTags.readImageMime(bytes);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
          const sourceMime = mime.startsWith('image/') ? mime : String(file.type || '').toLowerCase();
          if (!sourceMime.startsWith('image/')) {
            status.textContent = 'That file does not appear to be an image.';
            return false;
          }
          bytes = await convertCoverToPng(file, bytes, sourceMime);
          mime = 'image/png';
        }
        cover = { mime, data: bytes, description: 'Cover' };
        replaceCover = true;
        removeCover.disabled = false;
        renderCover();
        status.textContent = 'Cover selected: ' + (file.name || 'image');
        return true;
      } catch (error) {
        status.textContent = error?.message || 'Could not read that image file.';
        return false;
      }
    };

    const collectDroppedFiles = async transfer => {
      const token = transfer.getData('application/x-wk-editor-files');
      const browserToken = transfer.getData('application/x-proxy-download');
      const tokenToRead = token || browserToken;
      if (tokenToRead) {
        const payload = await window.__editorFileDropBridge?.take?.(tokenToRead);
        const files = (Array.isArray(payload) ? payload : [payload]).filter(file =>
          file && typeof file.name === 'string' && typeof file.arrayBuffer === 'function'
        );
        if (files.length) return files;
      }

      const files = Array.from(transfer.files || []);
      if (files.length) return files;
      const itemFiles = Array.from(transfer.items || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile?.())
        .filter(Boolean);
      if (itemFiles.length) return itemFiles;

      // Some editor tree drags expose paths as a secondary fallback. Prefer
      // the shared file bridge above because it works across isolated trees.
      const rawPaths = transfer.getData('application/x-file-manager-paths');
      if (rawPaths && ctx.state?.fs?.readFileSync) {
        try {
          const paths = JSON.parse(rawPaths);
          if (Array.isArray(paths)) {
            return paths.map(path => {
              const name = String(path).split('/').pop();
              const data = ctx.state.fs.readFileSync(path, 'binary');
              return data == null ? null : new File([data], name, {
                type: window.EditorInferMime?.(name) || 'application/octet-stream'
              });
            }).filter(Boolean);
          }
        } catch (_) {}
      }
      return [];
    };

    const handleCoverDrop = async event => {
      event.preventDefault();
      event.stopPropagation();
      coverPanel.classList.remove('is-dragover');
      try {
        const files = await collectDroppedFiles(event.dataTransfer);
        if (!files.length) {
          status.textContent = 'Drop an image file here to use it as the album cover.';
          return;
        }
        const image = files.find(file =>
          /\.(png|jpe?g|webp|gif)$/i.test(file.name || '') ||
          /^image\//i.test(file.type || '')
        ) || files[0];
        await setCoverFromFile(image);
      } catch (error) {
        status.textContent = error?.message || 'Could not import the dropped image.';
      }
    };

    coverPanel.addEventListener('dragenter', event => {
      event.preventDefault();
      event.stopPropagation();
      coverPanel.classList.add('is-dragover');
    });
    coverPanel.addEventListener('dragover', event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      coverPanel.classList.add('is-dragover');
    });
    coverPanel.addEventListener('dragleave', event => {
      if (event.relatedTarget && coverPanel.contains(event.relatedTarget)) return;
      coverPanel.classList.remove('is-dragover');
    });
    coverPanel.addEventListener('drop', handleCoverDrop);
    const chooseCover = document.createElement('button');
    chooseCover.type = 'button';
    chooseCover.className = 'editor-audio-secondary-button';
    chooseCover.textContent = 'Choose image…';
    chooseCover.addEventListener('click', () => fileInput.click());
    const removeCover = document.createElement('button');
    removeCover.type = 'button';
    removeCover.className = 'editor-audio-secondary-button';
    removeCover.textContent = 'Remove cover';
    removeCover.disabled = !cover;
    removeCover.addEventListener('click', () => {
      cover = null;
      replaceCover = true;
      removeCover.disabled = true;
      renderCover();
    });
    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = '';
      const image = files.find(file => /\\.(png|jpe?g|webp|gif)$/i.test(file.name || '')) || files[0];
      if (image) await setCoverFromFile(image);
    });
    coverPanel.append(coverLabel, coverFrame, fileInput, chooseCover, removeCover, dropHint);
    layout.append(form, coverPanel);

    const footer = document.createElement('div');
    footer.className = 'editor-audio-editor-footer';
    const status = document.createElement('span');
    status.className = 'editor-audio-editor-status';
    status.textContent = format === 'wav'
      ? 'WAV tags use an embedded ID3 chunk and RIFF INFO labels; support varies by player.'
      : 'Tags are saved as ID3v2.4 with UTF-8 text and embedded cover artwork.';
    const save = document.createElement('button');
    save.type = 'submit';
    save.setAttribute('form', form.id);
    save.className = 'editor-audio-save-button';
    save.textContent = 'Save tags';
    footer.append(status, save);

    const refreshFromFile = event => {
      if (event?.detail?.path !== ctx.file.path || event?.detail?.source === 'audio-tags') return;
      try {
        parsed = window.EditorAudioTags.read(ctx.readBinary(), format);
        for (const [key] of FIELDS) inputs[key].value = parsed.tags?.[key] || '';
        cover = parsed.picture ? { ...parsed.picture, data: new Uint8Array(parsed.picture.data) } : null;
        replaceCover = false;
        removeCover.disabled = !cover;
        renderCover();
        status.textContent = 'Reloaded saved tags from ' + ctx.file.name;
      } catch (error) {
        status.textContent = error?.message || 'Could not reload saved audio tags.';
      }
    };
    window.addEventListener(FILE_SAVED_EVENT, refreshFromFile);

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (save.disabled) return;
      save.disabled = true;
      save.textContent = 'Saving…';
      try {
        const bytes = ctx.readBinary();
        const currentParsed = window.EditorAudioTags.read(bytes, format);
        const values = {};
        for (const [key] of FIELDS) values[key] = inputs[key].value.trim();
        const updated = window.EditorAudioTags.write(bytes, values, currentParsed, {
          format,
          picture: cover,
          replacePicture: true
        });
        ctx.writeBinary(updated, ctx.file.path);
        ctx.markDirty(ctx.file.path);
        parsed = window.EditorAudioTags.read(updated, format);
        replaceCover = false;
        window.dispatchEvent(new CustomEvent(FILE_SAVED_EVENT, { detail: { path: ctx.file.path, source: 'audio-tags' } }));
        status.textContent = 'Saved into ' + ctx.file.name;
        save.textContent = 'Saved';
      } catch (error) {
        status.textContent = error?.message || 'Could not save audio tags.';
        save.textContent = 'Save tags';
      } finally {
        save.disabled = false;
      }
    });

    root.append(header, layout, footer);
    ctx.host.appendChild(root);
    renderCover();
    ctx.addCleanup(() => {
      window.removeEventListener(FILE_SAVED_EVENT, refreshFromFile);
      if (coverObjectURL) URL.revokeObjectURL(coverObjectURL);
    });
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'audio',
    match(file) {
      return String(file.mime || '').toLowerCase().startsWith('audio/') ||
        AUDIO_EXTENSION.test(String(file.name || file.path || ''));
    },
    views: [
      {
        id: 'audio-player',
        label: 'Player',
        default: true,
        priority: 150,
        create: makePlayer
      },
      {
        id: 'audio-tags',
        label: 'Edit Tags',
        priority: 100,
        match: isTaggable,
        create: makeTagEditor
      },
      {
        id: 'audio-raw',
        label: 'Raw',
        priority: 80,
        create: makeRawPlayer
      }
    ]
  });
})();