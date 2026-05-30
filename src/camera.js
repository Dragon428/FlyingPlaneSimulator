import * as THREE from 'three';

/**
 * Camera system that properly follows the airplane's heading.
 * The camera stays behind the airplane and rotates when it turns.
 */
export class CameraSystem {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0=chase, 1=cockpit, 2=free
    this.modes = ['CHASE', 'COCKPIT', 'FREE'];

    // Chase camera params
    this.chaseDistance = 30;    // distance behind
    this.chaseHeight = 10;     // height above
    this.chaseLookAhead = 20;  // how far ahead to look
    this.smoothPosition = new THREE.Vector3();
    this.smoothLookAt = new THREE.Vector3();
    this.initialized = false;

    // Free camera params
    this.freeAngle = 0;
    this.freeElevation = 0.3;
    this.freeDistance = 50;

    this._setupFreeControls();
  }

  _setupFreeControls() {
    window.addEventListener('wheel', (e) => {
      if (this.mode === 2) {
        this.freeDistance = THREE.MathUtils.clamp(
          this.freeDistance + e.deltaY * 0.05,
          15, 200
        );
      }
    });

    let isDragging = false;
    let lastX = 0, lastY = 0;

    window.addEventListener('mousedown', (e) => {
      if (this.mode === 2) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging && this.mode === 2) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        this.freeAngle -= dx * 0.005;
        this.freeElevation = THREE.MathUtils.clamp(
          this.freeElevation + dy * 0.005,
          -0.5, 1.2
        );
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  cycleMode() {
    this.mode = (this.mode + 1) % 3;
    this.initialized = false;
    return this.modes[this.mode];
  }

  getModeName() {
    return this.modes[this.mode];
  }

  update(airplane, dt) {
    if (!airplane || !airplane.mesh) return;

    const airplanePos = airplane.mesh.position;
    const airplaneQuat = airplane.mesh.quaternion;

    switch (this.mode) {
      case 0: this._updateChase(airplanePos, airplaneQuat, dt); break;
      case 1: this._updateCockpit(airplanePos, airplaneQuat, dt); break;
      case 2: this._updateFree(airplanePos, dt); break;
    }
  }

  _updateChase(pos, quat, dt) {
    // Get the airplane's forward direction (only yaw, ignore pitch/roll)
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, euler.y, 0, 'YXZ')
    );

    // Camera position: behind and above, using yaw-only rotation
    // so camera doesn't tilt when airplane pitches
    const behind = new THREE.Vector3(0, this.chaseHeight, this.chaseDistance);
    behind.applyQuaternion(yawOnly);
    const desiredPos = pos.clone().add(behind);

    // Look at point: ahead of the airplane
    const ahead = new THREE.Vector3(0, 2, -this.chaseLookAhead);
    ahead.applyQuaternion(yawOnly);
    const desiredLookAt = pos.clone().add(ahead);

    if (!this.initialized) {
      this.smoothPosition.copy(desiredPos);
      this.smoothLookAt.copy(desiredLookAt);
      this.initialized = true;
    }

    // Fast follow for turning — camera should keep up with yaw changes
    // Using a high lerp factor so it feels responsive
    const posSmoothFactor = 1 - Math.pow(0.0001, dt); // ~0.92 per frame at 60fps
    const lookSmoothFactor = 1 - Math.pow(0.00001, dt); // even faster for look target

    this.smoothPosition.lerp(desiredPos, posSmoothFactor);
    this.smoothLookAt.lerp(desiredLookAt, lookSmoothFactor);

    this.camera.position.copy(this.smoothPosition);
    this.camera.lookAt(this.smoothLookAt);
  }

  _updateCockpit(pos, quat, dt) {
    // Get yaw-only rotation for stable cockpit view
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, euler.y, 0, 'YXZ')
    );

    const cockpitOffset = new THREE.Vector3(0, 2, -3);
    cockpitOffset.applyQuaternion(yawOnly);
    const camPos = pos.clone().add(cockpitOffset);

    const forward = new THREE.Vector3(0, 0, -50);
    forward.applyQuaternion(yawOnly);
    const lookAt = camPos.clone().add(forward);

    if (!this.initialized) {
      this.camera.position.copy(camPos);
      this.initialized = true;
    }

    const smoothFactor = 1 - Math.pow(0.00005, dt);
    this.camera.position.lerp(camPos, smoothFactor);
    this.camera.lookAt(lookAt);
  }

  _updateFree(pos, dt) {
    const x = pos.x + this.freeDistance * Math.cos(this.freeAngle) * Math.cos(this.freeElevation);
    const y = pos.y + this.freeDistance * Math.sin(this.freeElevation) + 10;
    const z = pos.z + this.freeDistance * Math.sin(this.freeAngle) * Math.cos(this.freeElevation);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(pos);
  }
}

export default CameraSystem;
