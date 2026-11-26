import * as THREE from './vendor/three/three.module.min.js';
import { createGallery } from './prism-gallery.js';

const screenX = 4.65;
const white = new THREE.Color('#edfdf0');
const source = new THREE.Vector3(-5, -.47, 0);
const incidence = new THREE.Vector3(1, .13, 0).normalize();
const sampleCount = 40;
const spectrumMagnification = 6.5;
const crossSection = [[-1.32, -1], [1.32, -1], [0, 1.78]];

function rayHull() {
  const front = crossSection.map(([x, y]) => [x, y, .62]);
  const corners = [...front, ...front.map(([x, y]) => [x, y, -.62])];
  const triangles = [
    [0, 1, 2], [4, 3, 5],
    [3, 4, 1], [3, 1, 0],
    [4, 5, 2], [4, 2, 1],
    [5, 3, 0], [5, 0, 2],
  ];
  return { corners: corners.map(point => new THREE.Vector3(...point)), triangles };
}

function beamMaterial(vertexColors) {
  return new THREE.ShaderMaterial({
    vertexColors,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { tint: { value: white.clone() }, intensity: { value: 1 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vTint;
      uniform vec3 tint;
      void main() {
        vUv = uv;
        vTint = tint;
        #ifdef USE_COLOR
          vTint = color;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vTint;
      uniform float intensity;
      void main() {
        float centre = abs(vUv.y * 2.0 - 1.0);
        #ifdef USE_COLOR
          float edge = smoothstep(0.0, 0.07, vUv.y) * smoothstep(0.0, 0.07, 1.0 - vUv.y);
          float alpha = intensity * edge * mix(0.58, 1.0, vUv.x);
        #else
          float alpha = intensity * (0.67 * exp(-48.0 * centre * centre) + 0.29 * exp(-6.0 * centre * centre));
        #endif
        gl_FragColor = vec4(vTint, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

function ribbon(scene, size, vertexColors = false) {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(size * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const colors = new THREE.BufferAttribute(new Float32Array(size * 6), 3);
  const uv = [];
  const indices = [];
  for (let index = 0; index < size; index++) {
    uv.push(vertexColors ? 0 : index, vertexColors ? index / (size - 1) : 0);
    uv.push(vertexColors ? 1 : index, vertexColors ? index / (size - 1) : 1);
    if (index > 0) {
      const left = (index - 1) * 2;
      indices.push(left, left + 1, left + 2, left + 1, left + 3, left + 2);
    }
  }
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  if (vertexColors) geometry.setAttribute('color', colors);
  const material = beamMaterial(vertexColors);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = vertexColors ? 2 : 3;
  scene.add(mesh);
  return { mesh, material, positions, colors };
}

function moveBeam(beam, start, end, width) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const scale = width / Math.hypot(dx, dy);
  for (const [index, point] of [start, end].entries()) {
    beam.positions.setXYZ(index * 2, point.x + dy * scale, point.y - dx * scale, point.z);
    beam.positions.setXYZ(index * 2 + 1, point.x - dy * scale, point.y + dx * scale, point.z);
  }
  beam.positions.needsUpdate = true;
}

// The normal faces the incident medium. A null result signals total internal reflection.
function refract(direction, normal, ratio) {
  const cosine = -direction.dot(normal);
  const discriminant = 1 - ratio * ratio * (1 - cosine * cosine);
  if (discriminant < 0) return null;
  return direction.clone().multiplyScalar(ratio)
    .addScaledVector(normal, ratio * cosine - Math.sqrt(discriminant)).normalize();
}

function makeRayTrace(corners, triangles) {
  const faces = triangles.map(([a, b, c]) => ({
    a: corners[a].clone(), b: corners[b].clone(), c: corners[c].clone(), normal: new THREE.Vector3(),
  }));
  const ray = new THREE.Ray();
  const hitPoint = new THREE.Vector3();

  function nearest(origin, direction) {
    ray.set(origin, direction);
    let hit = null;
    let nearestDistance = Infinity;
    for (const face of faces) {
      if (!ray.intersectTriangle(face.a, face.b, face.c, false, hitPoint)) continue;
      const distance = origin.distanceToSquared(hitPoint);
      if (distance < 1e-7 || distance >= nearestDistance) continue;
      nearestDistance = distance;
      hit = { point: hitPoint.clone(), normal: face.normal };
    }
    return hit;
  }

  return {
    pose(matrix) {
      faces.forEach((face, index) => {
        const [a, b, c] = triangles[index];
        face.a.copy(corners[a]).applyMatrix4(matrix);
        face.b.copy(corners[b]).applyMatrix4(matrix);
        face.c.copy(corners[c]).applyMatrix4(matrix);
        THREE.Triangle.getNormal(face.a, face.b, face.c, face.normal);
      });
      return nearest(source, incidence);
    },
    through(entry, wavelength) {
      // Approximate crown glass with a two-term Cauchy model.
      const ior = 1.502 + .016 * (550 / wavelength) ** 2;
      const inside = refract(incidence, entry.normal, 1 / ior);
      const exit = inside && nearest(entry.point, inside);
      if (!exit) return null;
      const outgoing = refract(inside, exit.normal.clone().negate(), ior);
      if (!outgoing || outgoing.x < .1) return null;
      const screen = exit.point.clone().addScaledVector(outgoing, (screenX - exit.point.x) / outgoing.x);
      return { exit: exit.point, screen };
    },
  };
}

function measurementMarks(scene) {
  const vertices = [screenX, -.42, 0, screenX, -2.89, 0, -5, -.91, 0, -5, -.13, 0];
  for (let n = 0; n <= 13; n++) {
    const y = -.47 - n * .18;
    vertices.push(screenX, y, 0, screenX + (n % 5 === 0 ? .21 : .11), y, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: '#a1c2b9', transparent: true, opacity: .45,
  })));
}

export function createPrism(canvas, colorAt) {
  const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 40);
  const gallery = createGallery(scene, crossSection);
  const prism = gallery.prism;
  const paths = new THREE.Group();
  scene.add(paths);
  measurementMarks(paths);
  const { corners, triangles } = rayHull();
  const trace = makeRayTrace(corners, triangles);
  const whiteBeam = ribbon(paths, 2);
  const internalBeam = ribbon(paths, 2);
  const selectedBeam = ribbon(paths, 2);
  const fan = ribbon(paths, sampleCount, true);
  fan.material.uniforms.intensity.value = .90;
  internalBeam.material.uniforms.intensity.value = .68;
  const selectedColor = selectedBeam.material.uniforms.tint.value;
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const nm = 680 - 260 * index / (sampleCount - 1);
    const [r, g, b] = colorAt(nm);
    const color = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    fan.colors.setXYZ(index * 2, color.r, color.g, color.b);
    fan.colors.setXYZ(index * 2 + 1, color.r, color.g, color.b);
    return nm;
  });
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(.053, 16, 8),
    new THREE.MeshBasicMaterial({ color: '#fff', depthTest: false }),
  );
  marker.renderOrder = 4;
  paths.add(marker);

  let aspect = 2;
  let lastWavelength;
  let lastShowRays;
  let reproject = true;

  function magnify(path, central) {
    if (path && central) {
      // Widen the displayed spectrum about the green ray, leaving both surface hits intact.
      path.screen.y = central.screen.y + (path.screen.y - central.screen.y) * spectrumMagnification;
    }
    return path;
  }

  function drawPaths(wavelength) {
    const entry = trace.pose(prism.matrixWorld);
    const central = entry && trace.through(entry, 550);
    const selected = entry && magnify(trace.through(entry, wavelength), central);
    whiteBeam.mesh.visible = Boolean(entry);
    internalBeam.mesh.visible = Boolean(central);
    selectedBeam.mesh.visible = marker.visible = Boolean(selected);

    if (entry) moveBeam(whiteBeam, source, entry.point, .15);
    if (central) moveBeam(internalBeam, entry.point, central.exit, .108);
    if (selected) {
      moveBeam(selectedBeam, selected.exit, selected.screen, .069);
      const [r, g, b] = colorAt(wavelength);
      selectedColor.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
      marker.material.color.copy(selectedColor).lerp(white, .35);
      marker.position.copy(selected.screen);
    }
    let hasSpectrum = false;
    samples.forEach((nm, index) => {
      const path = entry && magnify(trace.through(entry, nm), central);
      const start = path?.exit || central?.exit || source;
      const end = path?.screen || start;
      if (path) hasSpectrum = true;
      fan.positions.setXYZ(index * 2, start.x, start.y, start.z);
      fan.positions.setXYZ(index * 2 + 1, end.x, end.y, end.z);
    });
    fan.mesh.visible = hasSpectrum;
    fan.positions.needsUpdate = true;
  }

  return {
    resize(width, height) {
      aspect = width / height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45, 1400 / width));
      renderer.setSize(width, height, false);
      reproject = true;
    },
    draw(x, y, wavelength, time, showRays) {
      const viewChanged = lastShowRays !== showRays || reproject;
      if (viewChanged) {
        const halfHeight = showRays ? Math.max(3.08, 5.35 / aspect) : 2.06;
        camera.position.set(0, showRays ? -.34 : .24, 14);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        gallery.setView(camera, aspect, showRays);
        paths.visible = showRays;
      }

      const pitch = showRays ? .19 - y * .20 : .27 - y * .29 + .065 * Math.sin(time * .65);
      const yaw = showRays ? -.34 + x * .23 : -.44 + x * .37 + .075 * Math.sin(time * .54);
      const roll = showRays ? -.08 : -.14 + x * .07;
      const poseChanged = prism.rotation.x !== pitch || prism.rotation.y !== yaw || prism.rotation.z !== roll;
      if (poseChanged || wavelength !== lastWavelength || viewChanged) {
        prism.rotation.set(pitch, yaw, roll);
        prism.updateMatrixWorld(true);
        gallery.pose(wavelength);
        if (showRays) drawPaths(wavelength);
        lastWavelength = wavelength;
        lastShowRays = showRays;
        reproject = false;
      }
      marker.scale.setScalar(1 + .30 * Math.sin(time * 3));
      whiteBeam.material.uniforms.intensity.value = .82 + .09 * Math.sin(time * 2.2);
      renderer.render(scene, camera);
    },
  };
}
