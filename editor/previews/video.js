(function () {
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours
      ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
      : minutes + ':' + String(secs).padStart(2, '0');
  }

  function icon(path, filled = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', filled ? 'currentColor' : 'none');
    svg.setAttribute('stroke', filled ? 'none' : 'currentColor');
    if (!filled) {
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', path);
    svg.appendChild(pathElement);
    return svg;
  }

  const ICONS = {
    play: 'M8 5v14l11-7z',
    pause: 'M7 5h4v14H7z M15 5h4v14h-4z',
    volume: 'M11 5 6 9H3v6h3l5 4z M15 9a5 5 0 0 1 0 6 M18 6a9 9 0 0 1 0 12',
    muted: 'M11 5 6 9H3v6h3l5 4z M16 9l5 6 M21 9l-5 6',
    fullscreen: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M3 16v5h5',
    pip: 'M3 5h18v14H3z M12 12h7v5h-7z',
    loop: 'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3'
  };

  function button(label, path, className) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className || 'editor-video-button';
    element.title = label;
    element.setAttribute('aria-label', label);
    element.appendChild(icon(path));
    return element;
  }

  function makePlayer(ctx) {
    const root = document.createElement('section');
    root.className = 'editor-video-player';

    const heading = document.createElement('header');
    heading.className = 'editor-video-heading';
    const title = document.createElement('div');
    title.className = 'editor-video-title';
    title.textContent = ctx.file.name || 'Video';
    const format = document.createElement('span');
    format.className = 'editor-video-format';
    format.textContent = String(ctx.file.mime || 'VIDEO').replace(/^video\//i, '').toUpperCase() + ' VIDEO';
    heading.append(title, format);

    const stage = document.createElement('div');
    stage.className = 'editor-video-stage';
    const video = document.createElement('video');
    video.className = 'editor-video-element';
    video.preload = 'metadata';
    video.playsInline = true;
    video.src = ctx.getURL();
    video.setAttribute('aria-label', ctx.file.name || 'Video playback');
    stage.appendChild(video);

    const overlay = document.createElement('div');
    overlay.className = 'editor-video-overlay';
    const overlayPlay = button('Play', ICONS.play, 'editor-video-overlay-play');
    overlay.appendChild(overlayPlay);
    stage.appendChild(overlay);

    const controls = document.createElement('div');
    controls.className = 'editor-video-controls';
    const top = document.createElement('div');
    top.className = 'editor-video-seek-row';
    const current = document.createElement('span');
    current.className = 'editor-video-time';
    current.textContent = '0:00';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.max = '1000';
    progress.step = '1';
    progress.value = '0';
    progress.className = 'editor-video-progress';
    progress.setAttribute('aria-label', 'Playback position');
    const duration = document.createElement('span');
    duration.className = 'editor-video-time';
    duration.textContent = '0:00';
    top.append(current, progress, duration);

    const bottom = document.createElement('div');
    bottom.className = 'editor-video-control-row';
    const play = button('Play', ICONS.play, 'editor-video-play');
    const mute = button('Mute', ICONS.volume);
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.01';
    volume.value = '1';
    volume.className = 'editor-video-volume';
    volume.setAttribute('aria-label', 'Volume');
    const speed = document.createElement('select');
    speed.className = 'editor-video-speed';
    speed.setAttribute('aria-label', 'Playback speed');
    speed.title = 'Playback speed';
    for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      const option = document.createElement('option');
      option.value = String(rate);
      option.textContent = (rate === 1 ? '1' : String(rate)) + '×';
      speed.appendChild(option);
    }
    const loop = button('Loop off', ICONS.loop);
    const pip = button('Picture in picture', ICONS.pip);
    const fullscreen = button('Fullscreen', ICONS.fullscreen);
    bottom.append(play, mute, volume, speed, loop, pip, fullscreen);
    controls.append(top, bottom);

    const footer = document.createElement('footer');
    footer.className = 'editor-video-footer';
    const filename = document.createElement('span');
    filename.className = 'editor-video-filename';
    filename.textContent = ctx.file.name || '';
    const status = document.createElement('span');
    status.className = 'editor-video-status';
    status.textContent = 'Ready to play';
    footer.append(filename, status);

    root.append(heading, stage, controls, footer);
    ctx.host.appendChild(root);

    let dragging = false;
    let disposed = false;

    const updateRange = input => {
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const value = Math.min(max, Math.max(min, Number(input.value || 0)));
      const percent = max > min ? (value - min) / (max - min) * 100 : 0;
      input.style.background = 'linear-gradient(to right,var(--editor-accent) 0%,var(--editor-accent) ' + percent + '%,#ffffff35 ' + percent + '%,#ffffff35 100%)';
    };

    const updatePlay = () => {
      const path = video.paused ? ICONS.play : ICONS.pause;
      for (const control of [play, overlayPlay]) {
        control.replaceChildren(icon(path, true));
        const label = video.paused ? 'Play' : 'Pause';
        control.title = label;
        control.setAttribute('aria-label', label);
      }
      overlay.classList.toggle('is-visible', video.paused);
      root.classList.toggle('is-playing', !video.paused);
    };

    const updateVolume = () => {
      const muted = video.muted || video.volume === 0;
      mute.replaceChildren(icon(muted ? ICONS.muted : ICONS.volume));
      mute.title = muted ? 'Unmute' : 'Mute';
      mute.setAttribute('aria-label', mute.title);
      volume.value = muted ? '0' : String(video.volume);
      updateRange(volume);
    };

    const updateTime = () => {
      current.textContent = formatTime(video.currentTime);
      duration.textContent = formatTime(video.duration);
      if (!dragging) progress.value = String(video.duration ? Math.round(video.currentTime / video.duration * 1000) : 0);
      updateRange(progress);
    };

    const togglePlay = () => {
      if (video.paused) video.play().catch(error => {
        status.textContent = error?.message || 'Playback could not start in this browser.';
      });
      else video.pause();
    };

    play.addEventListener('click', togglePlay);
    overlayPlay.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('play', updatePlay);
    video.addEventListener('pause', updatePlay);
    video.addEventListener('ended', updatePlay);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('durationchange', updateTime);
    video.addEventListener('loadedmetadata', () => {
      updateTime();
      const width = video.videoWidth, height = video.videoHeight;
      status.textContent = width && height ? width + ' × ' + height : 'Video loaded';
    });
    video.addEventListener('waiting', () => { status.textContent = 'Buffering…'; });
    video.addEventListener('playing', () => {
      status.textContent = video.videoWidth ? video.videoWidth + ' × ' + video.videoHeight : 'Playing';
    });
    video.addEventListener('error', () => {
      const code = video.error?.code;
      status.textContent = code === 4
        ? 'This video format or codec is not supported by the browser.'
        : 'The video could not be loaded.';
    });

    progress.addEventListener('input', () => {
      dragging = true;
      updateRange(progress);
      if (Number.isFinite(video.duration)) current.textContent = formatTime(Number(progress.value) / 1000 * video.duration);
    });
    progress.addEventListener('change', () => {
      if (Number.isFinite(video.duration)) video.currentTime = Number(progress.value) / 1000 * video.duration;
      dragging = false;
      updateTime();
    });
    mute.addEventListener('click', () => {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) video.volume = 1;
      updateVolume();
    });
    volume.addEventListener('input', () => {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
      updateVolume();
    });
    video.addEventListener('volumechange', updateVolume);
    speed.addEventListener('change', () => { video.playbackRate = Number(speed.value) || 1; });
    loop.addEventListener('click', () => {
      video.loop = !video.loop;
      loop.classList.toggle('is-active', video.loop);
      loop.title = video.loop ? 'Loop on' : 'Loop off';
      loop.setAttribute('aria-label', loop.title);
    });
    pip.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
        else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
        else status.textContent = 'Picture in picture is not supported by this browser.';
      } catch (error) {
        status.textContent = error?.message || 'Could not open picture in picture.';
      }
    });
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (stage.requestFullscreen) await stage.requestFullscreen();
        else status.textContent = 'Fullscreen is not supported by this browser.';
      } catch (error) {
        status.textContent = error?.message || 'Could not enter fullscreen.';
      }
    });

    root.addEventListener('keydown', event => {
      if (event.target.matches('input,select,button,textarea') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft' && Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (event.key === 'ArrowRight' && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(video.duration, video.currentTime + 5);
      } else if (event.key.toLowerCase() === 'm') {
        video.muted = !video.muted;
      } else if (event.key.toLowerCase() === 'f') {
        fullscreen.click();
      }
    });

    updatePlay();
    updateVolume();
    updateTime();
    ctx.addCleanup(() => {
      disposed = true;
      try { video.pause(); } catch (_) {}
      try { video.removeAttribute('src'); video.load(); } catch (_) {}
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
    });
  }

  function makeNative(ctx) {
    const wrap = document.createElement('div');
    wrap.className = 'editor-video-native';
    const video = document.createElement('video');
    video.className = 'editor-media';
    video.controls = true;
    video.preload = 'metadata';
    video.src = ctx.getURL();
    video.playsInline = true;
    wrap.appendChild(video);
    ctx.host.appendChild(wrap);
    ctx.addCleanup(() => {
      try { video.pause(); } catch (_) {}
      try { video.removeAttribute('src'); video.load(); } catch (_) {}
    });
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'video',
    match(file) { return String(file.mime || '').startsWith('video/'); },
    views: [
      {
        id: 'video-player',
        label: 'Player',
        default: true,
        priority: 150,
        create: makePlayer
      },
      {
        id: 'video-native',
        label: 'Raw',
        priority: 80,
        create: makeNative
      }
    ]
  });
})();