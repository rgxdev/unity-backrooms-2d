import Phaser from "phaser";

/**
 * Stock Phaser.Filters.Vignette uses `sin(d/radius * PI * strength)` for its
 * falloff. That's only a smooth 0→1 ramp when strength is exactly 0.5 — at
 * any other value (which is how it's driven for fear intensity) the ramp
 * stops short of 1 right at the radius, then the shader jumps straight to a
 * fully opaque disc beyond it. That jump reads as a hard ring/cutoff instead
 * of a soft edge. This filter replaces the ramp with an aspect-corrected
 * `smoothstep`, so the feather width and the darkness are independent knobs
 * and the transition has no seam.
 */
const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uRadius;
uniform float uFeather;
uniform float uStrength;
uniform vec2 uPosition;
uniform vec4 uColor;
uniform float uAspect;

varying vec2 outTexCoord;

void main()
{
    vec2 position = vec2(uPosition.x, 1.0 - uPosition.y);
    vec2 diff = outTexCoord - position;
    diff.x *= uAspect;

    float d = length(diff);
    float feather = max(uFeather, 0.0001);
    float vignette = smoothstep(uRadius - feather, uRadius, d) * uStrength;

    vec4 texture = texture2D(uMainSampler, outTexCoord);
    gl_FragColor = mix(texture, uColor, vignette);
}
`;

const NODE_NAME = "SoftVignette";

class SoftVignetteRenderNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NODE_NAME, manager, undefined, FRAG_SHADER);
  }

  override setupUniforms(controller: SoftVignetteController): void {
    const pm = this.programManager;
    const c = controller.colorGL;
    pm.setUniform("uRadius", controller.radius);
    pm.setUniform("uFeather", controller.feather);
    pm.setUniform("uStrength", controller.strength);
    pm.setUniform("uPosition", [controller.x, controller.y]);
    pm.setUniform("uColor", c);
    pm.setUniform("uAspect", controller.camera.width / controller.camera.height);
  }
}

/** Controller for {@link SoftVignetteRenderNode} — mirrors Phaser.Filters.Vignette's
 *  shape but adds an independent `feather` (band width) so strength only ever
 *  controls opacity, never the smoothness of the edge. */
export class SoftVignetteController extends Phaser.Filters.Controller {
  x: number;
  y: number;
  radius: number;
  feather: number;
  strength: number;
  colorGL: [number, number, number, number];

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    x = 0.5,
    y = 0.5,
    radius = 0.5,
    feather = 0.25,
    strength = 0.5,
    color = 0x000000,
  ) {
    super(camera, NODE_NAME);
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.feather = feather;
    this.strength = strength;
    this.colorGL = [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
      1,
    ];
  }
}

let registered = false;

/** Adds a {@link SoftVignetteController} to the given camera's internal filter
 *  list, registering the backing shader RenderNode the first time it's used. */
export function addSoftVignette(
  camera: Phaser.Cameras.Scene2D.Camera,
  x?: number,
  y?: number,
  radius?: number,
  feather?: number,
  strength?: number,
  color?: number,
): SoftVignetteController | null {
  const renderer = camera.scene.game.renderer;
  if (renderer.type !== Phaser.WEBGL) return null;

  const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!registered) {
    webglRenderer.renderNodes.addNodeConstructor(NODE_NAME, SoftVignetteRenderNode);
    registered = true;
  }

  const controller = new SoftVignetteController(camera, x, y, radius, feather, strength, color);
  camera.filters.internal.add(controller);
  return controller;
}
