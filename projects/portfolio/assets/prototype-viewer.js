(() => {
  const link = document.querySelector('.prototype-capture > .screenshot-link');
  const viewer = document.getElementById('prototype-viewer');
  if (!link || !viewer || typeof viewer.showModal !== 'function') return;
  const stage = viewer.querySelector('.prototype-stage');
  const close = viewer.querySelector('.prototype-close');
  const detail = viewer.querySelector('.prototype-detail');
  const status = viewer.querySelector('.prototype-status');
  const source = document.querySelector('.prototype-capture > .prototype-open > img');
  let currentImage = null;
  let pan = null;
  const resetPan = () => {
    const previous = pan;
    pan = null;
    stage.classList.remove('is-panning');
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
  };
  stage.addEventListener('pointerdown', event => {
    if (viewer.dataset.detail !== 'true' || event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || event.ctrlKey || event.metaKey || event.altKey) return;
    pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop, active: false };
  });
  stage.addEventListener('pointermove', event => {
    if (!pan || event.pointerId !== pan.id) return;
    if (!(event.buttons & 1)) { resetPan(); return; }
    const dx = event.clientX - pan.x, dy = event.clientY - pan.y;
    if (!pan.active) {
      if (Math.hypot(dx, dy) < 5) return;
      try { stage.setPointerCapture(event.pointerId); } catch { resetPan(); return; }
      pan.active = true;
      stage.classList.add('is-panning');
    }
    event.preventDefault();
    stage.scrollLeft = pan.left - dx;
    stage.scrollTop = pan.top - dy;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, resetPan);
  window.addEventListener('pointerup', resetPan);
  window.addEventListener('blur', resetPan);
  window.addEventListener('resize', resetPan);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetPan(); });
  stage.addEventListener('dragstart', event => { if (viewer.dataset.detail === 'true') event.preventDefault(); });
  const resetDetail = () => {
    resetPan();
    viewer.dataset.detail = 'false';
    detail.setAttribute('aria-pressed', 'false');
    stage.scrollTo(0, 0);
  };
  link.setAttribute('aria-haspopup', 'dialog');
  link.setAttribute('aria-controls', viewer.id);
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (viewer.open) return;
    resetDetail();
    detail.disabled = true;
    status.textContent = 'Loading prototype capture…';
    const image = document.createElement('img');
    currentImage = image;
    image.alt = source.alt;
    image.hidden = true;
    image.width = 1280;
    image.height = 800;
    image.addEventListener('load', () => {
      if (image !== currentImage || !viewer.open) return;
      image.hidden = false;
      detail.disabled = false;
      status.textContent = '1280 × 800 · Detail view: drag or scroll to explore.';
    });
    image.addEventListener('error', () => {
      if (image !== currentImage || !viewer.open) return;
      status.textContent = 'The capture could not load. You can try the image file or close this window.';
    });
    stage.replaceChildren(image);
    viewer.showModal();
    document.body.classList.add('dialog-open');
    close.focus();
    image.src = link.href;
  });
  detail.addEventListener('click', () => {
    resetPan();
    const active = viewer.dataset.detail !== 'true';
    viewer.dataset.detail = String(active);
    detail.setAttribute('aria-pressed', String(active));
    stage.scrollTo(0, 0);
    if (active) stage.focus();
  });
  close.addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    currentImage?.removeAttribute('src');
    currentImage = null;
    stage.replaceChildren();
    resetDetail();
    status.textContent = '';
    document.body.classList.remove('dialog-open');
    if (document.activeElement === document.body || viewer.contains(document.activeElement)) link.focus({ preventScroll: true });
  });
})();
