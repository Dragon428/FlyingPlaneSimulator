/**
 * Simplified arcade controls for the airplane simulator.
 *
 * W = subir (climb)
 * S = bajar (descend)
 * A = girar izquierda (turn left)
 * D = girar derecha (turn right)
 * E = subir velocidad (speed up)
 * Q = bajar velocidad (slow down)
 * 1 = aterrizar (land and park)
 * 2 = despegar (resume all controls)
 */

export class Controls {
  constructor() {
    this.keys = {};

    // Simplified inputs (-1 to 1)
    this.vertical = 0;     // W(+1) / S(-1) → up/down
    this.horizontal = 0;   // A(-1) / D(+1) → turn left/right
    this.throttle = 0.3;   // 0 to 1
    this.landing = false;  // auto-land descending
    this.parked = false;   // airplane is parked on ground, controls locked

    // Keep for HUD compatibility
    this.brake = false;
    this.flaps = false;
    this.gear = true;

    // Event callbacks
    this.onCameraSwitch = null;
    this.onReset = null;
    this.onToggleHUD = null;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (['Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = true;

      if (!e.repeat) {
        switch (e.code) {
          case 'KeyC':
            if (this.onCameraSwitch) this.onCameraSwitch();
            break;
          case 'KeyR':
            if (this.onReset) this.onReset();
            this.parked = false;
            this.landing = false;
            break;
          case 'Digit1':
            // Start landing — only if not already parked
            if (!this.parked) {
              this.landing = true;
            }
            break;
          case 'Digit2':
            // Resume / takeoff — unlock controls
            if (this.parked) {
              this.parked = false;
              this.landing = false;
              this.throttle = 0.3; // give some initial throttle
            }
            break;
          case 'KeyH':
            if (this.onToggleHUD) this.onToggleHUD();
            break;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  update(dt) {
    // If parked, ignore all movement inputs
    if (this.parked) {
      this.vertical = 0;
      this.horizontal = 0;
      return;
    }

    // If landing, block vertical but allow turning
    if (this.landing) {
      this.vertical = 0;
    }

    const inputSpeed = 3.0;
    const returnSpeed = 2.5;

    // Vertical: W = climb (+1), S = descend (-1)
    if (this.keys['KeyW']) {
      this.vertical = Math.min(this.vertical + inputSpeed * dt, 1);
    } else if (this.keys['KeyS']) {
      this.vertical = Math.max(this.vertical - inputSpeed * dt, -1);
    } else {
      if (Math.abs(this.vertical) < 0.02) {
        this.vertical = 0;
      } else {
        this.vertical -= Math.sign(this.vertical) * returnSpeed * dt;
      }
    }

    // Horizontal: A = turn left (-1), D = turn right (+1)
    if (this.keys['KeyA']) {
      this.horizontal = Math.max(this.horizontal - inputSpeed * dt, -1);
    } else if (this.keys['KeyD']) {
      this.horizontal = Math.min(this.horizontal + inputSpeed * dt, 1);
    } else {
      if (Math.abs(this.horizontal) < 0.02) {
        this.horizontal = 0;
      } else {
        this.horizontal -= Math.sign(this.horizontal) * returnSpeed * dt;
      }
    }

    // Speed: E = increase, Q = decrease
    const throttleSpeed = 0.8;
    if (this.keys['KeyE']) {
      this.throttle = Math.min(this.throttle + throttleSpeed * dt, 1);
    }
    if (this.keys['KeyQ']) {
      this.throttle = Math.max(this.throttle - throttleSpeed * dt, 0);
    }
  }
}

export default Controls;
