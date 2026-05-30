import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Airplane } from './airplane.js';
import { Environment } from './environment.js';
import { WorldObjects } from './objects.js';
import { Controls } from './controls.js';
import { CameraSystem } from './camera.js';
import { HUD } from './hud.js';
import { BotManager } from './bots.js';
import { EngineAudio } from './audio.js';

/**
 * 3D Airplane Flight Simulator
 * Main entry point - initializes all systems and runs the game loop.
 */
class FlightSimulator {
  constructor() {
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    this._initRenderer();
    this._initScene();
    this._waitForStart();
  }

  _waitForStart() {
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-btn');
    const loadingScreen = document.getElementById('loading-screen');

    startBtn.addEventListener('click', () => {
      // Fade out start screen
      startScreen.style.transition = 'opacity 0.6s ease';
      startScreen.style.opacity = '0';
      setTimeout(() => {
        startScreen.style.display = 'none';
        // Show loading screen
        loadingScreen.style.display = 'flex';
        // Start loading the game
        this._showLoadingProgress();
      }, 600);
    });
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.getElementById('app').appendChild(this.renderer.domElement);

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initScene() {
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.5,
      20000
    );
  }

  async _showLoadingProgress() {
    const progressBar = document.getElementById('progress-bar');
    const loadingScreen = document.getElementById('loading-screen');

    const setProgress = (pct) => {
      if (progressBar) progressBar.style.width = pct + '%';
    };

    // Step 1: Terrain
    setProgress(10);
    await this._sleep(50);

    this.terrain = new Terrain(this.scene);
    setProgress(30);
    await this._sleep(50);

    // Step 2: Environment
    this.environment = new Environment(this.scene);
    setProgress(45);
    await this._sleep(50);

    // Step 3: Airplane
    this.airplane = new Airplane(this.scene);
    setProgress(55);
    await this._sleep(50);

    // Step 4: World objects
    const getHeight = (x, z) => this.terrain.getHeightAt(x, z);
    this.worldObjects = new WorldObjects(this.scene, getHeight);
    setProgress(75);
    await this._sleep(50);

    // Step 4b: Bot airplanes
    this.botManager = new BotManager(this.scene, getHeight);
    setProgress(80);
    await this._sleep(50);

    // Step 5: Controls & Camera
    this.controls = new Controls();
    this.cameraSystem = new CameraSystem(this.camera);
    setProgress(85);
    await this._sleep(50);

    // Step 6: HUD
    this.hud = new HUD();
    this.engineAudio = new EngineAudio();
    setProgress(95);
    await this._sleep(50);

    // Wire up control callbacks
    this.controls.onCameraSwitch = () => {
      const mode = this.cameraSystem.cycleMode();
      console.log('Camera:', mode);
    };
    this.controls.onReset = () => this.airplane.reset();
    this.controls.onToggleHUD = () => this.hud.toggle();
    this.controls.onToggleMinimap = () => {};

    setProgress(100);
    await this._sleep(300);

    // Hide loading screen
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.8s ease';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 800);
    }

    // Start game loop
    this.paused = false;
    this._setupPauseMenu();
    this._animate();
  }

  _setupPauseMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('pause-resume-btn');
    const homeBtn = document.getElementById('pause-home-btn');

    // Space key toggles pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit3') {
        e.preventDefault();
        this._togglePause();
      }
    });

    // Resume button
    resumeBtn.addEventListener('click', () => this._togglePause());

    // Go to main page
    homeBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  _togglePause() {
    this.paused = !this.paused;
    const pauseMenu = document.getElementById('pause-menu');
    pauseMenu.classList.toggle('hidden', !this.paused);

    if (this.paused) {
      // Silence audio while paused
      this.engineAudio.update(0, 0, true);
    } else {
      // Reset clock so we don't get a huge dt spike
      this.clock.getDelta();
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    // Skip everything when paused
    if (this.paused) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frameCount++;

    // Update controls
    this.controls.update(dt);

    // Update airplane physics
    this.airplane.update(
      dt,
      this.controls,
      (x, z) => this.terrain.getHeightAt(x, z)
    );

    // Update camera
    this.cameraSystem.update(this.airplane, dt);

    // Update environment (clouds, water)
    this.environment.update(dt);

    // Update world objects (wind turbines, radio tower lights)
    this.worldObjects.update(dt);

    // Update bot airplanes
    this.botManager.update(dt);

    // Update engine audio
    this.engineAudio.update(this.controls.throttle, this.airplane.speed, this.controls.parked);

    // Update shadow camera to follow airplane
    this._updateShadowCamera();

    // Update HUD
    const data = this.airplane.getData();
    data.throttle = this.controls.parked ? 0 : this.controls.throttle * 100;
    data.flaps = this.controls.landing;
    data.gear = this.controls.landing || this.controls.parked || this.airplane.onGround;
    data.brake = this.controls.parked;
    this.hud.update(data);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _updateShadowCamera() {
    // Move the directional light's shadow camera to follow the airplane
    // so shadows are always rendered near the player
    const sunLight = this.scene.children.find(
      c => c instanceof THREE.DirectionalLight
    );
    if (sunLight && this.airplane) {
      const pos = this.airplane.mesh.position;
      sunLight.target.position.set(pos.x, 0, pos.z);
      sunLight.target.updateMatrixWorld();
      sunLight.position.set(pos.x + 3000, 2000, pos.z + 1000);
    }
  }
}

// Start the simulator
const sim = new FlightSimulator();
