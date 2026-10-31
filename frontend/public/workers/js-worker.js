/* ตัวรัน JavaScript ในเบราว์เซอร์ผู้ใช้ — อยู่ใน Web Worker จึงเข้าถึงหน้าเว็บ/cookie/localStorage ไม่ได้
   และฝั่งหน้าเว็บสั่ง terminate ได้ทุกเมื่อ (เช่น เมื่อเจอ loop ไม่รู้จบ) */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function format(value) {
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return value.toString();
  if (typeof value === "symbol" || typeof value === "bigint") return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    const text = JSON.stringify(value, null, 2);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

/* turtle:start — เต่าวาดภาพ (API คู่กับ turtle ของ Python) ไม่ได้วาดเอง แค่เก็บคำสั่งแล้วส่งให้หน้าเว็บวาด */
function createTurtleApi() {
  const MAX_COMMANDS = 20000;
  const commands = [];
  const state = { bg: null, truncated: false };
  const turtles = [];

  function add(command, at) {
    if (commands.length >= MAX_COMMANDS) {
      state.truncated = true;
      return;
    }
    if (at === undefined) commands.push(command);
    else commands.splice(at, 0, command);
  }

  function colorText(value) {
    if (Array.isArray(value) && value.length === 3) {
      let [r, g, b] = value.map(Number);
      if (Math.max(r, g, b) <= 1) [r, g, b] = [r * 255, g * 255, b * 255];
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    }
    return String(value);
  }

  class Turtle {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.angle = 0;
      this.pen = true;
      this.penColor = "black";
      this.fillColorValue = "black";
      this.lineWidth = 1;
      this.shown = true;
      this.fillStart = null;
      this.fillPoints = [];
      turtles.push(this);
    }
    go(nx, ny) {
      if (this.pen) {
        add({ t: "line", x1: this.x, y1: this.y, x2: nx, y2: ny, c: this.penColor, w: this.lineWidth });
      }
      this.x = nx;
      this.y = ny;
      if (this.fillStart !== null) this.fillPoints.push([nx, ny]);
    }
    forward(distance) {
      const rad = (this.angle * Math.PI) / 180;
      this.go(this.x + distance * Math.cos(rad), this.y + distance * Math.sin(rad));
      return this;
    }
    back(distance) {
      return this.forward(-distance);
    }
    left(degrees) {
      this.angle = (((this.angle + degrees) % 360) + 360) % 360;
      return this;
    }
    right(degrees) {
      return this.left(-degrees);
    }
    goto(x, y) {
      this.go(Number(x), Number(y));
      return this;
    }
    setHeading(degrees) {
      this.angle = ((degrees % 360) + 360) % 360;
      return this;
    }
    home() {
      this.goto(0, 0);
      this.angle = 0;
      return this;
    }
    circle(radius, extent = 360) {
      const frac = Math.abs(extent) / 360;
      const steps = 1 + Math.floor(Math.min(11 + Math.abs(radius) / 6, 59) * frac);
      let w = extent / steps;
      let w2 = 0.5 * w;
      let length = 2 * radius * Math.sin((w2 * Math.PI) / 180);
      if (radius < 0) {
        length = -length;
        w = -w;
        w2 = -w2;
      }
      this.left(w2);
      for (let i = 0; i < steps; i++) {
        this.forward(length);
        this.left(w);
      }
      this.right(w2);
      return this;
    }
    dot(size, color) {
      const diameter = size === undefined ? Math.max(this.lineWidth + 4, this.lineWidth * 2) : size;
      add({ t: "dot", x: this.x, y: this.y, r: diameter / 2, c: color ? colorText(color) : this.penColor });
      return this;
    }
    write(text, size = 12) {
      add({ t: "text", x: this.x, y: this.y, s: String(text).slice(0, 200), c: this.penColor, size: Number(size) || 12, align: "left" });
      return this;
    }
    penUp() {
      this.pen = false;
      return this;
    }
    penDown() {
      this.pen = true;
      return this;
    }
    size(width) {
      this.lineWidth = Math.max(0.1, Number(width) || 1);
      return this;
    }
    color(pen, fill) {
      this.penColor = colorText(pen);
      this.fillColorValue = colorText(fill === undefined ? pen : fill);
      return this;
    }
    beginFill() {
      this.fillStart = commands.length;
      this.fillPoints = [[this.x, this.y]];
      return this;
    }
    endFill() {
      if (this.fillStart !== null && this.fillPoints.length >= 3) {
        add({ t: "poly", pts: this.fillPoints, c: this.fillColorValue }, Math.min(this.fillStart, commands.length));
      }
      this.fillStart = null;
      this.fillPoints = [];
      return this;
    }
    hide() {
      this.shown = false;
      return this;
    }
    show() {
      this.shown = true;
      return this;
    }
  }

  const main = new Turtle();
  const api = {
    Turtle,
    forward: (d) => main.forward(d),
    back: (d) => main.back(d),
    left: (a) => main.left(a),
    right: (a) => main.right(a),
    goto: (x, y) => main.goto(x, y),
    setHeading: (a) => main.setHeading(a),
    home: () => main.home(),
    circle: (r, e) => main.circle(r, e),
    dot: (s, c) => main.dot(s, c),
    write: (t, s) => main.write(t, s),
    penUp: () => main.penUp(),
    penDown: () => main.penDown(),
    size: (w) => main.size(w),
    color: (p, f) => main.color(p, f),
    beginFill: () => main.beginFill(),
    endFill: () => main.endFill(),
    hide: () => main.hide(),
    show: () => main.show(),
    background: (c) => {
      state.bg = colorText(c);
    },
  };

  /** คืนภาพที่วาด (หรือ null ถ้าไม่มีอะไรให้วาด) */
  function take() {
    if (commands.length === 0 && state.bg === null) return null;
    const cursors = turtles
      .filter((t) => t.shown && (t !== main || commands.length > 0))
      .map((t) => ({ x: t.x, y: t.y, h: t.angle, c: t.penColor }));
    return { commands, bg: state.bg, cursors, truncated: state.truncated };
  }

  return { api, take };
}
/* turtle:end */

self.onmessage = async (event) => {
  const { id, code } = event.data;
  const send = (type, text) => self.postMessage({ id, type, text });
  const print = (type) => (...args) => send(type, args.map(format).join(" "));

  const sandboxConsole = {
    log: print("stdout"),
    info: print("stdout"),
    debug: print("stdout"),
    warn: print("stderr"),
    error: print("stderr"),
  };

  const { api: turtle, take: takeDrawing } = createTurtleApi();
  const sendDrawing = () => {
    const drawing = takeDrawing();
    if (drawing) self.postMessage({ id, type: "draw", drawing });
  };

  self.postMessage({ id, type: "started" });
  try {
    const run = new AsyncFunction("console", "turtle", `"use strict";\n${code}`);
    await run(sandboxConsole, turtle);
    sendDrawing();
    self.postMessage({ id, type: "done" });
  } catch (error) {
    sendDrawing();
    const message =
      error && typeof error === "object" && "message" in error
        ? `${error.name || "Error"}: ${error.message}`
        : String(error);
    self.postMessage({ id, type: "error", text: message });
  }
};
