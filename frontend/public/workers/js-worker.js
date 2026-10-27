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

  self.postMessage({ id, type: "started" });
  try {
    const run = new AsyncFunction("console", `"use strict";\n${code}`);
    await run(sandboxConsole);
    self.postMessage({ id, type: "done" });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? `${error.name || "Error"}: ${error.message}`
        : String(error);
    self.postMessage({ id, type: "error", text: message });
  }
};
