import * as THREE from 'three';

/**
 * Simplex-like noise for terrain generation.
 * Custom implementation to avoid dependencies.
 */
class SimplexNoise {
  constructor(seed = 42) {
    this.perm = new Uint8Array(512);
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    // Seed-based permutation
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  _dot3(g, x, y) {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;

    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = ((i % 256) + 256) % 256;
    const jj = ((j % 256) + 256) % 256;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

    let n0, n1, n2;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * this._dot3(this.grad3[gi0], x0, y0); }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * this._dot3(this.grad3[gi1], x1, y1); }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * this._dot3(this.grad3[gi2], x2, y2); }

    return 70.0 * (n0 + n1 + n2);
  }

  // Fractal Brownian Motion for more natural terrain
  fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let sum = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxVal = 0;

    for (let i = 0; i < octaves; i++) {
      sum += amplitude * this.noise2D(x * frequency, y * frequency);
      maxVal += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return sum / maxVal;
  }
}

/**
 * Procedural terrain with vertex coloring based on height.
 */
export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.noise = new SimplexNoise(12345);
    this.size = 8000;
    this.segments = 300;
    this.heightScale = 150;
    this.mesh = null;

    this._generate();
  }

  _generate() {
    const geometry = new THREE.PlaneGeometry(
      this.size, this.size,
      this.segments, this.segments
    );

    // Rotate to horizontal
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    // Flatten area around the runway (center of the map)
    const runwayHalfWidth = 30;
    const runwayHalfLength = 200;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      let height = this._getNoiseHeight(x, z);

      // Flatten area near runway
      const distToRunwayX = Math.abs(x);
      const distToRunwayZ = Math.abs(z);
      if (distToRunwayX < runwayHalfWidth && distToRunwayZ < runwayHalfLength) {
        const blendX = Math.max(0, 1 - distToRunwayX / runwayHalfWidth);
        const blendZ = Math.max(0, 1 - distToRunwayZ / runwayHalfLength);
        const blend = blendX * blendZ;
        height = THREE.MathUtils.lerp(height, 0.5, blend);
      } else {
        // Smooth transition near runway
        const margin = 80;
        if (distToRunwayX < runwayHalfWidth + margin && distToRunwayZ < runwayHalfLength + margin) {
          const dx = Math.max(0, distToRunwayX - runwayHalfWidth) / margin;
          const dz = Math.max(0, distToRunwayZ - runwayHalfLength) / margin;
          const d = Math.min(1, Math.sqrt(dx * dx + dz * dz));
          const smoothD = d * d * (3 - 2 * d); // smoothstep
          height = THREE.MathUtils.lerp(0.5, height, smoothD);
        }
      }

      positions.setY(i, height);

      // Color based on height
      const color = this._getColorForHeight(height);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  _getNoiseHeight(x, z) {
    const scale = 0.0008;
    // Multiple octaves of noise for varied terrain
    let h = this.noise.fbm(x * scale, z * scale, 6, 2.0, 0.5) * this.heightScale;

    // Add some larger features (mountains)
    h += this.noise.fbm(x * scale * 0.3, z * scale * 0.3, 4, 2.0, 0.6) * this.heightScale * 0.8;

    // Create some mountain ranges
    const ridgeNoise = Math.abs(this.noise.noise2D(x * scale * 0.5, z * scale * 0.5));
    h += (1 - ridgeNoise) * 60;

    // Shift down so some areas go below water (y=-2) to create lakes and coasts
    h -= 40;

    // Create specific water areas (lakes)
    const lakes = [
      { cx: -2000, cz: -2000, r: 600 },  // Large lake
      { cx: 2500, cz: 1500, r: 400 },     // Medium lake
      { cx: -1500, cz: 2500, r: 350 },    // Small lake
      { cx: 3000, cz: -1000, r: 300 },    // Pond
    ];

    for (const lake of lakes) {
      const dx = x - lake.cx;
      const dz = z - lake.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < lake.r) {
        const t = 1 - dist / lake.r;
        const smooth = t * t * (3 - 2 * t); // smoothstep
        h -= smooth * 30; // Push down into water
      }
    }

    // Flatten terrain at airport locations
    const airports = [
      { cx: 0, cz: 0, hw: 60, hl: 250 },         // Main airport (center)
      { cx: -2500, cz: 500, hw: 50, hl: 200 },    // West airport
      { cx: 2000, cz: -2000, hw: 50, hl: 200 },   // Southeast airport
    ];

    for (const ap of airports) {
      const dx = Math.abs(x - ap.cx);
      const dz = Math.abs(z - ap.cz);
      if (dx < ap.hw + 100 && dz < ap.hl + 100) {
        const bx = Math.max(0, dx - ap.hw) / 100;
        const bz = Math.max(0, dz - ap.hl) / 100;
        const d = Math.min(1, Math.sqrt(bx * bx + bz * bz));
        const smooth = d * d * (3 - 2 * d);
        h = THREE.MathUtils.lerp(2, h, smooth);
      }
    }

    return h;
  }

  _getColorForHeight(height) {
    const color = new THREE.Color();

    if (height < -5) {
      // Deep underwater
      color.setHex(0x0a4a6a);
    } else if (height < 0) {
      // Shallow water / beach transition
      const t = (height + 5) / 5;
      color.lerpColors(
        new THREE.Color(0x0a4a6a),
        new THREE.Color(0xb8a97e),
        t
      );
    } else if (height < 15) {
      // Low ground - lush green
      const t = height / 15;
      color.lerpColors(
        new THREE.Color(0x3a7d44),
        new THREE.Color(0x4a8c34),
        t
      );
    } else if (height < 50) {
      // Mid ground - darker green to brown
      const t = (height - 15) / 35;
      color.lerpColors(
        new THREE.Color(0x4a8c34),
        new THREE.Color(0x6b7c3f),
        t
      );
    } else if (height < 90) {
      // Higher - brown/rocky
      const t = (height - 50) / 40;
      color.lerpColors(
        new THREE.Color(0x6b7c3f),
        new THREE.Color(0x8a7d6b),
        t
      );
    } else if (height < 130) {
      // Mountain - gray rock
      const t = (height - 90) / 40;
      color.lerpColors(
        new THREE.Color(0x8a7d6b),
        new THREE.Color(0x9a9a9a),
        t
      );
    } else {
      // Snow caps
      const t = Math.min(1, (height - 130) / 30);
      color.lerpColors(
        new THREE.Color(0x9a9a9a),
        new THREE.Color(0xf0f0f0),
        t
      );
    }

    // Add slight random variation
    const variation = 0.95 + Math.random() * 0.1;
    color.multiplyScalar(variation);

    return color;
  }

  /**
   * Get terrain height at world coordinates (x, z).
   * Uses bilinear interpolation on the terrain mesh.
   */
  getHeightAt(x, z) {
    // Clamp to terrain bounds
    const halfSize = this.size / 2;
    const cx = THREE.MathUtils.clamp(x, -halfSize, halfSize);
    const cz = THREE.MathUtils.clamp(z, -halfSize, halfSize);

    // Convert world coords to grid coords
    const gridX = ((cx + halfSize) / this.size) * this.segments;
    const gridZ = ((cz + halfSize) / this.size) * this.segments;

    // Grid cell indices
    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    // Clamp indices
    const ix0 = Math.min(ix, this.segments);
    const iz0 = Math.min(iz, this.segments);
    const ix1 = Math.min(ix + 1, this.segments);
    const iz1 = Math.min(iz + 1, this.segments);

    const positions = this.mesh.geometry.attributes.position;
    const stride = this.segments + 1;

    // Get heights at 4 corners
    const h00 = positions.getY(iz0 * stride + ix0);
    const h10 = positions.getY(iz0 * stride + ix1);
    const h01 = positions.getY(iz1 * stride + ix0);
    const h11 = positions.getY(iz1 * stride + ix1);

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
  }
}

export default Terrain;
