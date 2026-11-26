// input.js — keyboard and mouse, gathered in one place. The flight model
// reads smooth axes from here; menus read edge-triggered presses. Mouse
// steering is simple: the pointer's offset from the canvas centre is where
// the pilot is pointing the nose, and the keyboard wins whenever it speaks.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = new Set();
    this.mouse = { nx: 0, ny: 0, seen: false, down: false };
    this.enabled = true;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.edges.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      this.mouse.seen = true;
    });
    canvas.addEventListener('pointerdown', () => { this.mouse.down = true; });
    window.addEventListener('pointerup', () => { this.mouse.down = false; });
  }

  down(code) {
    return this.keys.has(code);
  }

  // Edge-triggered press: true once per physical press, then consumed.
  pressed(code) {
    if (this.edges.has(code)) {
      this.edges.delete(code);
      return true;
    }
    return false;
  }

  // The stick: pitch positive pulls the nose up, bank positive rolls right.
  stick() {
    let pitch = 0;
    let bank = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) pitch += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) pitch -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) bank += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) bank -= 1;
    if (pitch === 0 && bank === 0 && this.mouse.seen) {
      const dead = 0.07;
      const mx = Math.abs(this.mouse.nx) < dead ? 0 : this.mouse.nx;
      const my = Math.abs(this.mouse.ny) < dead ? 0 : this.mouse.ny;
      bank = clamp(mx * 1.25, -1, 1);
      pitch = clamp(-my * 1.15, -1, 1);
    }
    return { pitch, bank };
  }

  throttleDelta() {
    let delta = 0;
    if (this.down('KeyR') || this.down('PageUp')) delta += 1;
    if (this.down('KeyF') || this.down('PageDown')) delta -= 1;
    return delta;
  }

  brake() {
    return this.down('KeyB');
  }
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}
