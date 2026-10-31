/** ภาพที่วาดด้วย turtle (ทั้ง Python และ JavaScript) — ตัวรันส่งมาเป็นรายการคำสั่ง แล้วหน้าเว็บวาดลงผืนผ้าใบ */

export type DrawCommand =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; c: string; w: number }
  | { t: "poly"; pts: [number, number][]; c: string }
  | { t: "dot"; x: number; y: number; r: number; c: string }
  | { t: "text"; x: number; y: number; s: string; c: string; size: number };

export type DrawCursor = { x: number; y: number; h: number; c: string };

export type Drawing = {
  commands: DrawCommand[];
  bg: string | null;
  cursors: DrawCursor[];
  truncated: boolean;
};

const MAX_COMMANDS = 20000;
const MAX_POINTS = 5000;
const MAX_CURSORS = 20;
const COORD_LIMIT = 100000;

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, value)) : fallback;
const str = (value: unknown, fallback: string, max = 60): string =>
  typeof value === "string" ? value.slice(0, max) : fallback;

/** ข้อมูลจาก worker เชื่อไม่ได้เต็มที่ (โค้ดผู้เรียนอาจส่งอะไรมาก็ได้) จึงตรวจรูปแบบและจำกัดขนาดก่อนวาดเสมอ */
export function sanitizeDrawing(raw: unknown): Drawing | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const list = Array.isArray(input.commands) ? input.commands.slice(0, MAX_COMMANDS) : [];

  const commands: DrawCommand[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    switch (c.t) {
      case "line":
        commands.push({
          t: "line",
          x1: num(c.x1),
          y1: num(c.y1),
          x2: num(c.x2),
          y2: num(c.y2),
          c: str(c.c, "black"),
          w: Math.max(0.1, Math.min(200, num(c.w, 1))),
        });
        break;
      case "poly": {
        if (!Array.isArray(c.pts)) break;
        const pts: [number, number][] = [];
        for (const p of c.pts.slice(0, MAX_POINTS)) {
          if (Array.isArray(p)) pts.push([num(p[0]), num(p[1])]);
        }
        if (pts.length >= 3) commands.push({ t: "poly", pts, c: str(c.c, "black") });
        break;
      }
      case "dot":
        commands.push({ t: "dot", x: num(c.x), y: num(c.y), r: Math.max(0, Math.min(1000, num(c.r, 2))), c: str(c.c, "black") });
        break;
      case "text":
        commands.push({
          t: "text",
          x: num(c.x),
          y: num(c.y),
          s: str(c.s, "", 200),
          c: str(c.c, "black"),
          size: Math.max(6, Math.min(120, num(c.size, 12))),
        });
        break;
    }
  }

  const cursors: DrawCursor[] = Array.isArray(input.cursors)
    ? input.cursors.slice(0, MAX_CURSORS).flatMap((item): DrawCursor[] => {
        if (!item || typeof item !== "object") return [];
        const k = item as Record<string, unknown>;
        return [{ x: num(k.x), y: num(k.y), h: num(k.h), c: str(k.c, "black") }];
      })
    : [];

  const bg = typeof input.bg === "string" ? input.bg.slice(0, 60) : null;
  if (commands.length === 0 && bg === null) return null;
  return { commands, bg, cursors, truncated: input.truncated === true || list.length < (Array.isArray(input.commands) ? input.commands.length : 0) };
}

/** ขอบเขตของภาพ (รวมจุดทั้งหมด) ไว้ย่อภาพให้พอดีผืนผ้าใบ */
function bounds(drawing: Drawing): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  const see = (x: number, y: number, pad = 0) => {
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad);
    maxY = Math.max(maxY, y + pad);
  };
  for (const c of drawing.commands) {
    if (c.t === "line") {
      see(c.x1, c.y1, c.w);
      see(c.x2, c.y2, c.w);
    } else if (c.t === "poly") {
      for (const [x, y] of c.pts) see(x, y);
    } else if (c.t === "dot") {
      see(c.x, c.y, c.r);
    } else {
      see(c.x, c.y, 4);
    }
  }
  for (const k of drawing.cursors) see(k.x, k.y, 8);
  return { minX, maxX, minY, maxY };
}

/** วาดลงผืนผ้าใบ: จุด (0,0) อยู่กลางภาพ แกน y ชี้ขึ้น (เหมือน turtle ของ Python) ถ้าภาพใหญ่เกินจะย่อให้พอดี */
export function renderDrawing(ctx: CanvasRenderingContext2D, drawing: Drawing, width: number, height: number): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = drawing.bg ?? "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const b = bounds(drawing);
  const halfW = Math.max(Math.abs(b.minX), Math.abs(b.maxX), 1);
  const halfH = Math.max(Math.abs(b.minY), Math.abs(b.maxY), 1);
  const margin = 12;
  const scale = Math.min(1, (width / 2 - margin) / halfW, (height / 2 - margin) / halfH);

  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, -scale); // y ชี้ขึ้น
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const c of drawing.commands) {
    switch (c.t) {
      case "line":
        ctx.strokeStyle = c.c;
        ctx.lineWidth = c.w;
        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1);
        ctx.lineTo(c.x2, c.y2);
        ctx.stroke();
        break;
      case "poly":
        ctx.fillStyle = c.c;
        ctx.beginPath();
        ctx.moveTo(c.pts[0][0], c.pts[0][1]);
        for (const [x, y] of c.pts.slice(1)) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
        break;
      case "dot":
        ctx.fillStyle = c.c;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "text":
        ctx.save();
        ctx.scale(1, -1); // ข้อความต้องไม่กลับหัว
        ctx.fillStyle = c.c;
        ctx.font = `${c.size}px sans-serif`;
        ctx.fillText(c.s, c.x, -c.y);
        ctx.restore();
        break;
    }
  }

  // ตัวเต่า: สามเหลี่ยมเล็ก ๆ ชี้ไปตามทิศที่หัน
  for (const k of drawing.cursors) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate((k.h * Math.PI) / 180);
    ctx.fillStyle = k.c;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
