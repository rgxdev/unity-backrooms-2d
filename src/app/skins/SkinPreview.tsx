"use client";

import { useEffect, useRef } from "react";
import type { SkinDefinition } from "@/game/skins/skinCatalog";
import {
  paintPlayerSprite,
  PLAYER_SPRITE_SIZE,
  type PaintSurface,
} from "@/game/skins/spritePainter";

function cssColor(value: number, alpha: number): string {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Canvas2D implementation of the shared sprite painter's surface — the
 *  exact same draw calls PreloadScene bakes into the in-game texture, so
 *  the preview can never drift from what the player actually wears. */
function canvasSurface(ctx: CanvasRenderingContext2D): PaintSurface {
  return {
    px: (color, x, y, w = 1, h = 1, alpha = 1) => {
      ctx.fillStyle = cssColor(color, alpha);
      ctx.fillRect(x, y, w, h);
    },
    rr: (color, x, y, w, h, alpha = 1) => {
      ctx.fillStyle = cssColor(color, alpha);
      ctx.fillRect(x + 1, y, w - 2, h);
      ctx.fillRect(x, y + 1, w, h - 2);
    },
    ellipse: (color, cx, cy, w, h, alpha = 1) => {
      ctx.fillStyle = cssColor(color, alpha);
      ctx.beginPath();
      // Phaser's fillEllipse takes full width/height; Canvas2D takes radii.
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

/** How often the preview swaps between the idle and mid-step frames — the
 *  same walk-in-place cadence as the in-game WALK_CYCLE_MS. */
const PREVIEW_STEP_MS = 190;

/**
 * Live sprite preview for the skin selector: renders the actual player
 * sprite (front facing, walking in place) at chunky pixel scale instead of
 * a flat colour swatch.
 */
export function SkinPreview({ skin }: { skin: SkinDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const surface = canvasSurface(ctx);
    let stride = false;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintPlayerSprite(surface, "front", stride, skin.palette, skin.accessory);
    };
    draw();
    const timer = window.setInterval(() => {
      stride = !stride;
      draw();
    }, PREVIEW_STEP_MS);
    return () => window.clearInterval(timer);
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      className="skin-card__preview"
      width={PLAYER_SPRITE_SIZE}
      height={PLAYER_SPRITE_SIZE}
      aria-hidden
    />
  );
}
