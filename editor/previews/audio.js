(function () {
  const TAG_EVENTS = 'editor-audio-tags-changed';
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
    ['comment', 'Comment', 'textarea']
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

  function makeIcon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
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
    controls.append(play, current, progress, duration, volumeButton, volume);

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
    };

    const updatePlayButton = () => {
      play.innerHTML = '';
      if (audio.paused) {
        play.appendChild(makeIcon('M8 5v14l11-7z'));
        play.setAttribute('aria-label', 'Play');
        play.title = 'Play';
      } else {
        play.appendChild(makeIcon('M8 5h3v14H8z M15 5h3v14h-3z'));
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
    });
    progress.addEventListener('input', () => { dragging = true; });
    progress.addEventListener('change', () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = Number(progress.value) / 1000 * audio.duration;
      dragging = false;
    });
    volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = audio.volume === 0; });
    volumeButton.addEventListener('click', () => {
      audio.muted = !audio.muted;
      volume.value = audio.muted ? '0' : String(audio.volume || 1);
      volumeButton.title = audio.muted ? 'Unmute' : 'Mute';
      volumeButton.setAttribute('aria-label', volumeButton.title);
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
    window.addEventListener(TAG_EVENTS, refresh);

    updateMetadata(metadata);
    updatePlayButton();
    ctx.addCleanup(() => {
      disposed = true;
      window.removeEventListener(TAG_EVENTS, refresh);
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
    ctx.addCleanup(() => {
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
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
    fileInput.className = 'editor-audio-cover-input';
    fileInput.multiple = true;

    const setCoverFromFile = async file => {
      if (!file || typeof file.arrayBuffer !== 'function') return false;
      if (file.size > 10 * 1024 * 1024) {
        status.textContent = 'Album artwork must be 10 MB or smaller.';
        return false;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mime = window.EditorAudioTags.readImageMime(bytes);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
          status.textContent = 'That file is not a supported image. Use JPEG, PNG, WebP, or GIF.';
          return false;
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
          /\\.(png|jpe?g|webp|gif)$/i.test(file.name || '') ||
          /^image\\//i.test(file.type || '')
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
    save.className = 'editor-audio-save-button';
    save.textContent = 'Save tags';
    footer.append(status, save);

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
        window.dispatchEvent(new CustomEvent(TAG_EVENTS, { detail: { path: ctx.file.path } }));
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
      if (coverObjectURL) URL.revokeObjectURL(coverObjectURL);
    });
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'audio',
    match(file) { return String(file.mime || '').startsWith('audio/'); },
    views: [
      {
        id: 'audio-player',
        label: 'Player',
        default: true,
        priority: 150,
        create: makePlayer
      },
      {
        id: 'audio-raw',
        label: 'Raw',
        priority: 90,
        create: makeRawPlayer
      },
      {
        id: 'audio-tags',
        label: 'Edit Tags',
        priority: 100,
        match: isTaggable,
        create: makeTagEditor
      }
    ]
  });
})();