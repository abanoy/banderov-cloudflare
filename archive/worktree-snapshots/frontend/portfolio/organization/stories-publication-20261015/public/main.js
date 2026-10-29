// Preserve invitations made while the game occupied the site's root URL.
const legacyInvitation = new URL(location.href);
if (legacyInvitation.pathname === '/' && legacyInvitation.searchParams.get('roomId')) {
  legacyInvitation.pathname = '/games/don-bass-idols/';
  location.replace(legacyInvitation.href);
}

// The optional compact review also works when index.html is served verbatim.
// The local preview may already supply this stylesheet, including without JS.
if (new URLSearchParams(location.search).get('layout') === 'workspace'
    && !document.getElementById('workspace-review')) {
  const layout = document.createElement('link');
  layout.id = 'workspace-review';
  layout.rel = 'stylesheet';
  layout.href = new URL('review/workspace.css', document.baseURI).href;
  layout.addEventListener('error', () => { layout.remove(); });
  document.head.append(layout);
}

// A first-party visual preference only; no tracking or network request.
const paletteToggle = document.querySelector('.palette-toggle');
const setPalette = night => {
  document.documentElement.dataset.palette = night ? 'night' : 'day';
  paletteToggle.setAttribute('aria-pressed', String(night));
  paletteToggle.querySelector('.palette-icon').textContent = night ? '☀' : '☾';
  paletteToggle.querySelector('.palette-label').textContent = night ? 'Day' : 'Night';
};
try { setPalette(localStorage.getItem('banderov-portfolio.palette') === 'night'); }
catch { setPalette(false); }
paletteToggle.hidden = false;
paletteToggle.addEventListener('click', () => {
  const night = document.documentElement.dataset.palette !== 'night';
  setPalette(night);
  try { localStorage.setItem('banderov-portfolio.palette', night ? 'night' : 'day'); }
  catch { /* The palette still works if storage is unavailable. */ }
});

// Native navigation and audio remain usable without JavaScript.
const players = [...document.querySelectorAll('audio')];
const deckStatus = document.querySelector('.deck-status');
// One session-only level for both tracks. Some devices require hardware volume;
// keep their native controls and omit this enhancement when assignment is ignored.
const supportsMusicVolume = players.every(player => {
  const original = player.volume;
  player.volume = .5;
  const supported = player.volume === .5;
  player.volume = original;
  return supported;
});
if (supportsMusicVolume) {
  const label = document.createElement('label');
  label.className = 'deck-volume';
  const name = document.createElement('span');
  name.textContent = 'Volume';
  const level = document.createElement('input');
  level.type = 'range';
  level.min = '0'; level.max = '100'; level.step = '1';
  level.value = String(players[0].volume * 100);
  level.setAttribute('aria-label', 'Music volume');
  const value = document.createElement('span');
  value.className = 'deck-volume-value';
  value.setAttribute('aria-hidden', 'true');
  const setMusicLevel = volume => {
    for (const player of players) if (player.volume !== volume) player.volume = volume;
    level.value = String(Math.round(volume * 100));
    level.setAttribute('aria-valuetext', Math.round(volume * 100) + '% volume');
    value.textContent = Math.round(volume * 100) + '%';
  };
  level.addEventListener('input', () => setMusicLevel(Number(level.value) / 100));
  for (const player of players) player.addEventListener('volumechange', () => {
    // Native volume changes share the deck level; each native mute stays independent.
    if (Number(level.value) !== Math.round(player.volume * 100)) setMusicLevel(player.volume);
  });
  setMusicLevel(players[0].volume);
  label.append(name, level, value);
  document.querySelector('.deck-heading').after(label);
}
const musicNavigation = document.querySelector('.header nav a[href="#music"]');
const soundtrackCover = document.querySelector('.soundtrack-cover img');
const hideFailedSoundtrackCover = () => { soundtrackCover.hidden = true; };
soundtrackCover.addEventListener('error', hideFailedSoundtrackCover);
soundtrackCover.addEventListener('load', () => { soundtrackCover.hidden = false; });
if (soundtrackCover.complete && soundtrackCover.naturalWidth === 0) hideFailedSoundtrackCover();
const musicActivity = document.createElement('span');
musicActivity.className = 'music-activity';
musicActivity.textContent = '♪';
musicActivity.setAttribute('aria-hidden', 'true');
musicActivity.hidden = true;
musicNavigation.append(musicActivity);
const setPlaybackCue = (player, playing) => {
  player.closest('.track').classList.toggle('is-playing', playing);
  const active = players.find(item => item.closest('.track').classList.contains('is-playing'));
  musicNavigation.classList.toggle('is-playing', Boolean(active));
  musicActivity.hidden = !active;
  deckStatus.textContent = active
    ? 'Playing / ' + active.closest('.track').querySelector('h3').textContent.trim()
    : 'Selected tracks';
};
for (const player of players) {
  const message = player.closest('.track').querySelector('.audio-error');
  const sources = [...player.querySelectorAll('source')];
  const failedSources = new Set();
  // Enhance the original amplitude drawing without loading audio before Play.
  const waveform = player.closest('.track').querySelector('.track-waveform');
  const timeline = document.createElement('div');
  timeline.className = 'track-timeline';
  waveform.before(timeline);
  timeline.append(waveform);
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'waveform-seek';
  seek.min = '0'; seek.max = '1'; seek.step = '0.1'; seek.value = '0';
  seek.disabled = true;
  seek.setAttribute('aria-label', 'Seek in ' + player.closest('.track').querySelector('h3').textContent.trim());
  timeline.append(seek);
  const seekPreview = document.createElement('span');
  seekPreview.className = 'seek-preview';
  seekPreview.setAttribute('aria-hidden', 'true');
  seekPreview.hidden = true;
  timeline.append(seekPreview);
  const waveformPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const waveformContrast = matchMedia('(forced-colors: active)');
  let previewFrame, previewX, previewDismissed = false;
  const hideSeekPreview = () => {
    if (previewFrame !== undefined) cancelAnimationFrame(previewFrame);
    previewFrame = undefined;
    seekPreview.hidden = true;
    timeline.classList.remove('previewing');
  };
  const readout = document.createElement('div');
  readout.className = 'timeline-readout';
  const elapsed = document.createElement('span');
  const hint = document.createElement('span');
  hint.id = 'waveform-help-' + players.indexOf(player);
  hint.textContent = 'Play to explore the waveform';
  seek.setAttribute('aria-describedby', hint.id);
  readout.append(elapsed, hint);
  timeline.after(readout);
  const repeatLabel = document.createElement('label');
  repeatLabel.className = 'track-repeat';
  const repeat = document.createElement('input');
  repeat.type = 'checkbox';
  repeat.setAttribute('aria-label', 'Repeat ' + player.closest('.track').querySelector('h3').textContent.trim());
  repeat.checked = player.loop;
  repeat.addEventListener('change', () => { player.loop = repeat.checked; });
  repeatLabel.append(repeat, document.createTextNode('Repeat track'));
  const tools = document.createElement('div');
  tools.className = 'track-tools';
  const fileLink = player.closest('.track').querySelector('.audio-fallback');
  fileLink.before(tools);
  tools.append(repeatLabel, fileLink);
  const clock = seconds => {
    const whole = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  };
  const updateTimeline = () => {
    const duration = player.duration;
    const known = Number.isFinite(duration) && duration > 0;
    const ready = known && player.seekable.length > 0 && !player.error && message.hidden;
    seek.disabled = !ready;
    if (!ready) hideSeekPreview();
    seek.max = String(known ? duration : 1);
    seek.value = String(known ? Math.min(duration, player.currentTime) : 0);
    seek.setAttribute('aria-valuetext', clock(player.currentTime) + ' of ' + (known ? clock(duration) : 'unloaded track'));
    timeline.style.setProperty('--track-progress', (known ? player.currentTime / duration * 100 : 0) + '%');
    elapsed.textContent = clock(player.currentTime) + ' / ' + (known ? clock(duration) : player.closest('.track').querySelector('.track-duration').textContent);
    hint.textContent = ready ? 'Drag waveform · Arrow keys to seek'
      : !message.hidden ? 'Audio file link below'
      : player.networkState === HTMLMediaElement.NETWORK_LOADING ? 'Loading track…'
      : 'Play to explore the waveform';
  };
  const seekTarget = desired => {
    // Clamp to actual loaded seekable ranges, including a possible gap.
    let target = player.seekable.start(0), distance = Infinity;
    for (let i = 0; i < player.seekable.length; i++) {
      const candidate = Math.max(player.seekable.start(i), Math.min(desired, player.seekable.end(i)));
      if (Math.abs(candidate - desired) < distance) { target = candidate; distance = Math.abs(candidate - desired); }
    }
    return target;
  };
  seek.addEventListener('input', () => {
    if (seek.disabled || !player.seekable.length) return;
    try { player.currentTime = seekTarget(Number(seek.value)); } catch { /* Native controls/file fallback remain available. */ }
    updateTimeline();
  });
  seek.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || seek.disabled || previewDismissed || !waveformPointer.matches || waveformContrast.matches) return;
    previewX = event.clientX;
    if (previewFrame !== undefined) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = undefined;
      if (seek.disabled || !player.seekable.length) return;
      const box = seek.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (previewX - box.left - 2) / Math.max(1, box.width - 4)));
      const target = seekTarget(fraction * player.duration);
      timeline.style.setProperty('--seek-preview-x', target / player.duration * 100 + '%');
      seekPreview.textContent = clock(target);
      seekPreview.hidden = false;
      timeline.classList.add('previewing');
    });
  });
  seek.addEventListener('pointerleave', () => { hideSeekPreview(); previewDismissed = false; });
  seek.addEventListener('pointercancel', hideSeekPreview);
  seek.addEventListener('blur', hideSeekPreview);
  seek.addEventListener('keydown', event => { if (event.key !== 'Escape') hideSeekPreview(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !seekPreview.hidden) { hideSeekPreview(); previewDismissed = true; }
  });
  waveformPointer.addEventListener('change', hideSeekPreview);
  waveformContrast.addEventListener('change', hideSeekPreview);
  for (const event of ['loadstart', 'waiting', 'loadedmetadata', 'suspend', 'timeupdate', 'durationchange', 'loadeddata', 'progress', 'seeked', 'emptied', 'ended']) player.addEventListener(event, updateTimeline);
  updateTimeline();
  const showAudioError = () => {
    message.hidden = false;
    setPlaybackCue(player, false);
    updateTimeline();
  };
  player.addEventListener('error', showAudioError);
  // A <source> error does not bubble; exhausted fallbacks may leave play pending.
  for (const source of sources) source.addEventListener('error', () => {
    failedSources.add(source);
    if (failedSources.size === sources.length) showAudioError();
  });
  player.addEventListener('loadeddata', () => { message.hidden = true; failedSources.clear(); updateTimeline(); });
  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
  });
  player.addEventListener('playing', () => setPlaybackCue(player, true));
  for (const event of ['pause', 'ended', 'waiting']) {
    player.addEventListener(event, () => setPlaybackCue(player, false));
  }
}

// Decorative drawer previews must not leave broken frames beside usable links.
for (const preview of document.querySelectorAll('.project-drawer nav img')) {
  const updatePreview = () => {
    const failed = preview.complete && preview.naturalWidth === 0;
    preview.hidden = failed;
    preview.closest('a').classList.toggle('drawer-preview-unavailable', failed);
  };
  preview.addEventListener('load', updatePreview);
  preview.addEventListener('error', updatePreview);
  if (preview.complete) updatePreview();
}

// Progressive enhancement: both showcases remain readable without JS.
const tablist = document.querySelector('.feature-tabs');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const selectTab = tab => {
  const activated = !tablist.hidden && tab.getAttribute('aria-selected') !== 'true';
  for (const other of tabs) {
    const selected = tab === other;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(other.getAttribute('aria-controls'));
    panel.hidden = !selected;
    panel.classList.toggle('window-activated', selected && activated);
  }
};
for (const tab of tabs) {
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tab.id);
  panel.tabIndex = 0;
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let index = tabs.indexOf(tab);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[index]);
    tabs[index].focus();
  });
}
selectTab(tabs[0]);
tablist.hidden = false;

// Fragment links reveal project tabs and folded connections on entry or return.
const revealLinkedProject = () => {
  if (location.hash === '#connections') {
    const connections = document.getElementById('connections');
    connections.open = true;
    connections.querySelector('summary').focus({ preventScroll: true });
    connections.scrollIntoView({ block: 'start', behavior: 'auto' });
    return;
  }
  const tab = tabs.find(item => '#' + item.getAttribute('aria-controls') === location.hash);
  if (!tab) return;
  selectTab(tab);
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ block: 'start', behavior: 'auto' });
};
window.addEventListener('hashchange', revealLinkedProject);
for (const link of document.querySelectorAll('a[href="#feature-idols"], a[href="#feature-crusaders"], a[href="#connections"]')) link.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (location.hash === link.hash) {
    event.preventDefault();
    revealLinkedProject();
  }
});

// Keep section navigation in view, with a measured offset for native anchors.
const header = document.querySelector('.header');
const sectionLinks = [...header.querySelectorAll('nav a[href^="#"]')];
let navigationFrame;
const updateNavigation = () => {
  navigationFrame = undefined;
  const height = header.getBoundingClientRect().height;
  header.classList.toggle('is-tall', height > innerHeight * .25);
  const offset = getComputedStyle(header).position === 'sticky' ? height + 24 : 24;
  document.documentElement.style.setProperty('--nav-offset', `${offset}px`);
  const positions = sectionLinks.map(link => {
    const section = document.querySelector(link.getAttribute('href'));
    return { link, section, top: section.getBoundingClientRect().top };
  });
  const eligible = positions.filter(item => item.top <= offset + 24);
  const closestTop = Math.max(...eligible.map(item => item.top));
  const closest = eligible.filter(item => Math.abs(item.top - closestTop) < 1);
  // Adjacent desktop windows can share an anchor height. Follow focus or the
  // chosen fragment within that row, instead of letting document order win.
  const linkedSection = sectionLinks.find(link => link.getAttribute('href') === location.hash);
  // A tall viewport can reach the page end before the final heading reaches
  // the anchor line. Keep the last visible section current there, while a
  // focused control in the preceding row still identifies its own section.
  const atEnd = scrollY > 0 && Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1;
  const last = positions[positions.length - 1];
  const endLink = atEnd && last?.top < innerHeight && last.section.getBoundingClientRect().bottom > offset ? last.link : undefined;
  const current = closest.find(item => item.section.contains(document.activeElement))?.link
    || endLink
    || (closest.find(item => item.link === linkedSection) || closest[0])?.link;
  for (const link of sectionLinks) {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
};
const scheduleNavigation = () => {
  if (navigationFrame === undefined) navigationFrame = requestAnimationFrame(updateNavigation);
};
window.addEventListener('scroll', scheduleNavigation, { passive: true });
window.addEventListener('resize', scheduleNavigation);
window.addEventListener('hashchange', scheduleNavigation);
document.addEventListener('focusin', scheduleNavigation);
window.addEventListener('load', scheduleNavigation);
if (typeof ResizeObserver === 'function') {
  const navigationLayout = new ResizeObserver(scheduleNavigation);
  navigationLayout.observe(header);
  navigationLayout.observe(document.querySelector('#main'));
}
updateNavigation();
revealLinkedProject();

// A failed thumbnail keeps the original-file link available without a broken frame.
for (const capture of document.querySelectorAll('.project-capture')) {
  const thumbnail = capture.querySelector('img');
  const status = capture.querySelector('.capture-status');
  if (!thumbnail || !status) continue;
  const failureMessage = capture.closest('.hop-helper-card')
    ? 'Preview unavailable. Choose the same view to retry, or open the full image.'
    : 'Preview unavailable. Open the full image to try again.';
  const updateThumbnail = () => {
    const failed = thumbnail.complete && thumbnail.naturalWidth === 0;
    thumbnail.hidden = failed;
    status.textContent = failed ? failureMessage : '';
    status.hidden = !failed;
  };
  thumbnail.addEventListener('load', updateThumbnail);
  thumbnail.addEventListener('error', updateThumbnail);
  if (thumbnail.complete) updateThumbnail();
}

const hopCapture = document.querySelector('.hop-helper-card .project-capture');
const hopControls = hopCapture.querySelector('.hop-image-controls');
const hopImage = hopCapture.querySelector('img');
const hopLink = hopCapture.querySelector('a');
const hopCaption = hopCapture.querySelector('figcaption');
const hopCover = { src: hopImage.getAttribute('src'), alt: hopImage.alt, href: hopLink.getAttribute('href'), caption: hopCaption.textContent, label: hopLink.getAttribute('aria-label'), prompt: 'View cover art' };
const hopGameplay = { src: 'assets/hop-hop-helper-opening.webp', alt: 'Local Hop Hop Helper opening level: a bunny beside grassy platforms and coins, with Pip giving movement instructions.', href: 'assets/hop-hop-helper-opening.png', caption: 'Archived gameplay capture.', label: 'View full Hop Hop Helper local gameplay capture', prompt: 'View local gameplay' };
let hopSelection = 'cover';
const hopLoadingStatus = hopCapture.querySelector('.capture-status');
const finishHopPreview = () => { hopImage.style.visibility = ''; };
hopImage.addEventListener('load', finishHopPreview);
hopImage.addEventListener('error', finishHopPreview);
for (const button of hopControls.querySelectorAll('button')) button.addEventListener('click', () => {
  const failedPreview = hopImage.complete && hopImage.naturalWidth === 0;
  if (button.dataset.hopImage === hopSelection && !failedPreview) return;
  hopSelection = button.dataset.hopImage;
  const selected = hopSelection === 'gameplay' ? hopGameplay : hopCover;
  hopImage.hidden = false;
  hopImage.style.visibility = 'hidden';
  hopLoadingStatus.textContent = 'Loading preview…';
  hopLoadingStatus.hidden = false;
  hopImage.src = selected.src;
  hopImage.alt = selected.alt;
  hopLink.href = selected.href;
  hopLink.setAttribute('aria-label', selected.label);
  hopLink.querySelector('.capture-prompt').firstChild.textContent = selected.prompt + ' ';
  hopCaption.textContent = selected.caption;
  for (const choice of hopControls.querySelectorAll('button')) choice.setAttribute('aria-pressed', String(choice === button));
});
// The selector provides this path when enhanced; retain the native link without JS.
hopCapture.querySelector('.capture-alternative').hidden = true;
hopControls.hidden = false;

const visualButtons = [...document.querySelectorAll('[data-image]')];
const visual = document.getElementById('idols-visual');
const visualStatus = document.querySelector('.game-image-status');
const visualReady = () => {
  visual.style.visibility = '';
  visual.setAttribute('aria-busy', 'false');
  visualStatus.textContent = '';
};
const visualFailed = () => {
  visual.style.visibility = 'hidden';
  visual.setAttribute('aria-busy', 'false');
  visualStatus.textContent = 'Image could not load. Open the game screenshot below.';
};
visual.addEventListener('load', visualReady);
visual.addEventListener('error', visualFailed);
if (visual.complete && visual.naturalWidth === 0) visualFailed();
for (const button of visualButtons) button.addEventListener('click', () => {
  const screenshot = button.dataset.image === 'screen';
  visual.style.visibility = 'hidden';
  visual.setAttribute('aria-busy', 'true');
  visualStatus.textContent = 'Loading game image…';
  visual.srcset = screenshot
    ? 'assets/don-bass-screen-640.webp 640w, assets/don-bass-screen-960.webp 960w, assets/don-bass-screen.webp 1280w'
    : 'assets/don-bass-cover-640.webp 640w, assets/don-bass-cover-960.webp 960w, assets/don-bass-cover.webp 1920w';
  visual.src = screenshot ? 'assets/don-bass-screen.webp' : 'assets/don-bass-cover.webp';
  visual.alt = screenshot
    ? 'Actual local Don Bass Idols title screen with one-player, two-player, music creation, and settings options.'
    : 'Don Bass Idols cover: a cheerful chibi and her shadow beside a glowing rhythm pad grid.';
  visual.width = screenshot ? 1280 : 1920;
  visual.height = screenshot ? 800 : 1080;
  for (const other of visualButtons) other.setAttribute('aria-pressed', String(other === button));
});
document.querySelector('.visual-controls').hidden = false;

// Game captures use their own native window; artwork browsing stays separate.
const captureDialog = document.querySelector('.capture-dialog');
if (typeof captureDialog.showModal === 'function') {
  const captureStage = captureDialog.querySelector('.capture-stage');
  const captureStatus = captureDialog.querySelector('.capture-image-status');
  const captureViews = captureDialog.querySelector('.capture-views');
  const captureDetail = captureDialog.querySelector('.capture-detail-toggle');
  const captureDetailHelp = captureDialog.querySelector('#capture-detail-help');
  const captureMouse = matchMedia('(hover: hover) and (pointer: fine)');
  let capturePointerType;
  const updateCaptureHelp = () => {
    const enabled = captureStage.classList.contains('is-detail');
    captureDetailHelp.hidden = !enabled && !captureMouse.matches;
    captureDetailHelp.textContent = enabled
      ? 'Scroll or use arrow keys to inspect. Choose Fit image to see the whole picture.' + (captureMouse.matches ? ' Double-click to fit.' : '')
      : 'Double-click the image to inspect a spot, or choose Inspect details.';
  };
  captureMouse.addEventListener('change', updateCaptureHelp);
  const setCaptureDetails = enabled => {
    captureStage.classList.toggle('is-detail', enabled);
    captureStage.tabIndex = enabled ? 0 : -1;
    captureStage.scrollTo(0, 0);
    captureDetail.setAttribute('aria-pressed', String(enabled));
    captureDetail.textContent = enabled ? 'Fit image' : 'Inspect details';
    updateCaptureHelp();
  };
  captureDetail.addEventListener('click', () => {
    const enabled = captureDetail.getAttribute('aria-pressed') !== 'true';
    setCaptureDetails(enabled);
    if (enabled) captureStage.focus();
  });
  captureStage.addEventListener('pointerdown', event => { capturePointerType = event.pointerType; });
  captureStage.addEventListener('dblclick', event => {
    const image = captureStage.querySelector('img');
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || capturePointerType !== 'mouse' || !captureMouse.matches || captureDetail.disabled
        || !image || image.hidden || event.target !== image) return;
    const box = image.getBoundingClientRect();
    const viewport = captureStage.getBoundingClientRect();
    if (event.clientX < viewport.left + captureStage.clientLeft
        || event.clientX >= viewport.left + captureStage.clientLeft + captureStage.clientWidth
        || event.clientY < viewport.top + captureStage.clientTop
        || event.clientY >= viewport.top + captureStage.clientTop + captureStage.clientHeight) return;
    event.preventDefault();
    if (captureStage.classList.contains('is-detail')) {
      setCaptureDetails(false);
      captureDetail.focus({ preventScroll: true });
      return;
    }
    const x = (event.clientX - box.left) / box.width * image.naturalWidth;
    const y = (event.clientY - box.top) / box.height * image.naturalHeight;
    setCaptureDetails(true);
    captureStage.focus({ preventScroll: true });
    captureStage.scrollLeft = x - captureStage.clientWidth / 2;
    captureStage.scrollTop = y - captureStage.clientHeight / 2;
  });
  let captureOpener;
  const showCapture = (link, alternate) => {
      setCaptureDetails(false);
      captureDetail.disabled = true;
      captureOpener = link;
      const idols = link.hasAttribute('data-game-capture');
      captureViews.hidden = !(idols || link.closest('.hop-helper-card'));
      captureViews.setAttribute('aria-label', idols ? 'Don Bass Idols image selection' : 'Hop Hop Helper image selection');
      const secondView = captureViews.querySelectorAll('button')[1];
      secondView.dataset.captureView = idols ? 'screen' : 'gameplay';
      secondView.textContent = idols ? 'Local title screen' : 'Local gameplay';
      const selection = idols ? (alternate ? 'cover' : 'screen') : hopSelection;
      for (const button of captureViews.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.captureView === selection));
      }
      const source = alternate?.src || link.href;
      const figure = link.closest('figure');
      const image = document.createElement('img');
      image.alt = alternate?.alt || link.dataset.captureAlt || link.querySelector('img').alt;
      image.hidden = true;
      captureStage.replaceChildren(image);
      captureStage.setAttribute('aria-busy', 'true');
      captureStatus.textContent = 'Loading image…';
      captureDialog.querySelector('#capture-title').textContent = alternate?.title || link.dataset.captureTitle || link.closest('.project-card').querySelector('h3').textContent + ' / Image';
      captureDialog.querySelector('#capture-caption').textContent = alternate?.caption || link.dataset.captureCaption || figure.querySelector('figcaption').textContent;
      captureDialog.querySelector('.capture-original').href = source;
      const isCurrent = () => captureDialog.open && captureStage.firstElementChild === image;
      image.addEventListener('load', () => {
        if (!isCurrent()) return;
        image.hidden = false;
        captureDetail.disabled = false;
        captureStage.setAttribute('aria-busy', 'false');
        captureStatus.textContent = '';
      });
      image.addEventListener('error', () => {
        if (!isCurrent()) return;
        captureStage.setAttribute('aria-busy', 'false');
        captureStatus.textContent = !captureViews.hidden
          ? 'Image unavailable. Choose the same view to retry, or open the original file.'
          : 'Image unavailable. Open the original file to try again.';
      });
      if (!captureDialog.open) captureDialog.showModal();
      document.body.classList.add('dialog-open');
      image.src = source;
  };
  for (const link of document.querySelectorAll('.project-capture a,[data-game-capture]')) {
    if (!link.querySelector('img') && !(link.dataset.captureAlt && link.dataset.captureTitle && link.dataset.captureCaption)) continue;
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showCapture(link);
    });
  }
  for (const button of captureViews.querySelectorAll('button')) button.addEventListener('click', () => {
    if (!captureOpener) return;
    const image = captureStage.querySelector('img');
    const failed = image?.complete && image.naturalWidth === 0;
    if (button.getAttribute('aria-pressed') === 'true' && !failed) return;
    if (captureOpener.hasAttribute('data-game-capture')) {
      showCapture(captureOpener, button.dataset.captureView === 'cover' ? {
        src: 'assets/don-bass-cover.png',
        title: 'Don Bass Idols / Cover art',
        alt: 'Don Bass Idols cover: a cheerful chibi and her shadow beside a glowing rhythm pad grid.',
        caption: 'Supplied cover artwork · Not a gameplay screenshot.'
      } : undefined);
      return;
    }
    if (!captureOpener.closest('.hop-helper-card')) return;
    document.querySelector('[data-hop-image="' + button.dataset.captureView + '"]').click();
    showCapture(captureOpener);
  });
  captureDialog.querySelector('.capture-close').addEventListener('click', () => captureDialog.close());
  let captureBackdropStart = false;
  captureDialog.addEventListener('pointerdown', event => {
    const box = captureDialog.getBoundingClientRect();
    captureBackdropStart = event.target === captureDialog
      && (event.clientX < box.left || event.clientX > box.right
          || event.clientY < box.top || event.clientY > box.bottom);
  });
  captureDialog.addEventListener('pointercancel', () => { captureBackdropStart = false; });
  captureDialog.addEventListener('click', event => {
    const startedOutside = captureBackdropStart;
    captureBackdropStart = false;
    if (!startedOutside || event.target !== captureDialog) return;
    const box = captureDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right
        || event.clientY < box.top || event.clientY > box.bottom) captureDialog.close();
  });
  captureDialog.addEventListener('focusin', event => {
    if (event.target.matches('.capture-close,.capture-original,.capture-detail-toggle,.capture-stage,[data-capture-view]')) {
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
  captureDialog.addEventListener('close', () => {
    if (captureDialog.open) return;
    captureStage.replaceChildren();
    document.body.classList.remove('dialog-open');
    captureOpener?.focus();
  });
}

// Native dialog provides Escape dismissal and a focus trap; links still work without JS.
const dialog = document.querySelector('.art-dialog');
if (typeof dialog.showModal === 'function') {
  let opener;
  const artLinks = [...document.querySelectorAll('.art-link')];
  const artworkChoices = [];
  let artworkIndex = 0;
  const stage = dialog.querySelector('.dialog-stage');
  const detailToggle = dialog.querySelector('.detail-toggle');
  const image = dialog.querySelector('.dialog-image');
  const imageStatus = dialog.querySelector('.image-status');
  const imageSize = dialog.querySelector('.art-image-size');
  // Change the mount behind the original image, without reloading or moving it.
  const canvasLabel = document.createElement('label');
  canvasLabel.className = 'canvas-label';
  canvasLabel.textContent = 'Canvas';
  const canvasSelect = document.createElement('select');
  canvasSelect.setAttribute('aria-controls', 'art-stage');
  for (const [value, name] of [['paper', 'Paper'], ['ink', 'Ink'], ['checkered', 'Checkered'], ['slate', 'Slate']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = name;
    canvasSelect.append(option);
  }
  canvasLabel.append(canvasSelect);
  dialog.querySelector('.viewer-help').before(canvasLabel);
  stage.dataset.canvas = 'paper';
  canvasSelect.addEventListener('change', () => { stage.dataset.canvas = canvasSelect.value; });
  const viewerMousePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const viewerTouchPointer = matchMedia('(pointer: coarse)');
  let viewerPointerType;
  let mousePan;
  let touchSwipe;
  const touchPointers = new Set();
  const stopTouchSwipe = () => { touchSwipe = undefined; };
  const stopMousePan = () => {
    const previous = mousePan;
    mousePan = undefined;
    stage.classList.remove('is-panning');
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
  };
  let inspection;
  const rememberInspection = () => {
    if (!dialog.open || !stage.classList.contains('is-detailed') || image.hidden) {
      inspection = undefined;
      return;
    }
    const frame = stage.getBoundingClientRect();
    const drawing = image.getBoundingClientRect();
    inspection = {
      x: frame.left + stage.clientLeft + stage.clientWidth / 2 - drawing.left,
      y: frame.top + stage.clientTop + stage.clientHeight / 2 - drawing.top,
      width: stage.clientWidth,
      height: stage.clientHeight
    };
  };
  stage.addEventListener('scroll', () => {
    // Native resize anchoring can scroll before the observer. Retain the old point
    // until the new viewport dimensions have been reconciled.
    if (!inspection || (inspection.width === stage.clientWidth && inspection.height === stage.clientHeight)) rememberInspection();
  }, { passive: true });
  if (typeof ResizeObserver === 'function') {
    const inspectionLayout = new ResizeObserver(() => {
      if (inspection && dialog.open && stage.classList.contains('is-detailed') && !image.hidden &&
          (inspection.width !== stage.clientWidth || inspection.height !== stage.clientHeight)) {
        stopMousePan();
        stopTouchSwipe();
        touchPointers.clear();
        const frame = stage.getBoundingClientRect();
        const drawing = image.getBoundingClientRect();
        stage.scrollLeft += inspection.x - (frame.left + stage.clientLeft + stage.clientWidth / 2 - drawing.left);
        stage.scrollTop += inspection.y - (frame.top + stage.clientTop + stage.clientHeight / 2 - drawing.top);
      }
      rememberInspection();
    });
    inspectionLayout.observe(stage);
  }
  stage.addEventListener('pointerdown', event => {
    viewerPointerType = event.pointerType;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !stage.classList.contains('is-detailed') || image.hidden) return;
    const box = stage.getBoundingClientRect();
    // Keep native scrollbar dragging and border clicks available.
    if (event.clientX < box.left + stage.clientLeft || event.clientX >= box.left + stage.clientLeft + stage.clientWidth || event.clientY < box.top + stage.clientTop || event.clientY >= box.top + stage.clientTop + stage.clientHeight) return;
    if (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) return;
    event.preventDefault();
    stage.focus({ preventScroll: true });
    stage.setPointerCapture(event.pointerId);
    mousePan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove', event => {
    if (!mousePan || event.pointerId !== mousePan.id) return;
    stage.scrollLeft = mousePan.left + mousePan.x - event.clientX;
    stage.scrollTop = mousePan.top + mousePan.y - event.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(event, stopMousePan);
  image.addEventListener('dragstart', event => { if (stage.classList.contains('is-detailed')) event.preventDefault(); });
  window.addEventListener('blur', stopMousePan);
  window.addEventListener('blur', () => { stopTouchSwipe(); touchPointers.clear(); });
  dialog.addEventListener('cancel', stopMousePan);
  dialog.addEventListener('cancel', stopTouchSwipe);
  image.addEventListener('load', () => {
    image.hidden = false;
    imageSize.textContent = `Image: ${image.naturalWidth} × ${image.naturalHeight} px`;
    imageSize.hidden = false;
    imageStatus.hidden = true;
    stage.setAttribute('aria-busy', 'false');
    detailToggle.disabled = false;
  });
  image.addEventListener('error', () => {
    const original = dialog.querySelector('.dialog-original').href;
    if (dialog.open && image.src !== original) {
      stopMousePan();
      stopTouchSwipe();
      image.hidden = true;
      imageSize.hidden = true;
      imageStatus.textContent = 'Loading original artwork…';
      imageStatus.hidden = false;
      stage.setAttribute('aria-busy', 'true');
      detailToggle.disabled = true;
      image.src = original;
      return;
    }
    stopMousePan();
    stopTouchSwipe();
    image.hidden = true;
    imageSize.hidden = true;
    imageStatus.textContent = 'Artwork could not load. Open the original file below.';
    imageStatus.hidden = false;
    stage.setAttribute('aria-busy', 'false');
    detailToggle.disabled = true;
    inspection = undefined;
  });
  const setDetails = enabled => {
    stopMousePan();
    stopTouchSwipe();
    stage.classList.toggle('is-detailed', enabled);
    detailToggle.setAttribute('aria-pressed', String(enabled));
    detailToggle.textContent = enabled ? 'Fit whole image' : 'Inspect details';
    const help = enabled
      ? 'Original resolution. Drag with a mouse, scroll, or focus the image and use arrow keys.'
      : (viewerTouchPointer.matches ? 'Fit view. Swipe left/right to browse, or use the buttons.' : 'Fit view. Focus the image and use Left/Right to browse.');
    if (enabled) stage.removeAttribute('aria-keyshortcuts');
    else stage.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
    const instructions = help + (viewerMousePointer.matches ? (enabled ? ' Double-click to fit.' : ' Double-click artwork to inspect a spot.') : '');
    dialog.querySelector('#detail-help').textContent = instructions;
    dialog.querySelector('.viewer-instructions').textContent = instructions;
    stage.scrollTop = stage.scrollLeft = 0;
    rememberInspection();
  };
  detailToggle.addEventListener('click', () => setDetails(!stage.classList.contains('is-detailed')));
  stage.addEventListener('dblclick', event => {
    if (event.button !== 0 || viewerPointerType !== 'mouse' || !viewerMousePointer.matches || image.hidden || detailToggle.disabled) return;
    const stageBox = stage.getBoundingClientRect();
    if (event.clientX < stageBox.left + stage.clientLeft || event.clientX >= stageBox.left + stage.clientLeft + stage.clientWidth || event.clientY < stageBox.top + stage.clientTop || event.clientY >= stageBox.top + stage.clientTop + stage.clientHeight) return;
    const box = image.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
    event.preventDefault();
    if (stage.classList.contains('is-detailed')) {
      setDetails(false);
      stage.focus({ preventScroll: true });
      return;
    }
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    if (!Number.isFinite(scale) || scale <= 0) return;
    // Exclude the fitted image's surrounding letterbox, then map to original pixels.
    const x = (event.clientX - box.left - (box.width - image.naturalWidth * scale) / 2) / scale;
    const y = (event.clientY - box.top - (box.height - image.naturalHeight * scale) / 2) / scale;
    if (x < 0 || x > image.naturalWidth || y < 0 || y > image.naturalHeight) return;
    setDetails(true);
    const full = image.getBoundingClientRect();
    const windowBox = stage.getBoundingClientRect();
    stage.scrollLeft = x + full.left - windowBox.left - stage.clientLeft - stage.clientWidth / 2;
    stage.scrollTop = y + full.top - windowBox.top - stage.clientTop - stage.clientHeight / 2;
    stage.focus({ preventScroll: true });
  });
  const showArtwork = index => {
    artworkIndex = (index + artLinks.length) % artLinks.length;
    const link = artLinks[artworkIndex];
    const sourceImage = link.querySelector('img');
    const caption = link.closest('figure').querySelector('figcaption');
    // Prefer the lossless preview, falling back to the unchanged original if unavailable.
    image.hidden = true;
    imageSize.hidden = true;
    imageStatus.textContent = 'Loading artwork…';
    imageStatus.hidden = false;
    stage.setAttribute('aria-busy', 'true');
    detailToggle.disabled = true;
    image.src = sourceImage.complete && sourceImage.naturalWidth === 0
      ? link.href : (sourceImage.currentSrc || sourceImage.src);
    image.alt = sourceImage.alt;
    dialog.querySelector('#art-dialog-title').textContent = caption.firstElementChild.textContent;
    dialog.querySelector('.dialog-caption').textContent = [...caption.children].map(node => node.textContent).join(' · ');
    dialog.querySelector('.dialog-original').href = link.href;
    dialog.querySelector('.art-position').textContent = `${artworkIndex + 1} of ${artLinks.length} · ${caption.firstElementChild.textContent}`;
    artworkChoices.forEach((button, choice) => button.setAttribute('aria-pressed', String(choice === artworkIndex)));
    setDetails(false);
  };
  const artworkPicker = document.createElement('div');
  artworkPicker.className = 'art-picker';
  artworkPicker.setAttribute('role', 'group');
  artworkPicker.setAttribute('aria-label', 'Choose artwork');
  artLinks.forEach((link, index) => {
    const preview = link.querySelector('img');
    const previewStatus = document.createElement('span');
    previewStatus.className = 'art-preview-status';
    previewStatus.id = 'art-preview-status-' + index;
    previewStatus.hidden = true;
    preview.after(previewStatus);
    const description = link.getAttribute('aria-describedby');
    const setPreviewAvailable = available => {
      link.classList.toggle('preview-unavailable', !available);
      previewStatus.hidden = available;
      previewStatus.textContent = available ? '' : 'Preview unavailable. Open artwork to load the original.';
      if (!available) link.setAttribute('aria-describedby', [description, previewStatus.id].filter(Boolean).join(' '));
      else if (description) link.setAttribute('aria-describedby', description);
      else link.removeAttribute('aria-describedby');
    };
    preview.addEventListener('error', () => setPreviewAvailable(false));
    preview.addEventListener('load', () => setPreviewAvailable(true));
    if (preview.complete) setPreviewAvailable(preview.naturalWidth > 0);
    const name = link.closest('figure').querySelector('figcaption').firstElementChild.textContent.trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    const thumbnail = document.createElement('img');
    thumbnail.className = 'art-picker-preview';
    thumbnail.alt = '';
    thumbnail.hidden = true;
    thumbnail.addEventListener('load', () => { thumbnail.hidden = false; });
    thumbnail.addEventListener('error', () => { thumbnail.hidden = true; });
    button.prepend(thumbnail);
    const fileLabel = document.createElement('span');
    fileLabel.textContent = ({ 'Maria, in full': 'Maria', 'Character sketch': 'Sketch', 'A character, every angle': 'Angles' })[name] || name;
    button.append(fileLabel);
    button.setAttribute('aria-label', 'View ' + name);
    button.title = name;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      // Selecting the current file keeps its inspected position and pending load.
      if (index !== artworkIndex) showArtwork(index);
    });
    artworkChoices.push(button);
    artworkPicker.append(button);
  });
  dialog.querySelector('.art-browse').after(artworkPicker);
  dialog.querySelector('.art-previous').addEventListener('click', () => showArtwork(artworkIndex - 1));
  dialog.querySelector('.art-next').addEventListener('click', () => showArtwork(artworkIndex + 1));
  stage.addEventListener('keydown', event => {
    // Browse only from the fitted image region; Details keeps native scrolling.
    if (event.target !== stage || stage.classList.contains('is-detailed') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    // A held key should not cycle through multiple original-image requests.
    if (!event.repeat) showArtwork(artworkIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touchPointers.add(event.pointerId);
    stopTouchSwipe();
    if (touchPointers.size !== 1 || stage.classList.contains('is-detailed')) return;
    touchSwipe = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, index: artworkIndex };
  }, { passive: true });
  stage.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch') return;
    touchPointers.delete(event.pointerId);
    const swipe = touchSwipe;
    stopTouchSwipe();
    if (!swipe || swipe.id !== event.pointerId || touchPointers.size || swipe.index !== artworkIndex || stage.classList.contains('is-detailed')) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (event.timeStamp - swipe.time > 800 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    showArtwork(artworkIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
  stage.addEventListener('pointercancel', event => {
    if (event.pointerType !== 'touch') return;
    touchPointers.delete(event.pointerId);
    stopTouchSwipe();
  }, { passive: true });
  const viewerLinks = [...artLinks, ...document.querySelectorAll('.hero-art-view,.study-art-view')];
  for (const link of viewerLinks) {
    if (artLinks.some(art => art.href === link.href)) link.setAttribute('aria-haspopup', 'dialog');
  }
  for (const link of viewerLinks) link.addEventListener('click', event => {
    const index = artLinks.findIndex(art => art.href === link.href);
    if (index < 0) return; // Preserve the original-file link if no gallery match exists.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    // Request the existing previews only when a visitor opens the viewer.
    artworkChoices.forEach((button, choice) => {
      const thumbnail = button.querySelector('.art-picker-preview');
      const preview = artLinks[choice].querySelector('img');
      if (!thumbnail.hasAttribute('src') && !(preview.complete && !preview.naturalWidth)) {
        thumbnail.src = preview.currentSrc || preview.src;
      }
    });
    showArtwork(index);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  let artBackdropStart = false;
  dialog.addEventListener('pointerdown', event => {
    const box = dialog.getBoundingClientRect();
    artBackdropStart = event.target === dialog
      && (event.clientX < box.left || event.clientX > box.right
          || event.clientY < box.top || event.clientY > box.bottom);
  });
  dialog.addEventListener('pointercancel', () => { artBackdropStart = false; });
  dialog.addEventListener('click', event => {
    const startedOutside = artBackdropStart;
    artBackdropStart = false;
    if (!startedOutside || event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    stopMousePan();
    stopTouchSwipe();
    touchPointers.clear();
    inspection = undefined;
    document.body.classList.remove('dialog-open');
    opener?.focus();
  });
}

// Decorative motion only. Leave a static backdrop without enhancements or with reduced motion.
const backgroundToggles = [...document.querySelectorAll('.background-toggle')];
const reducedBackgroundMotion = matchMedia('(prefers-reduced-motion: reduce)');
const forcedBackgroundColors = matchMedia('(forced-colors: active)');
let backgroundPaused = false;
const updateBackgroundMotion = () => {
  const available = CSS.supports('mask-image', 'linear-gradient(black, transparent)') && !reducedBackgroundMotion.matches && !forcedBackgroundColors.matches;
  // Keep focus on a nearby visible action if a live preference hides this button.
  if (!available && backgroundToggles.includes(document.activeElement)) {
    const nearbyAction = document.activeElement.closest('.intro')
      ? document.querySelector('.intro .button')
      : document.querySelector('.footer-links a[href="#top"]');
    nearbyAction.focus({ preventScroll: true });
  }
  document.body.dataset.backgroundMotion = available ? (backgroundPaused ? 'paused' : 'running') : 'static';
  for (const button of backgroundToggles) {
    button.hidden = !available;
    button.setAttribute('aria-pressed', String(backgroundPaused));
    button.textContent = backgroundPaused ? 'Resume background' : 'Pause background';
  }
};
for (const button of backgroundToggles) button.addEventListener('click', () => { backgroundPaused = !backgroundPaused; updateBackgroundMotion(); });
reducedBackgroundMotion.addEventListener('change', updateBackgroundMotion);
forcedBackgroundColors.addEventListener('change', updateBackgroundMotion);
updateBackgroundMotion();

// Pointer light stays on window chrome; original drawings never move.
const fineArtworkPointer = matchMedia('(hover: hover) and (pointer: fine)');
const artworkWindows = [...document.querySelectorAll('.art-grid > figure')];
for (const frame of artworkWindows) {
  let lightFrame, pointerX;
  const clearLight = () => {
    if (lightFrame !== undefined) cancelAnimationFrame(lightFrame);
    lightFrame = undefined;
    frame.classList.remove('pointer-lit');
    frame.style.removeProperty('--art-light-x');
  };
  const followPointer = event => {
    if (event.pointerType !== 'mouse' || !fineArtworkPointer.matches || reducedBackgroundMotion.matches || forcedBackgroundColors.matches) return;
    pointerX = event.clientX;
    if (lightFrame !== undefined) return;
    lightFrame = requestAnimationFrame(() => {
      lightFrame = undefined;
      const box = frame.getBoundingClientRect();
      frame.style.setProperty('--art-light-x', Math.max(0, Math.min(100, (pointerX - box.left) / box.width * 100)) + '%');
      frame.classList.add('pointer-lit');
    });
  };
  frame.addEventListener('pointerenter', followPointer);
  frame.addEventListener('pointermove', followPointer);
  frame.addEventListener('pointerleave', clearLight);
  frame.addEventListener('pointercancel', clearLight);
  for (const preference of [fineArtworkPointer, reducedBackgroundMotion, forcedBackgroundColors]) preference.addEventListener('change', clearLight);
}

// A decorative desktop response uses one frame per pointer update, with no idle loop.
let desktopLightFrame, desktopLightX, desktopLightY;
const clearDesktopLight = () => {
  if (desktopLightFrame !== undefined) cancelAnimationFrame(desktopLightFrame);
  desktopLightFrame = undefined;
  document.body.classList.remove('desktop-pointer-lit');
  document.body.style.removeProperty('--desktop-light-x');
  document.body.style.removeProperty('--desktop-light-y');
};
const desktopLightAvailable = () => fineArtworkPointer.matches
  && !reducedBackgroundMotion.matches && !forcedBackgroundColors.matches
  && document.body.dataset.backgroundMotion === 'running'
  && !document.body.classList.contains('dialog-open') && !document.hidden;
document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || event.buttons || !desktopLightAvailable()) {
    clearDesktopLight();
    return;
  }
  desktopLightX = event.clientX;
  desktopLightY = event.clientY;
  if (desktopLightFrame !== undefined) return;
  desktopLightFrame = requestAnimationFrame(() => {
    desktopLightFrame = undefined;
    if (!desktopLightAvailable()) { clearDesktopLight(); return; }
    document.body.style.setProperty('--desktop-light-x', Math.max(0, Math.min(innerWidth, desktopLightX)) + 'px');
    document.body.style.setProperty('--desktop-light-y', Math.max(0, Math.min(innerHeight, desktopLightY)) + 'px');
    document.body.classList.add('desktop-pointer-lit');
  });
}, { passive: true });
document.documentElement.addEventListener('pointerleave', clearDesktopLight);
document.addEventListener('pointercancel', clearDesktopLight, { passive: true });
document.addEventListener('keydown', clearDesktopLight, { passive: true });
document.addEventListener('visibilitychange', clearDesktopLight);
window.addEventListener('blur', clearDesktopLight);
window.addEventListener('resize', clearDesktopLight);
for (const button of backgroundToggles) button.addEventListener('click', clearDesktopLight);
for (const preference of [fineArtworkPointer, reducedBackgroundMotion, forcedBackgroundColors]) preference.addEventListener('change', clearDesktopLight);
