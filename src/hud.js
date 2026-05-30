/**
 * HUD – Heads-Up Display overlay for the airplane simulator.
 *
 * Creates and manages DOM elements overlaid on the 3D canvas.
 * All DOM creation is self-contained (no external HTML required).
 */
export class HUD {
  /**
   * Build every instrument panel and append them to the page.
   */
  constructor() {
    /* ── root container ─────────────────────────────────────────── */
    this.container = this._el('div', { id: 'hud-container' });
    document.body.appendChild(this.container);

    /* ── 1. Speed panel (top-left) ──────────────────────────────── */
    this.speedPanel = this._panel('hud-speed');
    this.speedLabel = this._label('Airspeed');
    this.speedValue = this._value('hud-value--speed');
    this.speedUnit  = this._unit('KTS');
    this.speedValue.appendChild(this.speedUnit);
    this.speedPanel.append(this.speedLabel, this.speedValue);

    /* ── 2. Altitude panel (top-left, below speed) ──────────────── */
    this.altPanel = this._panel('hud-altitude');
    this.altLabel = this._label('Altitude');
    this.altValue = this._value('hud-value--altitude');
    this.altUnit  = this._unit('FT');
    this.altValue.appendChild(this.altUnit);
    this.altPanel.append(this.altLabel, this.altValue);

    /* ── 3. Heading / compass (top-center) ──────────────────────── */
    this.headingPanel = this._panel('hud-heading');
    this.headingLabel = this._label('Heading');
    this.headingValue = this._value('hud-value--heading');
    this.headingStrip = this._el('div', { className: 'hud-compass-strip' });
    this.headingTicks = [];
    for (let i = 0; i < 5; i++) {
      const tick = this._el('span', {
        className: i === 2 ? 'hud-compass-tick hud-compass-tick--active' : 'hud-compass-tick',
      });
      this.headingTicks.push(tick);
      this.headingStrip.appendChild(tick);
    }
    this.headingPanel.append(this.headingLabel, this.headingValue, this.headingStrip);

    /* ── 4. Throttle bar (left-center) ──────────────────────────── */
    this.throttlePanel = this._panel('hud-throttle');
    this.throttleLabel = this._label('THR');
    this.throttleTrack = this._el('div', { className: 'hud-throttle-track' });
    this.throttleFill  = this._el('div', { className: 'hud-throttle-fill' });
    this.throttleTrack.appendChild(this.throttleFill);
    this.throttlePct = this._el('span', { className: 'hud-throttle-pct', textContent: '0 %' });
    this.throttlePanel.append(this.throttleLabel, this.throttleTrack, this.throttlePct);

    /* ── 10. Controls help (top-right) ─────────────────────────── */
    this.controlsPanel = this._panel('hud-controls');
    const ctrlTitle = this._el('div', { className: 'hud-controls-title', textContent: 'Controls' });
    this.controlsPanel.appendChild(ctrlTitle);

    const bindings = [
      ['W',       'Climb'],
      ['S',       'Descend'],
      ['A',       'Turn left'],
      ['D',       'Turn right'],
      ['E',       'Speed up'],
      ['Q',       'Speed down'],
      ['1',       'Land'],
      ['2',       'Take off'],
      ['H',       'Toggle HUD'],
      ['C',       'Switch camera'],
      ['R',       'Reset position'],
      ['3',       'Pause'],
    ];

    bindings.forEach(([key, desc]) => {
      const row  = this._el('div', { className: 'hud-controls-row' });
      const kEl  = this._el('span', { className: 'hud-controls-key', textContent: key });
      const dEl  = this._el('span', { className: 'hud-controls-desc', textContent: desc });
      row.append(kEl, dEl);
      this.controlsPanel.appendChild(row);
    });

    /* ── Append all panels ─────────────────────────────────────── */
    this.container.append(
      this.speedPanel,
      this.altPanel,
      this.headingPanel,
      this.throttlePanel,
      this.controlsPanel,
    );

    /* Track visibility state */
    this._visible     = true;
    this._helpVisible = true;
  }

  /* ================================================================
   *  update(airplaneData)
   * ================================================================ */

  /**
   * Refresh every instrument with the latest flight data.
   *
   * @param {Object} d
   * @param {number} d.speed
   * @param {number} d.altitude
   * @param {number} d.heading
   * @param {number} d.pitch
   * @param {number} d.roll
   * @param {number} d.throttle
   * @param {number} d.verticalSpeed
   * @param {number} d.gForce
   * @param {boolean} d.flaps
   * @param {boolean} d.gear
   * @param {boolean} d.brake
   * @param {{x:number, y:number, z:number}} d.position
   */
  update(d) {
    if (!d) return;

    /* 1 — Speed -------------------------------------------------- */
    this._setText(this.speedValue, Math.round(d.speed), this.speedUnit);

    /* 2 — Altitude ----------------------------------------------- */
    this._setText(this.altValue, Math.round(d.altitude).toLocaleString(), this.altUnit);

    /* 3 — Heading ------------------------------------------------ */
    const hdg = ((Math.round(d.heading) % 360) + 360) % 360;
    this.headingValue.textContent = `${String(hdg).padStart(3, '0')}°`;
    // compass strip ticks
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const step = 45;
    const baseIdx = Math.round(hdg / step) % 8;
    for (let i = 0; i < 5; i++) {
      const offset = i - 2;
      const idx = ((baseIdx + offset) % 8 + 8) % 8;
      this.headingTicks[i].textContent = cardinals[idx];
    }

    /* 4 — Throttle ----------------------------------------------- */
    const thr = Math.max(0, Math.min(100, d.throttle));
    this.throttleFill.style.height = `${thr}%`;
    this.throttlePct.textContent = `${Math.round(thr)} %`;

  }

  /* ================================================================
   *  toggle / toggleHelp
   * ================================================================ */

  /** Show or hide the entire HUD overlay. */
  toggle() {
    this._visible = !this._visible;
    this.container.classList.toggle('hidden', !this._visible);
  }

  /** Show or hide just the controls-help panel. */
  toggleHelp() {
    this._helpVisible = !this._helpVisible;
    this.controlsPanel.classList.toggle('hidden', !this._helpVisible);
  }

  /* ================================================================
   *  Private helpers
   * ================================================================ */

  /**
   * Create a DOM element with optional properties.
   * @param {string} tag
   * @param {Object} [props]
   * @returns {HTMLElement}
   */
  _el(tag, props = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    return el;
  }

  /** Create a panel div with the glassmorphism base class. */
  _panel(extraClass) {
    return this._el('div', { className: `hud-panel ${extraClass}` });
  }

  /** Create a label element. */
  _label(text) {
    return this._el('div', { className: 'hud-label', textContent: text });
  }

  /** Create a value element with an extra colour class. */
  _value(colorClass) {
    return this._el('div', { className: `hud-value ${colorClass}` });
  }

  /** Create a unit span. */
  _unit(text) {
    return this._el('span', { className: 'hud-unit', textContent: text });
  }

  /** Set text content of a value element while preserving a trailing unit span. */
  _setText(valueEl, text, unitSpan) {
    valueEl.childNodes.forEach((n) => { if (n !== unitSpan) valueEl.removeChild(n); });
    valueEl.insertBefore(document.createTextNode(String(text)), unitSpan);
  }

  /** Set a status dot to active (green) or inactive (gray). */
  _setDot(dot, active, warn = false) {
    dot.className = 'hud-status-dot';
    if (active) dot.classList.add(warn ? 'hud-status-dot--warn' : 'hud-status-dot--active');
  }

  /* ── Minimap ──────────────────────────────────────────────────── */

  /**
   * Draw a top-down minimap showing terrain and airplane marker.
   * @param {Object} d  airplaneData
   */
  _drawMinimap(d) {
    const ctx = this.minimapCtx;
    const w = 300;
    const h = 300;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const p = (i / 6) * w;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }

    // Terrain (green square centred)
    const terrainSize = 180;
    const pos = d.position || { x: 0, y: 0, z: 0 };

    // Map world position to minimap — scale: 1 unit = 0.06 px
    const scale = 0.06;
    const terrainX = w / 2 - terrainSize / 2 - pos.x * scale;
    const terrainZ = h / 2 - terrainSize / 2 - pos.z * scale;

    ctx.fillStyle = 'rgba(30, 120, 55, 0.35)';
    ctx.strokeStyle = 'rgba(60, 180, 90, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(terrainX, terrainZ, terrainSize, terrainSize);
    ctx.strokeRect(terrainX, terrainZ, terrainSize, terrainSize);

    // Runway line on terrain
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(terrainX + terrainSize / 2, terrainZ + 20);
    ctx.lineTo(terrainX + terrainSize / 2, terrainZ + terrainSize - 20);
    ctx.stroke();

    // Airplane marker (white triangle, always centred, rotated by heading)
    const cx = w / 2;
    const cy = h / 2;
    const size = 10;
    const angle = ((d.heading || 0) - 90) * (Math.PI / 180);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.lineTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // Compass rose labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '600 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', w / 2, 14);
    ctx.fillText('S', w / 2, h - 10);
    ctx.fillText('W', 10, h / 2);
    ctx.fillText('E', w - 10, h / 2);
  }
}
