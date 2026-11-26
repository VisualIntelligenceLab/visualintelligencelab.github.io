import * as THREE from './vendor/three/three.module.min.js';

function spectralArtwork() {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // The optical target is made from original VIL lettering, broken by a registration grid.
  const rows = [
    { text: 'SPECTRUM', x: -120, y: 140, fill: '#d2d0c8' },
    { text: 'VISIBLE', x: 278, y: 319, fill: '#e0ded7' },
    { text: 'OPTICS', x: -165, y: 498, fill: '#c6c4bd' },
    { text: 'SPECTRUM', x: 143, y: 677, fill: '#d9d7cf' },
  ];
  ctx.font = '900 206px Arial, sans-serif';
  for (const { text, x, y, fill } of rows) {
    ctx.fillStyle = fill;
    const repeat = ctx.measureText(text).width + 43;
    for (let left = x - repeat; left < canvas.width; left += repeat) ctx.fillText(text, left, y);
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, y - 60, canvas.width, 5);
  }

  ctx.fillStyle = '#090909';
  for (let x = 34; x < canvas.width; x += 155) {
    ctx.fillRect(x, 0, 4, canvas.height);
  }
  ctx.strokeStyle = '#ded7c345';
  ctx.lineWidth = 1;
  for (const y of [158, 337, 516, 695]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

const artSampling = `
  uniform sampler2D uArt;
  uniform vec2 uArtFit;
  uniform float uArtLevel;

  vec3 artwork(vec2 uv, float softness) {
    vec2 crop = (uv - 0.5) * uArtFit + 0.5;
    vec3 art = texture2D(uArt, clamp(crop, 0.001, 0.999), softness).rgb;
    return art * uArtLevel;
  }
`;

const crystalFragment = `
  ${artSampling}
  varying vec3 vLocalPoint;
  varying vec3 vLocalNormal;
  uniform mat3 uBasis;
  uniform vec2 uViewHalfSize;
  uniform float uViewCenter;
  uniform float uWavelength;

  void testPlane(
    vec3 point, vec3 direction, vec3 planeNormal, float offset,
    inout float distance, inout vec3 normal
  ) {
    float rate = dot(direction, planeNormal);
    float next = (offset - dot(point, planeNormal)) / max(rate, 0.00001);
    if (rate > 0.00001 && next > 0.0006 && next < distance) {
      distance = next;
      normal = planeNormal;
    }
  }

  vec3 throughGlass(vec3 localView, vec3 normal, float ior, float separation) {
    vec3 ray = refract(localView, normal, 1.0 / ior);
    vec3 point = vLocalPoint + ray * 0.004;
    vec3 outgoing = ray;
    // The main planes bound the beveled triangular solid. Internal reflections
    // keep the side facets coherent when a ray reaches a face above the critical angle.
    for (int bounce = 0; bounce < 3; bounce++) {
      float distance = 50.0;
      vec3 exitNormal = vec3(0.0, 0.0, -1.0);
      testPlane(point, ray, vec3(0.0, 0.0,  1.0), 0.66, distance, exitNormal);
      testPlane(point, ray, vec3(0.0, 0.0, -1.0), 0.66, distance, exitNormal);
      testPlane(point, ray, vec3(0.0, -1.0, 0.0), 1.085, distance, exitNormal);
      testPlane(point, ray, vec3( .9033, .4289, 0.0), .849, distance, exitNormal);
      testPlane(point, ray, vec3(-.9033, .4289, 0.0), .849, distance, exitNormal);
      if (distance > 40.0) break;
      point += ray * distance;
      outgoing = refract(ray, -exitNormal, ior);
      if (dot(outgoing, outgoing) > 0.01) break;
      ray = reflect(ray, exitNormal);
      outgoing = ray;
      point += ray * 0.004;
    }
    vec3 exitPoint = uBasis * point;
    vec3 direction = uBasis * outgoing;
    float reach = clamp((-2.6 - exitPoint.z) / min(-0.13, direction.z), 0.0, 3.8);
    vec2 landing = exitPoint.xy + direction.xy * reach;
    landing.y -= uViewCenter;
    vec2 uv = 0.5 + 0.5 * landing / uViewHalfSize;
    // Amplify the chromatic shift for this optical exhibit.
    float angle = 1.0 - abs(dot(localView, normal));
    vec2 split = vec2(0.042 + normal.x * 0.02, 0.088 + normal.y * 0.035);
    return artwork(uv + split * separation * (0.72 + 1.6 * angle), 1.25 + angle);
  }

  void main() {
    vec3 normal = normalize(vLocalNormal);
    vec3 localView = -vec3(uBasis[0].z, uBasis[1].z, uBasis[2].z);
    float fresnel = pow(1.0 - clamp(dot(-localView, normal), 0.0, 1.0), 3.0);
    vec3 red = throughGlass(localView, normal, 1.445, -1.0);
    vec3 green = throughGlass(localView, normal, 1.520, 0.0);
    vec3 blue = throughGlass(localView, normal, 1.595, 1.0);
    vec3 color = vec3(red.r, green.g, blue.b);

    vec3 worldNormal = uBasis * normal;
    vec3 reflected = uBasis * reflect(localView, normal);
    float softbox = pow(max(0.0, dot(reflected, normalize(vec3(-.45, .75, .55)))), 11.0);
    float rim = max(0.0, dot(worldNormal, normalize(vec3(.8, .4, .2))));
    float phase = vLocalPoint.y * 3.25 - vLocalPoint.x * 1.3 + worldNormal.x * 2.1 + uWavelength;
    vec3 fringe = 0.65 + 0.35 * cos(phase + vec3(0.0, 2.1, 4.2));
    color = color * (0.69 + 0.25 * fringe);
    color += fringe * (0.035 + 0.14 * fresnel + 0.1 * rim);
    color += vec3(.71, .79, .83) * (0.16 * softbox + 0.07 * fresnel);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createGallery(scene, shape) {
  const common = {
    uArt: { value: spectralArtwork() },
    uArtFit: { value: new THREE.Vector2(1, 1) },
    uArtLevel: { value: 1 },
  };
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: common,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vArtUv;
      void main() {
        vArtUv = uv;
        gl_Position = vec4(position.xy, 0., 1.);
      }
    `,
    fragmentShader: `
      ${artSampling}
      varying vec2 vArtUv;
      void main() {
        gl_FragColor = vec4(artwork(vArtUv, 0.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  backing.frustumCulled = false;
  backing.renderOrder = -1;
  scene.add(backing);

  const section = new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(section, {
    depth: 1.16,
    bevelThickness: .08,
    bevelSize: .084,
    bevelSegments: 4,
  });
  geometry.translate(0, 0, -.58);
  const uniforms = {
    ...common,
    uBasis: { value: new THREE.Matrix3() },
    uViewHalfSize: { value: new THREE.Vector2(1, 1) },
    uViewCenter: { value: 0 },
    uWavelength: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vLocalPoint;
      varying vec3 vLocalNormal;
      void main() {
        vLocalPoint = position;
        vLocalNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: crystalFragment,
  });
  const prism = new THREE.Mesh(geometry, material);
  scene.add(prism);
  return {
    prism,
    setView(camera, aspect, showRays) {
      common.uArtFit.value.set(Math.min(1, aspect / 2), Math.min(1, 2 / aspect));
      common.uArtLevel.value = showRays ? .17 : 1;
      uniforms.uViewHalfSize.value.set(camera.right, camera.top);
      uniforms.uViewCenter.value = camera.position.y;
    },
    pose(wavelength) {
      uniforms.uBasis.value.setFromMatrix4(prism.matrixWorld);
      uniforms.uWavelength.value = (wavelength - 420) / 260 * Math.PI;
    },
  };
}
