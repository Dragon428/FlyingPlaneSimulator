import * as THREE from 'three';

class Environment {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];

    this._createFog();
    this._createSkyDome();
    this._createSunLight();
    this._createSunVisual();
    this._createAmbientLight();
    this._createClouds();
    this._createWater();
  }

  // ── Fog ────────────────────────────────────────────────────────────────
  _createFog() {
    this.scene.fog = new THREE.FogExp2(0xc9d6df, 0.00015);
  }

  // ── Sky Dome ───────────────────────────────────────────────────────────
  _createSkyDome() {
    const skyGeo = new THREE.SphereGeometry(15000, 64, 40);

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          // Normalise height to 0..1 across the dome
          float h = normalize(vWorldPosition).y;

          // Colour stops
          vec3 deepBlue   = vec3(0.039, 0.086, 0.157);  // #0a1628
          vec3 midBlue    = vec3(0.102, 0.290, 0.478);  // #1a4a7a
          vec3 horizon    = vec3(1.000, 0.420, 0.208);  // #ff6b35

          vec3 color;
          if (h > 0.3) {
            // Upper sky – mid‑blue → deep blue
            float t = clamp((h - 0.3) / 0.7, 0.0, 1.0);
            color = mix(midBlue, deepBlue, t);
          } else {
            // Lower sky – horizon → mid‑blue
            float t = clamp(h / 0.3, 0.0, 1.0);
            color = mix(horizon, midBlue, t);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);
  }

  // ── Sun (DirectionalLight) ─────────────────────────────────────────────
  _createSunLight() {
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    this.sunLight.position.set(3000, 2000, 1000);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.left = -500;
    this.sunLight.shadow.camera.right = 500;
    this.sunLight.shadow.camera.top = 500;
    this.sunLight.shadow.camera.bottom = -500;
    this.sunLight.shadow.camera.far = 5000;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  // ── Sun visual sphere ──────────────────────────────────────────────────
  _createSunVisual() {
    const sunGeo = new THREE.SphereGeometry(50, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      emissive: 0xffdd44,
      emissiveIntensity: 1,
    });
    // MeshBasicMaterial doesn't support emissive — use MeshStandardMaterial
    const sunMatStd = new THREE.MeshStandardMaterial({
      color: 0xffee88,
      emissive: 0xffdd44,
      emissiveIntensity: 2,
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMatStd);
    sunMesh.position.set(3000, 2000, 1000);
    this.scene.add(sunMesh);
  }

  // ── Ambient light (Hemisphere) ─────────────────────────────────────────
  _createAmbientLight() {
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.4);
    this.scene.add(hemiLight);
  }

  // ── Clouds ─────────────────────────────────────────────────────────────
  _createClouds() {
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      flatShading: true,
    });

    for (let i = 0; i < 80; i++) {
      const cloudGroup = new THREE.Group();

      const blobCount = 3 + Math.floor(Math.random() * 3); // 3‑5 blobs
      for (let b = 0; b < blobCount; b++) {
        const radius = 20 + Math.random() * 40;
        const blobGeo = new THREE.SphereGeometry(radius, 8, 6);
        const blob = new THREE.Mesh(blobGeo, cloudMaterial);

        blob.position.set(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 60,
        );
        blob.scale.set(
          0.8 + Math.random() * 0.6,
          0.6 + Math.random() * 0.4,
          0.8 + Math.random() * 0.6,
        );
        cloudGroup.add(blob);
      }

      cloudGroup.position.set(
        (Math.random() - 0.5) * 8000,  // −4000 … 4000
        400 + Math.random() * 400,      // 400 … 800
        (Math.random() - 0.5) * 8000,
      );

      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }

  // ── Water ──────────────────────────────────────────────────────────────
  _createWater() {
    const waterGeo = new THREE.PlaneGeometry(10000, 10000, 64, 64);
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      transparent: true,
      opacity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.water = new THREE.Mesh(waterGeo, this.waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -2;
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    this._waterTime = 0;
  }

  // ── Per‑frame update ──────────────────────────────────────────────────
  update(deltaTime) {
    // Drift clouds along +x
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.x += 5 * deltaTime;
      if (cloud.position.x > 4000) {
        cloud.position.x = -4000;
      }
    }

    // Animate water shimmer by gently oscillating the surface normal via
    // a small cyclic rotation, giving a subtle glittering effect.
    this._waterTime += deltaTime;
    const wobble = Math.sin(this._waterTime * 0.5) * 0.002;
    this.water.rotation.x = -Math.PI / 2 + wobble;
    this.water.rotation.y = Math.cos(this._waterTime * 0.3) * 0.001;
  }
}

export default Environment;
export { Environment };
