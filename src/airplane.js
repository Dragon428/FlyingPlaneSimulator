import * as THREE from 'three';

/**
 * Airplane model built from Three.js geometry with simplified aerodynamic physics.
 */
export class Airplane {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // Physics state
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.speed = 0;           // forward speed (m/s)
    this.verticalSpeed = 0;
    this.onGround = true;
    this.gForce = 1.0;
    this.previousVelocityY = 0;

    // Airplane specs
    this.mass = 1200;          // kg
    this.maxThrust = 18000;    // N
    this.wingArea = 16;        // m²
    this.dragCoeff = 0.022;
    this.liftCoeff = 1.2;
    this.maxSpeed = 180;       // m/s (~350 knots)

    // Control surfaces
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawRate = 0;

    // Components
    this.propeller = null;
    this.leftAileron = null;
    this.rightAileron = null;


    this._buildModel();


    // Initial position on runway
    this.mesh.position.set(0, 3, 80);
    scene.add(this.mesh);
  }

  _buildModel() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      metalness: 0.3,
      roughness: 0.4,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x1a5276,
      metalness: 0.4,
      roughness: 0.3,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.5,
      roughness: 0.3,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x85c1e9,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    const redMat = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.3,
      roughness: 0.4,
    });

    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x27ae60,
      metalness: 0.3,
      roughness: 0.4,
    });

    // === Fuselage ===
    const fuselageGeom = new THREE.CylinderGeometry(1.0, 0.7, 12, 12);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.castShadow = true;
    this.mesh.add(fuselage);

    // Nose cone
    const noseGeom = new THREE.ConeGeometry(0.7, 3, 12);
    noseGeom.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, darkMat);
    nose.position.z = -7.5;
    nose.castShadow = true;
    this.mesh.add(nose);

    // Cockpit glass
    const cockpitGeom = new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeom, glassMat);
    cockpit.position.set(0, 0.6, -3);
    cockpit.scale.set(1, 0.6, 1.5);
    this.mesh.add(cockpit);

    // Stripe
    const stripeGeom = new THREE.BoxGeometry(0.05, 0.4, 12);
    const stripeL = new THREE.Mesh(stripeGeom, accentMat);
    stripeL.position.set(1.0, 0, 0);
    this.mesh.add(stripeL);
    const stripeR = new THREE.Mesh(stripeGeom, accentMat);
    stripeR.position.set(-1.0, 0, 0);
    this.mesh.add(stripeR);

    // === Wings ===
    const wingGeom = new THREE.BoxGeometry(18, 0.15, 2.5);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.set(0, -0.2, 0.5);
    wing.castShadow = true;
    this.mesh.add(wing);

    // Wing tips (colored)
    const wingTipGeomL = new THREE.BoxGeometry(0.3, 0.2, 0.8);
    const wingTipL = new THREE.Mesh(wingTipGeomL, redMat);
    wingTipL.position.set(-9.1, -0.2, 0.5);
    this.mesh.add(wingTipL);

    const wingTipR = new THREE.Mesh(wingTipGeomL.clone(), greenMat);
    wingTipR.position.set(9.1, -0.2, 0.5);
    this.mesh.add(wingTipR);

    // Wing nav lights (emissive)
    const navLightGeom = new THREE.SphereGeometry(0.12, 6, 6);
    const redNavMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });
    const greenNavMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 2 });

    const navL = new THREE.Mesh(navLightGeom, redNavMat);
    navL.position.set(-9.2, -0.1, 0.5);
    this.mesh.add(navL);

    const navR = new THREE.Mesh(navLightGeom, greenNavMat);
    navR.position.set(9.2, -0.1, 0.5);
    this.mesh.add(navR);

    // === Tail Section ===
    // Vertical stabilizer
    const vStabGeom = new THREE.BoxGeometry(0.15, 3, 2.5);
    const vStab = new THREE.Mesh(vStabGeom, bodyMat);
    vStab.position.set(0, 1.5, 5.5);
    vStab.castShadow = true;
    this.mesh.add(vStab);

    // Rudder accent
    const rudderAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.5, 1),
      accentMat
    );
    rudderAccent.position.set(0, 2.3, 6.2);
    this.mesh.add(rudderAccent);

    // Horizontal stabilizer
    const hStabGeom = new THREE.BoxGeometry(6, 0.12, 1.8);
    const hStab = new THREE.Mesh(hStabGeom, bodyMat);
    hStab.position.set(0, 0.3, 5.5);
    hStab.castShadow = true;
    this.mesh.add(hStab);

    // Tail light
    const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
    const tailLight = new THREE.Mesh(navLightGeom, tailLightMat);
    tailLight.position.set(0, 0, 6.5);
    this.mesh.add(tailLight);

    // === Propeller ===
    this.propeller = new THREE.Group();
    const hubGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
    hubGeom.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeom, darkMat);
    this.propeller.add(hub);

    const bladeGeom = new THREE.BoxGeometry(0.2, 2.5, 0.08);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeom, darkMat);
      blade.rotation.z = (i * Math.PI * 2) / 3;
      this.propeller.add(blade);
    }
    this.propeller.position.z = -9;
    this.mesh.add(this.propeller);

    // === Landing Gear ===
    this.landingGear = new THREE.Group();

    const strutMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    // Front gear
    const frontStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), strutMat);
    frontStrut.position.set(0, -1.2, -3);
    this.landingGear.add(frontStrut);

    const frontWheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 12), wheelMat);
    frontWheel.position.set(0, -2, -3);
    frontWheel.rotation.y = Math.PI / 2;
    this.landingGear.add(frontWheel);

    // Left main gear
    const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), strutMat);
    leftStrut.position.set(-2.5, -1.2, 1);
    this.landingGear.add(leftStrut);

    const leftWheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 12), wheelMat);
    leftWheel.position.set(-2.5, -2, 1);
    leftWheel.rotation.y = Math.PI / 2;
    this.landingGear.add(leftWheel);

    // Right main gear
    const rightStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), strutMat);
    rightStrut.position.set(2.5, -1.2, 1);
    this.landingGear.add(rightStrut);

    const rightWheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 12), wheelMat);
    rightWheel.position.set(2.5, -2, 1);
    rightWheel.rotation.y = Math.PI / 2;
    this.landingGear.add(rightWheel);

    this.mesh.add(this.landingGear);

    // === Engine nacelles (wing-mounted visual) ===
    const nacelleGeom = new THREE.CylinderGeometry(0.4, 0.5, 2, 8);
    nacelleGeom.rotateX(Math.PI / 2);
    const nacelleL = new THREE.Mesh(nacelleGeom, darkMat);
    nacelleL.position.set(-4, -0.6, 0);
    nacelleL.castShadow = true;
    this.mesh.add(nacelleL);

    const nacelleR = new THREE.Mesh(nacelleGeom.clone(), darkMat);
    nacelleR.position.set(4, -0.6, 0);
    nacelleR.castShadow = true;
    this.mesh.add(nacelleR);
  }



  update(dt, controls, getTerrainHeight) {
    // Clamp dt to avoid physics explosion
    dt = Math.min(dt, 0.05);

    const throttle = controls.throttle;
    const verticalInput = controls.vertical;     // W(+1) / S(-1)
    const horizontalInput = controls.horizontal; // A(-1) / D(+1)
    const autoLand = controls.landing;
    const parked = controls.parked;

    // === PARKED STATE: airplane is stopped, do nothing ===
    if (parked) {
      this.velocity.set(0, 0, 0);
      this.speed = 0;
      this.verticalSpeed = 0;
      this.gForce = 1.0;

      // Keep on ground
      const terrainH = getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = terrainH + 2.5;
      this.onGround = true;

      // Keep level
      const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
      const levelQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, euler.y, 0, 'YXZ')
      );
      this.mesh.quaternion.slerp(levelQuat, dt * 5);

      // Landing gear visible
      if (this.landingGear) this.landingGear.visible = true;

      // Propeller stopped
      return;
    }

    // === Propeller animation ===
    if (this.propeller) {
      this.propeller.rotation.z += throttle * 80 * dt;
    }

    // === Landing gear: show during landing or on ground ===
    if (this.landingGear) {
      this.landingGear.visible = autoLand || this.onGround;
    }

    // === Turning: A/D = pure yaw rotation (works always, even during landing) ===
    const yawSpeed = 1.5;
    if (Math.abs(horizontalInput) > 0.01) {
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -horizontalInput * yawSpeed * dt
      );
      this.mesh.quaternion.premultiply(yawQuat);
    }

    // === KEEP AIRPLANE PERFECTLY LEVEL (no pitch, no roll) ===
    const currentEuler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    const flatQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, currentEuler.y, 0, 'YXZ')
    );
    this.mesh.quaternion.slerp(flatQuat, dt * 8);
    this.mesh.quaternion.normalize();

    // === Get forward direction AFTER turning ===
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, euler.y, 0, 'YXZ')
    );
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawOnly);

    // === Speed as a scalar — always moves in the forward direction ===
    // Accelerate with throttle, decelerate with drag
    const thrustAccel = (throttle * this.maxThrust) / this.mass;
    const dragDecel = this.dragCoeff * 0.5 * 1.225 * this.speed * this.speed * this.wingArea / this.mass;

    this.speed += (thrustAccel - dragDecel) * dt;

    // Ground friction when on ground and no throttle
    if (this.onGround && throttle < 0.05) {
      this.speed -= 5 * dt;
    }

    // Clamp speed
    this.speed = THREE.MathUtils.clamp(this.speed, 0, this.maxSpeed);

    // === Vertical movement ===
    let verticalAcceleration = 0;

    if (autoLand) {
      // AUTO-LAND: descend slowly
      const terrainH = getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
      const groundLevel = terrainH + 2.5;
      const altAboveGround = this.mesh.position.y - groundLevel;

      if (altAboveGround > 2) {
        verticalAcceleration = -15;
        controls.throttle = Math.max(controls.throttle - 0.3 * dt, 0.02);
      } else if (altAboveGround > 0.1) {
        verticalAcceleration = -6;
        controls.throttle = Math.max(controls.throttle - 0.3 * dt, 0);
      } else {
        // Touched down → PARK
        this.mesh.position.y = groundLevel;
        this.velocity.set(0, 0, 0);
        this.speed = 0;
        this.onGround = true;
        controls.landing = false;
        controls.parked = true;
        controls.throttle = 0;
        return;
      }

    } else if (!this.onGround) {
      const climbRate = 70; // fast climb/descend
      if (Math.abs(verticalInput) > 0.05) {
        verticalAcceleration = verticalInput * climbRate;
      } else {
        verticalAcceleration = -1.5; // gentle gravity
      }
    }

    // Update vertical velocity
    this.velocity.y += verticalAcceleration * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -35, 35);

    // === REBUILD horizontal velocity from forward × speed ===
    // This is the key: velocity ALWAYS points where the airplane faces
    this.velocity.x = forward.x * this.speed;
    this.velocity.z = forward.z * this.speed;

    // === Update position ===
    this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

    // === Ground collision ===
    const terrainH = getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
    const groundLevel = terrainH + 2.5;

    if (this.mesh.position.y <= groundLevel) {
      this.mesh.position.y = groundLevel;
      this.onGround = true;
      this.velocity.y = 0;

      if (this.speed < 0.5 && throttle < 0.05) {
        this.speed = 0;
        this.velocity.set(0, 0, 0);
      }
    } else {
      this.onGround = false;
    }

    // === Boundary wrapping ===
    const boundary = 3800;
    if (this.mesh.position.x > boundary) this.mesh.position.x = -boundary;
    if (this.mesh.position.x < -boundary) this.mesh.position.x = boundary;
    if (this.mesh.position.z > boundary) this.mesh.position.z = -boundary;
    if (this.mesh.position.z < -boundary) this.mesh.position.z = boundary;

    // === Max altitude ===
    if (this.mesh.position.y > 2000) {
      this.mesh.position.y = 2000;
      this.velocity.y = Math.min(0, this.velocity.y);
    }

    // === Update derived values ===
    this.verticalSpeed = this.velocity.y;
    const vAccel = (this.velocity.y - this.previousVelocityY) / Math.max(dt, 0.001);
    this.gForce = 1.0 + vAccel / 9.81;
    this.gForce = THREE.MathUtils.clamp(this.gForce, -2, 5);
    this.previousVelocityY = this.velocity.y;

  }



  /**
   * Get current flight data for the HUD.
   */
  getData() {
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    let heading = THREE.MathUtils.radToDeg(-euler.y) % 360;
    if (heading < 0) heading += 360;

    return {
      speed: this.speed * 1.944,           // m/s to knots
      altitude: Math.max(0, this.mesh.position.y * 3.281), // m to feet
      heading: heading,
      pitch: THREE.MathUtils.radToDeg(euler.x),
      roll: THREE.MathUtils.radToDeg(euler.z),
      throttle: 0,  // set by main loop
      verticalSpeed: this.verticalSpeed * 196.85,  // m/s to ft/min
      gForce: this.gForce,
      flaps: false,
      gear: true,
      brake: false,
      position: {
        x: this.mesh.position.x,
        y: this.mesh.position.y,
        z: this.mesh.position.z
      }
    };
  }

  /**
   * Reset airplane to runway.
   */
  reset() {
    this.mesh.position.set(0, 3, 80);
    this.mesh.quaternion.identity();
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.gForce = 1;
    this.previousVelocityY = 0;
  }
}

export default Airplane;
