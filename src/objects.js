import * as THREE from 'three';

/**
 * WorldObjects — creates and manages all decorative world objects
 * for the 3D airplane simulator.
 */
class WorldObjects {
  /**
   * @param {THREE.Scene} scene
   * @param {function(number, number): number} getTerrainHeight
   */
  constructor(scene, getTerrainHeight) {
    this.scene = scene;
    this.getTerrainHeight = getTerrainHeight;

    // Animation state
    this.windTurbineBladeGroups = [];
    this.radioTowerLights = [];
    this.radioBlinkTimer = 0;
    this.radioLightsVisible = true;

    // Town cluster positions (x, z)
    this.townCenters = [
      new THREE.Vector2(800, 800),
      new THREE.Vector2(-1000, -800),
      new THREE.Vector2(1500, -1200),
      new THREE.Vector2(-500, 1500),
    ];

    this._createTrees();
    this._createBuildings();
    this._createAirports();
    this._createWindTurbines();
    this._createRadioTowers();
    this._createRoads();
  }

  // ------------------------------------------------------------------
  // 1. TREES (600 instanced)
  // ------------------------------------------------------------------
  _createTrees() {
    const TREE_COUNT = 600;

    // Shared geometries
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
    const canopyGeo = new THREE.ConeGeometry(2, 5, 6);

    // Materials
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, TREE_COUNT);

    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;

    // Green shade palette for canopy instance colours
    const greenShades = [
      new THREE.Color(0x228b22),
      new THREE.Color(0x2e8b57),
      new THREE.Color(0x006400),
      new THREE.Color(0x32cd32),
      new THREE.Color(0x3cb371),
      new THREE.Color(0x1a7a1a),
      new THREE.Color(0x4caf50),
      new THREE.Color(0x0b6623),
    ];

    const dummy = new THREE.Object3D();
    let placed = 0;

    while (placed < TREE_COUNT) {
      const x = (Math.random() - 0.5) * 7000; // [-3500, 3500]
      const z = (Math.random() - 0.5) * 7000;
      const terrainY = this.getTerrainHeight(x, z);

      if (terrainY < 5 || terrainY > 80) continue;

      // Trunk — centre of cylinder sits at terrainY + 1.5 (half height)
      dummy.position.set(x, terrainY + 1.5, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(placed, dummy.matrix);

      // Canopy — sits on top of trunk: terrainY + 3 (trunk top) + 2.5 (half cone)
      dummy.position.set(x, terrainY + 3 + 2.5, z);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(placed, dummy.matrix);

      // Instance colour (canopy only, trunk stays brown)
      const shade = greenShades[Math.floor(Math.random() * greenShades.length)];
      canopyMesh.setColorAt(placed, shade);

      placed++;
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;

    this.scene.add(trunkMesh);
    this.scene.add(canopyMesh);
  }

  // ------------------------------------------------------------------
  // 2. BUILDINGS (120 — 4 clusters × 30)
  // ------------------------------------------------------------------
  _createBuildings() {
    const BUILDINGS_PER_CLUSTER = 30;
    const CLUSTER_RADIUS = 120;
    const palette = [0x4a4a5a, 0x5a5a6a, 0x6a6a7a, 0x3a3a4a, 0x8a8a9a];

    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'buildings';

    for (const center of this.townCenters) {
      for (let i = 0; i < BUILDINGS_PER_CLUSTER; i++) {
        const bw = 8 + Math.random() * 17;   // width  [8, 25]
        const bh = 15 + Math.random() * 45;  // height [15, 60]
        const bd = 8 + Math.random() * 17;   // depth  [8, 25]

        const geo = new THREE.BoxGeometry(bw, bh, bd);
        const colorHex = palette[Math.floor(Math.random() * palette.length)];
        const mat = new THREE.MeshStandardMaterial({ color: colorHex });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const ox = (Math.random() - 0.5) * CLUSTER_RADIUS * 2;
        const oz = (Math.random() - 0.5) * CLUSTER_RADIUS * 2;
        const px = center.x + ox;
        const pz = center.y + oz;
        const terrainY = this.getTerrainHeight(px, pz);

        mesh.position.set(px, terrainY + bh / 2, pz);
        buildingsGroup.add(mesh);

        // ~40 % chance of AC unit on top
        if (Math.random() < 0.4) {
          const acw = 1.5 + Math.random() * 2;
          const ach = 1 + Math.random() * 1.5;
          const acd = 1.5 + Math.random() * 2;
          const acGeo = new THREE.BoxGeometry(acw, ach, acd);
          const acMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex).offsetHSL(0, -0.05, 0.15),
          });
          const acMesh = new THREE.Mesh(acGeo, acMat);
          acMesh.castShadow = true;
          acMesh.receiveShadow = true;
          acMesh.position.set(
            px + (Math.random() - 0.5) * (bw * 0.4),
            terrainY + bh + ach / 2,
            pz + (Math.random() - 0.5) * (bd * 0.4),
          );
          buildingsGroup.add(acMesh);
        }
      }
    }

    this.scene.add(buildingsGroup);
  }

  // ------------------------------------------------------------------
  // 3. AIRPORTS (3 with large runways + buildings)
  // ------------------------------------------------------------------
  _createAirports() {
    const airports = [
      { x: 0, z: 0, name: 'Main' },
      { x: -2500, z: 500, name: 'West' },
      { x: 2000, z: -2000, name: 'Southeast' },
    ];

    airports.forEach(ap => this._buildAirport(ap.x, ap.z));
  }

  _buildAirport(cx, cz) {
    const group = new THREE.Group();
    const terrainY = this.getTerrainHeight(cx, cz);
    const baseY = terrainY + 0.1;

    // --- Materials ---
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
    const markingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.3, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x6ab7e8, metalness: 0.7, roughness: 0.1, transparent: true, opacity: 0.6 });
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.5, roughness: 0.4 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.4, roughness: 0.3 });
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95 });

    // === RUNWAY (40 wide × 600 long) ===
    const rw = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 600), runwayMat);
    rw.position.set(cx, baseY, cz);
    rw.receiveShadow = true;
    group.add(rw);

    // Center line dashes (20 dashes)
    for (let i = 0; i < 20; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 12), markingMat);
      dash.position.set(cx, baseY + 0.11, cz - 285 + i * 30);
      group.add(dash);
    }

    // Threshold markings (both ends)
    for (const endZ of [-280, 280]) {
      for (let s = -4; s <= 4; s++) {
        if (s === 0) continue;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 18), markingMat);
        stripe.position.set(cx + s * 3, baseY + 0.11, cz + endZ);
        group.add(stripe);
      }
    }

    // Edge lights
    const lightGeo = new THREE.SphereGeometry(0.4, 6, 6);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1.5 });
    for (let z = -300; z <= 300; z += 25) {
      const ll = new THREE.Mesh(lightGeo, lightMat);
      ll.position.set(cx - 20, baseY + 0.3, cz + z);
      group.add(ll);
      const rl = new THREE.Mesh(lightGeo, lightMat);
      rl.position.set(cx + 20, baseY + 0.3, cz + z);
      group.add(rl);
    }

    // Approach lights (green at threshold)
    const greenLightMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.5 });
    for (let x = -18; x <= 18; x += 4) {
      const gl = new THREE.Mesh(lightGeo, greenLightMat);
      gl.position.set(cx + x, baseY + 0.3, cz - 300);
      group.add(gl);
    }

    // === PARKING APRON (taxiway area beside runway) ===
    const apron = new THREE.Mesh(new THREE.BoxGeometry(120, 0.15, 200), apronMat);
    apron.position.set(cx + 80, baseY, cz);
    apron.receiveShadow = true;
    group.add(apron);

    // Taxiway connecting runway to apron
    const taxiway = new THREE.Mesh(new THREE.BoxGeometry(60, 0.18, 20), apronMat);
    taxiway.position.set(cx + 40, baseY + 0.02, cz);
    group.add(taxiway);

    // === TERMINAL BUILDING ===
    // Main terminal (long building)
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(80, 15, 30), terminalMat);
    terminal.position.set(cx + 100, baseY + 7.5, cz);
    terminal.castShadow = true;
    terminal.receiveShadow = true;
    group.add(terminal);

    // Terminal glass facade
    const glass = new THREE.Mesh(new THREE.BoxGeometry(80.2, 10, 0.5), glassMat);
    glass.position.set(cx + 100, baseY + 8, cz - 15);
    group.add(glass);

    // Terminal roof overhang
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(84, 1, 35),
      new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.6 })
    );
    roof.position.set(cx + 100, baseY + 15.5, cz);
    roof.castShadow = true;
    group.add(roof);

    // Second terminal floor (smaller upper section)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(50, 8, 20), terminalMat);
    upper.position.set(cx + 100, baseY + 19, cz);
    upper.castShadow = true;
    group.add(upper);

    // === CONTROL TOWER ===
    // Tower shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 45, 8), towerMat);
    shaft.position.set(cx + 130, baseY + 22.5, cz + 60);
    shaft.castShadow = true;
    group.add(shaft);

    // Tower cab (glass top)
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 8, 8), glassMat);
    cab.position.set(cx + 130, baseY + 49, cz + 60);
    group.add(cab);

    // Tower cab roof
    const cabRoof = new THREE.Mesh(
      new THREE.ConeGeometry(6, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 })
    );
    cabRoof.position.set(cx + 130, baseY + 54.5, cz + 60);
    group.add(cabRoof);

    // Red beacon on top
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 })
    );
    beacon.position.set(cx + 130, baseY + 56.5, cz + 60);
    group.add(beacon);

    // === HANGARS (3 hangars) ===
    for (let i = 0; i < 3; i++) {
      const hangar = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 25), hangarMat);
      hangar.position.set(cx + 90, baseY + 6, cz - 60 - i * 30);
      hangar.castShadow = true;
      hangar.receiveShadow = true;
      group.add(hangar);

      // Hangar door (darker front)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(20, 10, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
      );
      door.position.set(cx + 90, baseY + 5, cz - 47.5 - i * 30);
      group.add(door);
    }

    // === FUEL TANKS (2 cylinders) ===
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 2; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 12), tankMat);
      tank.position.set(cx + 145, baseY + 5, cz - 30 - i * 15);
      tank.castShadow = true;
      group.add(tank);
    }

    this.scene.add(group);
  }

  // ------------------------------------------------------------------
  // 4. WIND TURBINES (15)
  // ------------------------------------------------------------------
  _createWindTurbines() {
    const TURBINE_COUNT = 15;
    const turbinesGroup = new THREE.Group();
    turbinesGroup.name = 'windTurbines';

    const towerGeo = new THREE.CylinderGeometry(0.8, 1.2, 40, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });

    const nacelleGeo = new THREE.BoxGeometry(3, 2, 2);
    const nacelleMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });

    const bladeGeo = new THREE.BoxGeometry(0.5, 20, 0.3);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });

    for (let i = 0; i < TURBINE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 6000;
      const z = (Math.random() - 0.5) * 6000;
      const terrainY = this.getTerrainHeight(x, z);

      // Tower
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(x, terrainY + 20, z); // half height
      tower.castShadow = true;
      tower.receiveShadow = true;
      turbinesGroup.add(tower);

      // Nacelle
      const nacelle = new THREE.Mesh(nacelleGeo, nacelleMat);
      nacelle.position.set(x, terrainY + 40 + 1, z); // top of tower + half nacelle
      nacelle.castShadow = true;
      turbinesGroup.add(nacelle);

      // Blade group — pivot at nacelle front face
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(x, terrainY + 41, z + 1.1); // slightly in front of nacelle

      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, 10, 0); // offset so pivot is at bottom
        blade.castShadow = true;

        const bladePivot = new THREE.Group();
        bladePivot.rotation.z = (b * Math.PI * 2) / 3; // 0°, 120°, 240°
        bladePivot.add(blade);
        bladeGroup.add(bladePivot);
      }

      turbinesGroup.add(bladeGroup);
      this.windTurbineBladeGroups.push(bladeGroup);
    }

    this.scene.add(turbinesGroup);
  }

  // ------------------------------------------------------------------
  // 5. RADIO TOWERS (8)
  // ------------------------------------------------------------------
  _createRadioTowers() {
    const TOWER_COUNT = 8;
    const towersGroup = new THREE.Group();
    towersGroup.name = 'radioTowers';

    const towerGeo = new THREE.CylinderGeometry(0.3, 0.5, 80, 4);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.3,
    });

    const lightGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.5,
    });

    for (let i = 0; i < TOWER_COUNT; i++) {
      const x = (Math.random() - 0.5) * 7000;
      const z = (Math.random() - 0.5) * 7000;
      const terrainY = this.getTerrainHeight(x, z);

      // Tower cylinder
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(x, terrainY + 40, z); // half height
      tower.castShadow = true;
      tower.receiveShadow = true;
      towersGroup.add(tower);

      // Red blinking light on top
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(x, terrainY + 80 + 0.8, z);
      towersGroup.add(light);

      this.radioTowerLights.push(light);
    }

    this.scene.add(towersGroup);
  }

  // ------------------------------------------------------------------
  // 6. ROADS (flat strips connecting town clusters)
  // ------------------------------------------------------------------
  _createRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const roadsGroup = new THREE.Group();
    roadsGroup.name = 'roads';

    const ROAD_WIDTH = 6;
    const ROAD_HEIGHT = 0.15;
    const SEGMENT_LENGTH = 30; // build in segments so road follows terrain

    // Connect every pair of towns
    const centers = this.townCenters;
    const connected = new Set();

    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const key = `${i}-${j}`;
        if (connected.has(key)) continue;
        connected.add(key);

        const a = centers[i];
        const b = centers[j];
        const dx = b.x - a.x;
        const dz = b.y - a.y;
        const totalLength = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        const segments = Math.ceil(totalLength / SEGMENT_LENGTH);
        const segLen = totalLength / segments;

        for (let s = 0; s < segments; s++) {
          const t = (s + 0.5) / segments;
          const cx = a.x + dx * t;
          const cz = a.y + dz * t;
          const terrainY = this.getTerrainHeight(cx, cz);

          const segGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, segLen);
          const seg = new THREE.Mesh(segGeo, roadMat);
          seg.position.set(cx, terrainY + ROAD_HEIGHT / 2, cz);
          seg.rotation.y = angle;
          seg.receiveShadow = true;
          roadsGroup.add(seg);
        }
      }
    }

    this.scene.add(roadsGroup);
  }

  // ------------------------------------------------------------------
  // UPDATE (called every frame)
  // ------------------------------------------------------------------
  /**
   * @param {number} deltaTime — seconds since last frame
   */
  update(deltaTime) {
    // Rotate wind turbine blades
    const bladeSpeed = 1.2; // radians per second
    for (const bladeGroup of this.windTurbineBladeGroups) {
      bladeGroup.rotation.z += bladeSpeed * deltaTime;
    }

    // Blink radio tower lights (toggle every 1 second)
    this.radioBlinkTimer += deltaTime;
    if (this.radioBlinkTimer >= 1.0) {
      this.radioBlinkTimer -= 1.0;
      this.radioLightsVisible = !this.radioLightsVisible;
      for (const light of this.radioTowerLights) {
        light.visible = this.radioLightsVisible;
      }
    }
  }
}

export default WorldObjects;
export { WorldObjects };
