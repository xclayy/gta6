// input.js — keyboard and mouse state. Edge-triggered "pressed" flags are
// consumed once per frame by the game loop, so a single key tap never
// double-fires a menu action or a car entry.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get up() { return this.keys.has('w') || this.keys.has('arrowup'); }
  get down() { return this.keys.has('s') || this.keys.has('arrowdown'); }
  get left() { return this.keys.has('a') || this.keys.has('arrowleft'); }
  get right() { return this.keys.has('d') || this.keys.has('arrowright'); }
  get run() { return this.keys.has('shift'); }
  get handbrake() { return this.keys.has(' '); }

  get enterPressed() { return this.consume('e') || this.consume('f'); }
  get pausePressed() { return this.consume('escape') || this.consume('p'); }
  get phonePressed() { return this.consume('t'); }
  get radioPressed() { return this.consume('r'); }
  get weaponPressed() { return this.consume('q'); }
  get interactPressed() { return this.consume('e'); }

  consume(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  consumeMouse() {
    if (this.mousePressed) {
      this.mousePressed = false;
      return true;
    }
    return false;
  }

  // Called at the end of every frame: edge flags live for exactly one frame.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
  }
}
