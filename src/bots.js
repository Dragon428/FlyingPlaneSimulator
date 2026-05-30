import * as THREE from 'three';

/**
 * BotManager — spawns and updates 40 AI-controlled airplanes.
 * Each bot follows a state machine: PARKED → TAKEOFF → CLIMBING → CRUISING → APPROACH → LANDING → PARKED
 */

const AIRPORTS = [
  { x: 0, z: 0 },
  { x: -2500, z: 500 },
  { x: 2000, z: -2000 },
];

const BOT_COLORS = [
  0x888888,   // grey
  0x999999,   // light grey
  0xf0c030,   // yellow
  0xe8b800,   // dark yellow
  0x1565c0,   // strong blue
  0x1e88e5,   // medium blue
];

const STATES = {
  PARKED:    'PARKED',
  TAKEOFF:   'TAKEOFF',
  CLIMBING:  'CLIMBING',
  CRUISING:  'CRUISING',
  APPROACH:  'APPROACH',
  LANDING:   'LANDING',
};

const BOT_COUNT = 40;

export class BotManager {
  constructor(scene, getTerrainHeight) {
    this.scene = scene;
    this.getTerrainHeight = getTerrainHeight;
    this.bots = [];

    for (let i = 0; i < BOT_COUNT; i++) {
      this.bots.push(this._createBot(i));
    }
  }

  _createBot(index) {
    const mesh = this._buildMesh(index);
    this.scene.add(mesh);

    // Pick a random starting airport
    const apIdx = Math.floor(Math.random() * AIRPORTS.length);
    const ap = AIRPORTS[apIdx];
    const terrainY = this.getTerrainHeight(ap.x, ap.z);

    // Spread bots out: some start parked, some start already in air
    const startFlying = index >= 10; // first 10 parked, rest flying

    const bot = {
      mesh,
      state: startFlying ? STATES.CRUISING : STATES.PARKED,
      speed: startFlying ? 80 + Math.random() * 60 : 0,
      altitude: startFlying ? 150 + Math.random() * 400 : terrainY + 2.5,
      targetAltitude: startFlying ? 150 + Math.random() * 400 : 0,
      heading: Math.random() * Math.PI * 2,
      currentAirport: apIdx,
      targetAirport: -1,
      stateTimer: startFlying ? 10 + Math.random() * 40 : 2 + Math.random() * 15,
      waitTimer: 0,
      turnRate: 0,
      // Takeoff / Landing
      groundY: terrainY + 2.5,
    };

    if (startFlying) {
      // Scatter flying bots across the map
      const angle = Math.random() * Math.PI * 2;
      const dist = 500 + Math.random() * 2500;
      mesh.position.set(
        Math.cos(angle) * dist,
        bot.altitude,
        Math.sin(angle) * dist
      );
      bot.targetAirport = this._pickDifferentAirport(apIdx);
    } else {
      // Place at airport with some offset so they don't overlap
      const offset = (index % 10) * 12 - 50;
      mesh.position.set(ap.x + 50, bot.groundY, ap.z + offset);
    }

    // Set initial rotation
    const euler = new THREE.Euler(0, bot.heading, 0, 'YXZ');
    mesh.quaternion.setFromEuler(euler);

    return bot;
  }

  _buildMesh(index) {
    const group = new THREE.Group();
    const color = BOT_COLORS[index % BOT_COLORS.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.5 });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 8, 8), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 8), bodyMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -5;
    group.add(nose);

    // Cockpit glass
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
    cockpit.position.set(0, 0.5, -2.5);
    group.add(cockpit);

    // Wings
    const wingGeo = new THREE.BoxGeometry(12, 0.15, 1.8);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, -0.1, 0);
    group.add(wing);

    // Tail fin (vertical)
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 1.5), bodyMat);
    tailFin.position.set(0, 1.2, 3.5);
    group.add(tailFin);

    // Tail wings (horizontal stabilizer)
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1), bodyMat);
    tailWing.position.set(0, 0, 3.5);
    group.add(tailWing);

    // Engines (under wings)
    const engineGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.5, 6);
    const engineL = new THREE.Mesh(engineGeo, darkMat);
    engineL.rotation.x = Math.PI / 2;
    engineL.position.set(-3, -0.5, 0.5);
    group.add(engineL);

    const engineR = new THREE.Mesh(engineGeo, darkMat);
    engineR.rotation.x = Math.PI / 2;
    engineR.position.set(3, -0.5, 0.5);
    group.add(engineR);

    group.scale.setScalar(1);
    return group;
  }

  _pickDifferentAirport(currentIdx) {
    let idx;
    do {
      idx = Math.floor(Math.random() * AIRPORTS.length);
    } while (idx === currentIdx);
    return idx;
  }

  update(dt) {
    for (const bot of this.bots) {
      this._updateBot(bot, dt);
    }
  }

  _updateBot(bot, dt) {
    switch (bot.state) {
      case STATES.PARKED:
        this._stateParked(bot, dt);
        break;
      case STATES.TAKEOFF:
        this._stateTakeoff(bot, dt);
        break;
      case STATES.CLIMBING:
        this._stateClimbing(bot, dt);
        break;
      case STATES.CRUISING:
        this._stateCruising(bot, dt);
        break;
      case STATES.APPROACH:
        this._stateApproach(bot, dt);
        break;
      case STATES.LANDING:
        this._stateLanding(bot, dt);
        break;
    }

    // Update mesh position and rotation
    this._applyMovement(bot, dt);
  }

  // ── STATE: PARKED ─────────────────────────────────────────────
  _stateParked(bot, dt) {
    bot.speed = 0;
    bot.stateTimer -= dt;

    if (bot.stateTimer <= 0) {
      // Time to take off
      bot.targetAirport = this._pickDifferentAirport(bot.currentAirport);
      bot.state = STATES.TAKEOFF;
      bot.stateTimer = 0;
    }
  }

  // ── STATE: TAKEOFF ────────────────────────────────────────────
  _stateTakeoff(bot, dt) {
    // Accelerate along the runway
    bot.speed = Math.min(bot.speed + 25 * dt, 80);

    // Once fast enough, start climbing
    if (bot.speed >= 75) {
      bot.state = STATES.CLIMBING;
      bot.targetAltitude = 200 + Math.random() * 350;
    }
  }

  // ── STATE: CLIMBING ───────────────────────────────────────────
  _stateClimbing(bot, dt) {
    bot.speed = Math.min(bot.speed + 10 * dt, 55 + Math.random() * 20);

    // Climb
    bot.altitude += 20 * dt;

    // Turn towards target airport
    this._turnTowardsTarget(bot, dt);

    if (bot.altitude >= bot.targetAltitude) {
      bot.altitude = bot.targetAltitude;
      bot.state = STATES.CRUISING;
      bot.stateTimer = 5 + Math.random() * 10; // min cruise time
    }
  }

  // ── STATE: CRUISING ───────────────────────────────────────────
  _stateCruising(bot, dt) {
    // Maintain speed
    const cruiseSpeed = 45 + Math.random() * 0.1;
    bot.speed += (cruiseSpeed - bot.speed) * dt * 0.5;

    // Turn towards target airport
    this._turnTowardsTarget(bot, dt);

    bot.stateTimer -= dt;

    // Check if close to target airport
    const target = AIRPORTS[bot.targetAirport];
    const dx = target.x - bot.mesh.position.x;
    const dz = target.z - bot.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 800 && bot.stateTimer <= 0) {
      bot.state = STATES.APPROACH;
    }
  }

  // ── STATE: APPROACH ───────────────────────────────────────────
  _stateApproach(bot, dt) {
    // Slow down
    bot.speed = Math.max(bot.speed - 8 * dt, 40);

    // Descend
    const targetGroundY = this.getTerrainHeight(
      AIRPORTS[bot.targetAirport].x,
      AIRPORTS[bot.targetAirport].z
    ) + 2.5;

    bot.altitude -= 15 * dt;

    // Turn towards airport
    this._turnTowardsTarget(bot, dt);

    // Check if close enough and low enough to land
    const target = AIRPORTS[bot.targetAirport];
    const dx = target.x - bot.mesh.position.x;
    const dz = target.z - bot.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 350 && bot.altitude < targetGroundY + 60) {
      bot.state = STATES.LANDING;
      bot.groundY = targetGroundY;
    }
  }

  // ── STATE: LANDING ────────────────────────────────────────────
  _stateLanding(bot, dt) {
    // Slow down and descend
    bot.speed = Math.max(bot.speed - 12 * dt, 0);
    bot.altitude -= 10 * dt;

    // Turn towards airport
    this._turnTowardsTarget(bot, dt);

    // Touch down
    if (bot.altitude <= bot.groundY) {
      bot.altitude = bot.groundY;
      bot.speed = Math.max(bot.speed - 30 * dt, 0);

      if (bot.speed < 1) {
        bot.speed = 0;
        bot.state = STATES.PARKED;
        bot.currentAirport = bot.targetAirport;
        bot.stateTimer = 8 + Math.random() * 20; // wait before next takeoff
      }
    }
  }

  // ── HELPERS ───────────────────────────────────────────────────

  _turnTowardsTarget(bot, dt) {
    const target = AIRPORTS[bot.targetAirport];
    const dx = target.x - bot.mesh.position.x;
    const dz = target.z - bot.mesh.position.z;
    const targetHeading = Math.atan2(-dx, -dz);

    // Calculate shortest angle difference
    let diff = targetHeading - bot.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Smooth turn
    const turnSpeed = 0.8;
    bot.heading += THREE.MathUtils.clamp(diff, -turnSpeed * dt, turnSpeed * dt);

    // Normalize heading
    while (bot.heading > Math.PI) bot.heading -= Math.PI * 2;
    while (bot.heading < -Math.PI) bot.heading += Math.PI * 2;
  }

  _applyMovement(bot, dt) {
    // Forward direction from heading
    const fx = -Math.sin(bot.heading);
    const fz = -Math.cos(bot.heading);

    // Move forward
    bot.mesh.position.x += fx * bot.speed * dt;
    bot.mesh.position.z += fz * bot.speed * dt;
    bot.mesh.position.y = bot.altitude;

    // Rotation: face heading, keep level
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, bot.heading, 0, 'YXZ')
    );
    bot.mesh.quaternion.slerp(targetQuat, dt * 4);

    // Boundary wrapping
    const boundary = 3800;
    if (bot.mesh.position.x > boundary) bot.mesh.position.x = -boundary;
    if (bot.mesh.position.x < -boundary) bot.mesh.position.x = boundary;
    if (bot.mesh.position.z > boundary) bot.mesh.position.z = -boundary;
    if (bot.mesh.position.z < -boundary) bot.mesh.position.z = boundary;

    // Ground clamp
    const groundH = this.getTerrainHeight(bot.mesh.position.x, bot.mesh.position.z) + 2.5;
    if (bot.altitude < groundH) {
      bot.altitude = groundH;
      bot.mesh.position.y = groundH;
    }
  }
}
