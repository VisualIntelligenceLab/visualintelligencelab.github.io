/* Edge displacement maps for the site's glass controls. */
(() => {
  'use strict';
  const segments = document.querySelector('[data-glass-segments]');
  if (segments) enableSegmentDrag(segments);

  // URL backdrop filters are reliable in Chromium. Other engines use the CSS frost.
  const chromium = /\b(?:Chrome|Chromium)\//.test(navigator.userAgent);
  if (!chromium || !CSS.supports('backdrop-filter', 'url("#glass-test")')) return;

  const surfaces = [...document.querySelectorAll('[data-glass]')];
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const definitions = document.createElementNS(ns, 'defs');
  svg.append(definitions);
  document.body.prepend(svg);

  const canvas = document.createElement('canvas');
  const canvasContext = canvas.getContext('2d');
  if (!canvasContext) return;
  const preview = document.querySelector('#glass-preview');
  const reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function updatePreview() {
    if (preview) preview.hidden = reduceTransparency.matches;
  }
  preview?.addEventListener('click', () => {
    const frosted = preview.getAttribute('aria-pressed') !== 'true';
    preview.setAttribute('aria-pressed', String(frosted));
    if (frosted) document.documentElement.dataset.glassPreview = 'frosted';
    else delete document.documentElement.dataset.glassPreview;
  });
  reduceTransparency.addEventListener('change', updatePreview);

  function element(name, attributes) {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function createMap(width, height, radius, edge, displacement) {
    canvas.width = width;
    canvas.height = height;
    const pixels = canvasContext.createImageData(width, height);
    const curve = Array.from({ length: 256 }, (_, i) => {
      const depth = i / 255;
      // The surface approaches flat at both ends; Snell's law maps slope to deflection.
      const incident = Math.atan(1.45 * Math.sin(Math.PI * depth));
      const refracted = Math.asin(Math.sin(incident) / 1.48);
      return Math.tan(incident - refracted) * displacement;
    });

    for (let y = 0; y < height; y++) {
      const dy = y + .5 - height / 2;
      const qy = Math.abs(dy) - (height / 2 - radius);
      for (let x = 0; x < width; x++) {
        const dx = x + .5 - width / 2;
        const qx = Math.abs(dx) - (width / 2 - radius);
        const cornerX = Math.max(0, qx);
        const cornerY = Math.max(0, qy);
        const cornerLength = Math.hypot(cornerX, cornerY);
        const distance = radius - cornerLength - Math.min(0, Math.max(qx, qy));
        const index = (y * width + x) * 4;
        pixels.data[index] = 128;
        pixels.data[index + 1] = 128;
        pixels.data[index + 3] = 255;
        if (distance <= 0 || distance >= edge) continue;

        const shift = curve[Math.round(distance / edge * 255)];
        const normalX = cornerLength ? cornerX / cornerLength : Number(qx >= qy);
        const normalY = cornerLength ? cornerY / cornerLength : Number(qy > qx);
        pixels.data[index] = 128 + Math.sign(dx) * normalX * shift;
        pixels.data[index + 1] = 128 + Math.sign(dy) * normalY * shift;
      }
    }
    canvasContext.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const filters = new Map(surfaces.map((surface, index) => {
    const id = 'glass-refraction-' + index;
    const filter = element('filter', {
      id,
      filterUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    const map = element('feImage', { result: 'edge-map', preserveAspectRatio: 'none' });
    const displacement = element('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'edge-map', xChannelSelector: 'R', yChannelSelector: 'G',
    });
    filter.append(map, displacement);
    definitions.append(filter);
    surface.style.setProperty('--glass-map', 'url("#' + id + '")');
    surface.addEventListener('pointermove', event => {
      if (reduceMotion.matches || event.pointerType === 'touch') return;
      const box = surface.getBoundingClientRect();
      surface.style.setProperty('--glint-x', (event.clientX - box.left) + 'px');
      surface.style.setProperty('--glint-y', (event.clientY - box.top) + 'px');
    }, { passive: true });
    surface.addEventListener('pointerleave', () => {
      surface.style.removeProperty('--glint-x');
      surface.style.removeProperty('--glint-y');
    });
    return [surface, { filter, map, displacement, size: '' }];
  }));

  const resize = new ResizeObserver(entries => {
    for (const { target, borderBoxSize } of entries) {
      const box = borderBoxSize?.[0] || { inlineSize: target.offsetWidth, blockSize: target.offsetHeight };
      const width = Math.round(box.inlineSize);
      const height = Math.round(box.blockSize);
      if (width < 1 || height < 1) continue;
      const surface = filters.get(target);
      const size = width + 'x' + height;
      if (surface.size === size) continue;
      const limit = Math.min(width, height);
      const radius = Math.min(limit / 2, parseFloat(getComputedStyle(target).borderTopLeftRadius));
      const edge = Math.min(19, limit * .23);
      const scale = Math.min(29, limit * .48);
      surface.filter.setAttribute('x', '0');
      surface.filter.setAttribute('y', '0');
      surface.filter.setAttribute('width', width);
      surface.filter.setAttribute('height', height);
      surface.map.setAttribute('width', width);
      surface.map.setAttribute('height', height);
      surface.displacement.setAttribute('scale', scale);
      surface.map.setAttribute('href', createMap(width, height, radius, edge, 275));
      surface.size = size;
      target.dataset.refracts = '';
    }
  });
  surfaces.forEach(surface => resize.observe(surface));
  document.documentElement.dataset.glassRenderer = 'refraction';
  updatePreview();

  function enableSegmentDrag(group) {
    const radios = [...group.querySelectorAll('input[type="radio"]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let drag = null;
    let suppressClick = false;
    const selected = () => radios.findIndex(radio => radio.checked);
    const position = index => group.style.setProperty('--segment-position', index);
    const clamp = value => Math.min(radios.length - 1, Math.max(0, value));

    group.addEventListener('change', () => position(selected()));
    position(selected());

    group.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick = false;
      const index = selected();
      const label = radios[index].closest('label');
      if (!label.contains(event.target)) return;
      drag = { pointer: event.pointerId, x: event.clientX, index, width: label.offsetWidth, moved: false };
      window.addEventListener('pointermove', track);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    });

    function track(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const distance = event.clientX - drag.x;
      if (!drag.moved && Math.abs(distance) < 7) return;
      if (!drag.moved) group.setPointerCapture(drag.pointer);
      drag.moved = true;
      if (reduced.matches) return;
      group.dataset.dragging = '';
      position(clamp(drag.index + distance / drag.width));
    }

    function finish(event, cancelled = event.type !== 'pointerup') {
      if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointer)) return;
      const { pointer, moved, index, width, x } = drag;
      drag = null;
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (group.hasPointerCapture(pointer)) group.releasePointerCapture(pointer);
      delete group.dataset.dragging;
      if (moved) suppressClick = true;
      const next = moved && !cancelled ? Math.round(clamp(index + (event.clientX - x) / width)) : index;
      if (next !== index) {
        radios[next].checked = true;
        radios[next].dispatchEvent(new Event('change', { bubbles: true }));
        radios[next].focus({ preventScroll: true });
      }
      position(selected());
    }

    group.addEventListener('lostpointercapture', finish);
    window.addEventListener('blur', finish);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drag?.moved) finish(event, true);
    });
    group.addEventListener('click', event => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
    }, true);
  }
})();
