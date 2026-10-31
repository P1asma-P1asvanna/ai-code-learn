"use client";

import { useEffect, useRef } from "react";

import { renderDrawing, type Drawing } from "@/lib/turtle";

const WIDTH = 480;
const HEIGHT = 320;

/** ผืนผ้าใบแสดงภาพที่วาดด้วย turtle */
export default function TurtleCanvas({ drawing }: { drawing: Drawing }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) renderDrawing(ctx, drawing, WIDTH, HEIGHT);
  }, [drawing]);

  return (
    <div className="turtle-box">
      <canvas
        ref={ref}
        className="turtle-canvas"
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="ภาพที่วาดด้วยโค้ด"
      />
      {drawing.truncated ? <p className="small muted">ภาพซับซ้อนมาก จึงแสดงแค่ส่วนแรก</p> : null}
    </div>
  );
}
