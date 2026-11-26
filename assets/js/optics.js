(() => {
  const bench = document.querySelector('#optics');
  const canvas = document.querySelector('#optics-canvas');
  const context = canvas?.getContext('2d');
  if (!bench || !context) return;

  const toggle = document.querySelector('#optics-toggle');
  const slider = document.querySelector('#optics-wavelength');
  const value = document.querySelector('#optics-value');
  const title = document.querySelector('#optics-mode-title');
  const description = document.querySelector('#optics-description');
  const stageLabel = document.querySelector('#optics-stage-label');
  const plateNumber = document.querySelector('#optics-plate-number');
  const plateName = document.querySelector('#optics-plate-name');
  const source = document.querySelector('#optics-source');
  const stage = canvas.parentElement;
  const prismView = document.querySelector('#prism-view');
  const prismCanvas = document.querySelector('#prism-canvas');
  const prismInstructions = document.querySelector('#prism-instructions');
  const reset = document.querySelector('#prism-reset');
  const rays = document.querySelector('#prism-rays');
  const radios = bench.querySelector('.optics-modes');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const width = 640;
  const height = 352;
  const circle = 2 * Math.PI;
  const spectrum = [
    [420, [159, 112, 255]], [470, [72, 164, 255]], [505, [57, 231, 224]],
    [545, [125, 239, 129]], [575, [255, 228, 94]], [610, [255, 156, 88]],
    [680, [255, 79, 95]]
  ];
  const modes = {
    scattering: {
      title: '瑞利散射',
      plate: '02',
      name: 'SCATTERING',
      label: '入射光 / 散射光',
      description: '波长越短，微小粒子的散射越强。把滑块向右移，观察散射光变弱。',
      source: 'NASA 参考资料',
      href: 'https://acd-ext.gsfc.nasa.gov/anonftp/acd/daac_ozone/Lecture4/Text/Lecture_4/raymie.html',
      draw: drawScattering,
    },
    interference: {
      title: '双缝干涉',
      plate: '03',
      name: 'INTERFERENCE',
      label: '双缝 / 波前 / 屏上条纹',
      description: '两列光波在屏上叠加，形成明暗条纹。双缝间距固定时，波长越长，条纹间距越大。',
      source: 'OpenStax 参考资料',
      href: 'https://openstax.org/books/university-physics-volume-3/pages/4-3-double-slit-diffraction',
      draw: drawInterference,
    },
    dispersion: {
      title: '棱镜色散',
      plate: '01',
      name: 'DISPERSION',
      label: '白光 / 棱镜 / 出射光谱',
      description: '白光经过玻璃棱镜后分成光谱。拖动滑块可标出波长。紫光比红光折射得更多，色散幅度为便于观察而放大。',
      source: 'OpenStax 参考资料',
      href: 'https://openstax.org/books/university-physics-volume-3/pages/1-5-dispersion',
      draw: drawDispersion,
    },
  };

  let mode = radios.querySelector(':checked').value;
  let wavelength = Number(slider.value);
  let elapsed = 0;
  let lastFrame = null;
  let frameId = null;
  let playing = !reducedMotion.matches;
  let inView = true;
  let background;
  let prism = null;
  let prismLost = false;
  let showRays = false;
  let drag = null;
  const target = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };

  function colorAt(nm) {
    if (nm <= spectrum[0][0]) return spectrum[0][1];
    for (let i = 1; i < spectrum.length; i++) {
      const [end, right] = spectrum[i];
      if (nm > end) continue;
      const [start, left] = spectrum[i - 1];
      const ratio = (nm - start) / (end - start);
      return left.map((channel, index) => Math.round(channel + (right[index] - channel) * ratio));
    }
    return spectrum.at(-1)[1];
  }

  const rgba = (color, alpha = 1) => 'rgba(' + color.join(',') + ',' + alpha + ')';
  const seed = n => (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1;
  const random = n => seed(n) % 1;
  const molecules = Array.from({ length: 105 }, (_, i) => {
    const x = 115 + random(i * 4) * 405;
    const y = 40 + random(i * 4 + 1) * 251;
    return { x, y, size: .6 + random(i * 4 + 2) * 1.65, alpha: .14 + random(i * 4 + 3) * .37 };
  });
  const scatterRays = Array.from({ length: 42 }, (_, i) => ({
    x: 147 + random(500 + i) * 300,
    y: 167 + (random(600 + i) - .5) * 26,
    angle: random(700 + i) * circle,
    length: 35 + random(800 + i) * 90,
    phase: random(900 + i),
  }));

  function line(x1, y1, x2, y2, stroke, weight = 1) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = stroke;
    context.lineWidth = weight;
    context.stroke();
  }

  function dot(x, y, radius, fill) {
    context.beginPath();
    context.arc(x, y, radius, 0, circle);
    context.fillStyle = fill;
    context.fill();
  }

  function glow(x, y, radius, color, alpha) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, alpha));
    gradient.addColorStop(1, rgba(color, 0));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function beam(x1, y1, x2, y2, color, alpha = 1) {
    line(x1, y1, x2, y2, rgba(color, .09 * alpha), 15);
    line(x1, y1, x2, y2, rgba(color, .27 * alpha), 5);
    line(x1, y1, x2, y2, rgba(color, .9 * alpha), 1.5);
  }

  function drawScattering(time, color) {
    // Rayleigh intensity is proportional to 1 / wavelength^4.
    const strength = (420 / wavelength) ** 4;
    context.save();
    context.beginPath();
    context.rect(20, 16, 600, 302);
    context.clip();
    glow(303, 167, 195, color, .28 * strength);
    const spread = context.createLinearGradient(0, 142, 0, 192);
    spread.addColorStop(0, rgba(color, 0));
    spread.addColorStop(.5, rgba(color, .27));
    spread.addColorStop(1, rgba(color, 0));
    context.fillStyle = spread;
    context.fillRect(28, 142, 575, 50);
    beam(26, 167, 602, 167, color, .85);

    for (const molecule of molecules) {
      dot(molecule.x, molecule.y, molecule.size, rgba([153, 181, 206], molecule.alpha));
      if (Math.abs(molecule.y - 167) < 21) {
        glow(molecule.x, molecule.y, 12, color, strength * .48);
      }
    }
    for (const ray of scatterRays) {
      const progress = (ray.phase + time * .52) % 1;
      const dx = Math.cos(ray.angle) * ray.length;
      const dy = Math.sin(ray.angle) * ray.length;
      const intensity = strength * (.5 + .5 * Math.cos(ray.angle) ** 2);
      line(ray.x, ray.y, ray.x + dx, ray.y + dy, rgba(color, .24 * intensity));
      const x = ray.x + dx * progress;
      const y = ray.y + dy * progress;
      const pulse = intensity * Math.sin(Math.PI * progress);
      glow(x, y, 8, color, .65 * pulse);
      dot(x, y, 1.65, rgba(color, .95 * pulse));
    }
    const pulseX = 26 + (time * 152 + 80) % 576;
    glow(pulseX, 167, 19, color, .7);
    dot(pulseX, 167, 3, '#e1efff');
    context.restore();
  }

  function drawInterference(time, color) {
    const barrier = 196;
    const slits = [124, 210];
    const centre = 167;
    const screen = 566;
    const spacing = wavelength / 15;

    context.save();
    context.beginPath();
    context.rect(20, 22, barrier - 20, 290);
    context.clip();
    for (let x = 20 + time * 45 % spacing; x < barrier; x += spacing) {
      line(x, 52, x, 283, rgba(color, .44), 1.1);
    }
    context.restore();

    context.save();
    context.beginPath();
    context.rect(barrier, 18, screen - barrier, 298);
    context.clip();
    glow(350, centre, 190, color, .13);
    for (const y of slits) {
      for (let radius = time * 45 % spacing; radius < 410; radius += spacing) {
        context.beginPath();
        context.arc(barrier, y, radius, -Math.PI / 2, Math.PI / 2);
        context.strokeStyle = rgba(color, .6 - .43 * radius / 410);
        context.lineWidth = 1.2;
        context.stroke();
      }
    }
    context.restore();

    line(barrier, 24, barrier, slits[0] - 6, '#70849a', 3);
    line(barrier, slits[0] + 6, barrier, slits[1] - 6, '#70849a', 3);
    line(barrier, slits[1] + 6, barrier, 313, '#70849a', 3);
    for (const y of slits) glow(barrier, y, 23, color, .7);

    // Far-field pattern: double-slit interference times the single-slit envelope.
    const fringeSpacing = wavelength / 14;
    context.fillStyle = '#101f32';
    context.fillRect(screen, 24, 47, 287);
    for (let y = 25; y < 311; y++) {
      const phase = Math.PI * (y - centre) / fringeSpacing;
      const envelope = phase === 0 ? 1 : (Math.sin(phase / 3.4) / (phase / 3.4)) ** 2;
      const intensity = Math.cos(phase) ** 2 * envelope;
      context.fillStyle = rgba(color, intensity * .93);
      context.fillRect(screen + 1, y, 45, 1);
    }
    context.strokeStyle = '#70849a';
    context.lineWidth = 1.3;
    context.strokeRect(screen, 24, 47, 287);
  }

  function drawDispersion(time, color) {
    const entry = { x: 222, y: 147 };
    const exit = { x: 371, y: 162 };
    const endX = 605;
    // The screen offsets exaggerate the normal dispersion of glass for readability.
    const deviation = nm => 173 + 108 * ((420 / nm) ** 2 - (420 / 680) ** 2) / (1 - (420 / 680) ** 2);
    const white = [219, 236, 255];

    glow(316, 151, 164, [123, 168, 239], .17);
    context.beginPath();
    context.moveTo(294, 39);
    context.lineTo(431, 257);
    context.lineTo(157, 257);
    context.closePath();
    const glass = context.createLinearGradient(157, 257, 357, 63);
    glass.addColorStop(0, '#24405d30');
    glass.addColorStop(.5, '#9ccaff38');
    glass.addColorStop(1, '#9ccaff15');
    context.fillStyle = glass;
    context.fill();
    context.strokeStyle = '#adc9e6';
    context.lineWidth = 1.6;
    context.stroke();

    for (let nm = 680; nm >= 420; nm -= 3) {
      line(exit.x, exit.y, endX, deviation(nm), rgba(colorAt(nm), .38), 2.15);
    }
    beam(26, entry.y, entry.x, entry.y, white, .95);
    beam(entry.x, entry.y, exit.x, exit.y, white, .83);
    const endY = deviation(wavelength);
    beam(exit.x, exit.y, endX, endY, color);
    line(endX, 157, endX, 294, '#6c819b', 1.2);
    glow(endX, endY, 17, color, .6);
    dot(endX, endY, 3.7, rgba(color));
    const pulse = (time * .53 + .42) % 1;
    glow(exit.x + (endX - exit.x) * pulse, exit.y + (endY - exit.y) * pulse, 17, color, .73);
    glow(26 + ((time * 116 + 55) % (entry.x - 26)), entry.y, 19, white, .64);
  }

  function draw() {
    if (hasPrism()) {
      prism.draw(tilt.x, tilt.y, wavelength, elapsed, showRays);
      return;
    }
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    for (let x = 16; x < width; x += 24) line(x, 0, x, height, '#a2c9cd18');
    for (let y = 16; y < height; y += 24) line(0, y, width, y, '#a2c9cd18');
    modes[mode].draw(elapsed, colorAt(wavelength));
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth, clientHeight } = stage;
    if (!clientWidth || !clientHeight) return;
    if (hasPrism()) {
      prism.resize(clientWidth, clientHeight);
      draw();
      return;
    }
    canvas.width = Math.max(1, Math.round(clientWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(clientHeight * pixelRatio));
    const scale = Math.min(canvas.width / width, canvas.height / height);
    context.setTransform(scale, 0, 0, scale,
      (canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2);
    background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#102128');
    background.addColorStop(.6, '#1a343d');
    background.addColorStop(1, '#11242c');
    draw();
  }

  function frame(timestamp) {
    frameId = null;
    const step = lastFrame === null ? 1 / 60 : Math.min(timestamp - lastFrame, 50) / 1000;
    if (playing) elapsed += step;
    lastFrame = timestamp;
    if (hasPrism()) {
      const easing = 1 - Math.exp(-step * 13);
      for (const axis of ['x', 'y']) {
        const delta = target[axis] - tilt[axis];
        tilt[axis] = Math.abs(delta) < .002 ? target[axis] : tilt[axis] + delta * easing;
      }
    }
    draw();
    updatePlayback();
  }

  function updatePlayback() {
    const label = playing ? '暂停动画' : '播放动画';
    if (toggle.textContent !== label) toggle.textContent = label;
    const settling = hasPrism() && (target.x !== tilt.x || target.y !== tilt.y);
    if ((playing || settling) && inView && !document.hidden) {
      if (frameId === null) frameId = requestAnimationFrame(frame);
    } else {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      lastFrame = null;
    }
  }

  function updateWavelength() {
    wavelength = Number(slider.value);
    value.textContent = wavelength + ' nm';
    slider.setAttribute('aria-valuetext', wavelength + ' 纳米');
    slider.style.accentColor = rgba(colorAt(wavelength));
    draw();
  }

  function hasPrism() {
    return mode === 'dispersion' && prism && !prismLost;
  }

  function changeTilt(x, y) {
    target.x = Math.max(-1, Math.min(1, x));
    target.y = Math.max(-1, Math.min(1, y));
    if (reducedMotion.matches) {
      Object.assign(tilt, target);
      draw();
    } else {
      updatePlayback();
    }
  }

  function syncMode() {
    const details = modes[mode];
    const showPrism = Boolean(hasPrism());
    title.textContent = details.title;
    plateNumber.textContent = details.plate;
    plateName.textContent = details.name;
    stageLabel.textContent = showPrism && !showRays ? '三棱镜 · 光谱折射' : details.label;
    description.textContent = showPrism && !showRays
      ? '玻璃棱镜把背景分解成彩色光谱。打开「光路示意」可查看白光的入射、折射和选定波长。'
      : details.description;
    source.textContent = details.source;
    source.href = details.href;
    canvas.hidden = showPrism;
    prismView.hidden = prismInstructions.hidden = !showPrism;
    reset.hidden = rays.hidden = !showPrism;
    resize();
    updatePlayback();
  }

  prismView.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, tiltX: target.x, tiltY: target.y };
    prismView.setPointerCapture(event.pointerId);
    prismView.dataset.dragging = '';
  });
  prismView.addEventListener('pointermove', event => {
    const rect = prismView.getBoundingClientRect();
    if (drag?.id === event.pointerId) {
      changeTilt(drag.tiltX + 2.8 * (event.clientX - drag.x) / rect.width,
        drag.tiltY + 2.8 * (event.clientY - drag.y) / rect.height);
    } else if (event.pointerType === 'mouse') {
      changeTilt(2 * (event.clientX - rect.left) / rect.width - 1,
        2 * (event.clientY - rect.top) / rect.height - 1);
    }
  });
  prismView.addEventListener('lostpointercapture', event => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    delete prismView.dataset.dragging;
  });
  prismView.addEventListener('pointerleave', event => {
    if (!drag && event.pointerType === 'mouse') changeTilt(0, 0);
  });
  const arrowTilt = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  function resetView() {
    elapsed = 0;
    changeTilt(0, 0);
    draw();
  }
  prismView.addEventListener('keydown', event => {
    if (event.key === 'Home') {
      event.preventDefault();
      resetView();
    } else if (Object.hasOwn(arrowTilt, event.key)) {
      event.preventDefault();
      const [x, y] = arrowTilt[event.key];
      changeTilt(target.x + .24 * x, target.y + .24 * y);
    }
  });
  reset.addEventListener('click', resetView);
  rays.addEventListener('click', () => {
    showRays = !showRays;
    rays.setAttribute('aria-pressed', String(showRays));
    syncMode();
  });
  prismCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    prismLost = true;
    syncMode();
  });

  bench.hidden = false;
  document.querySelector('#vision-fallback').hidden = true;
  syncMode();
  updateWavelength();
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePlayback();
  }).observe(stage);

  radios.addEventListener('change', event => {
    mode = event.target.value;
    syncMode();
  });
  slider.addEventListener('input', updateWavelength);
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', event => {
    playing = !event.matches;
    updatePlayback();
  });
  toggle.addEventListener('click', () => {
    playing = !playing;
    updatePlayback();
  });

  // ES modules require HTTP in common browsers. Double-click preview keeps the 2D plate.
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    import('./optics-prism.js').then(({ createPrism }) => {
      prism = createPrism(prismCanvas, colorAt);
      if (!prism) return;
      prismCanvas.addEventListener('webglcontextrestored', () => {
        prismLost = false;
        syncMode();
      });
      syncMode();
    }).catch(error => console.warn('3D prism unavailable. Using the 2D dispersion diagram.', error));
  }
})();
