import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PatchId } from "@/lib/jacket";
import type { PatchCtx } from "./PatchArt";
import { cn } from "@/lib/utils";
import redbull from "@/assets/patches/redbull.png";
import bmw from "@/assets/patches/bmw.png";
import horse from "@/assets/patches/horse.png";
import { countryByCode } from "@/lib/countries";

export type Jacket3DState = PatchCtx & { backStyle: "en" | "ar"; slots: Record<string, PatchId | null> };
const patchImages: Partial<Record<PatchId, string>> = { redbull, bmw, horse };
const createGroup = () => new THREE.Group();
const createScene = () => new THREE.Scene();
const createRenderer = (canvas: HTMLCanvasElement) => new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
type JacketGroup = ReturnType<typeof createGroup>;
type JacketScene = ReturnType<typeof createScene>;
type JacketRenderer = ReturnType<typeof createRenderer>;

function textTexture(lines: string[], options: { color?: string; font?: string; background?: string } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, 512, 512);
  }
  ctx.fillStyle = options.color ?? "#f4f0e7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "auto";
  lines.forEach((line, i) => {
    ctx.font = `${i === 1 ? "bold 150px" : "bold 56px"} ${options.font ?? "Arial"}`;
    const y = lines.length === 1 ? 256 : [90, 256, 425][i] ?? 256;
    ctx.fillText(line, 256, y, 470);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addTextPlane(parent: JacketGroup, text: string[], position: [number, number, number], size: [number, number], font?: string) {
  const texture = textTexture(text, { font });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function addJacket(scene: JacketScene, state: Jacket3DState): JacketGroup {
  const jacket = new THREE.Group();
  scene.add(jacket);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#181818", roughness: 0.86 });
  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: "#4a4a47", roughness: 0.9 });
  const ribMaterial = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.95 });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: "#30302e", roughness: 0.9 });

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.61, 1.05); bodyShape.lineTo(-0.78, 0.7); bodyShape.lineTo(-0.72, -0.94);
  bodyShape.quadraticCurveTo(0, -1.12, 0.72, -0.94); bodyShape.lineTo(0.78, 0.7); bodyShape.lineTo(0.61, 1.05);
  bodyShape.lineTo(0.29, 1.16); bodyShape.lineTo(0.16, 1.02); bodyShape.lineTo(-0.16, 1.02); bodyShape.lineTo(-0.29, 1.16); bodyShape.closePath();
  jacket.add(new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 0.34, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.045, bevelThickness: 0.045 }), bodyMaterial));

  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.19, 1.55, 18), sleeveMaterial);
    sleeve.position.set(side * 0.92, 0.15, 0.04);
    sleeve.rotation.z = -side * 0.24;
    jacket.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.18, 18), ribMaterial);
    cuff.position.set(side * 1.1, -0.62, 0.04);
    cuff.rotation.z = -side * 0.24;
    jacket.add(cuff);
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.105, 8, 28, Math.PI), ribMaterial);
  collar.position.set(0, 1.06, 0.2);
  collar.rotation.x = Math.PI;
  jacket.add(collar);
  const waistband = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.2, 0.38), ribMaterial);
  waistband.position.set(0, -0.98, 0.15);
  jacket.add(waistband);
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.8, 0.045), seamMaterial);
  placket.position.set(0, 0.02, 0.39);
  jacket.add(placket);
  for (let y = -0.7; y <= 0.72; y += 0.36) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: "#77736a", metalness: 0.25, roughness: 0.45 }));
    button.position.set(0, y, 0.42);
    jacket.add(button);
  }
  // Front chest initials and back personalization are separate transparent cloth decals.
  addTextPlane(jacket, [state.initials || "EM"], [0.37, 0.62, 0.395], [0.42, 0.3], "Graduate, Georgia, serif");
  const backText = new THREE.Group();
  backText.position.set(0, 0, -0.01);
  backText.rotation.y = Math.PI;
  jacket.add(backText);
  addTextPlane(backText, [state.name || "NAME", state.num || "27", `“${state.quote || "your quote"}”`], [0, 0, 0], [0.95, 1.55], "Georgia, serif");

  const positions: Record<string, [number, number, number]> = {
    L1: [-1.14, 0.54, 0.04], L2: [-1.2, 0.12, 0.04], L3: [-1.25, -0.3, 0.04],
    R1: [1.14, 0.54, 0.04], R2: [1.2, 0.12, 0.04], R3: [1.25, -0.3, 0.04],
  };
  const loader = new THREE.TextureLoader();
  Object.entries(state.slots).forEach(([slot, patch]) => {
    if (!patch) return;
    const imageUrl = patchImages[patch] ?? (patch === "custom" ? state.customUrl ?? undefined : undefined);
    const material = new THREE.MeshBasicMaterial({ color: imageUrl ? "white" : "#d9d2c5", map: imageUrl ? loader.load(imageUrl) : textTexture([patch === "flag" ? countryByCode(state.country).flag : patch === "n07" ? "07" : patch === "n08" ? "08" : patch === "n09" ? "09" : patch === "initials" ? state.initials : patch === "quote" ? state.quote || "QUOTE" : patch === "name_ar" ? state.name || "NAME" : patch.toUpperCase()], { background: patch === "flag" ? "#ffffff" : "#444441" }), transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.24), material);
    mesh.position.set(...(positions[slot] ?? [0, 0, 0.4]));
    mesh.rotation.y = slot.startsWith("R") ? Math.PI / 2 : -Math.PI / 2;
    jacket.add(mesh);
  });

  // The main chosen country and number are also visible as sleeve embroidery.
  addTextPlane(jacket, [state.sleeveNumber], [-1.13, 0.85, 0.04], [0.25, 0.2], "Graduate, Georgia, serif").rotation.y = -Math.PI / 2;
  addTextPlane(jacket, [countryByCode(state.country).flag], [1.13, 0.83, 0.04], [0.25, 0.2]).rotation.y = Math.PI / 2;
  return jacket;
}

export function Jacket3D({ view, state, className }: { view: "front" | "back" | "left" | "right"; state: Jacket3DState; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; active: boolean; yaw: number; pitch: number }>({ x: 0, y: 0, active: false, yaw: 0, pitch: 0 });
  const zoomRef = useRef(4.2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: JacketRenderer;
    try {
      renderer = createRenderer(canvas);
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f7f6f3");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const ambient = new THREE.HemisphereLight("#ffffff", "#65615a", 2.15);
    const keyLight = new THREE.DirectionalLight("#ffffff", 3.2);
    keyLight.position.set(-3, 5, 7);
    scene.add(ambient, keyLight);
    const jacket = addJacket(scene, state);
    const initialYaw = view === "back" ? Math.PI : view === "left" ? Math.PI / 2 : view === "right" ? -Math.PI / 2 : 0;
    dragRef.current.yaw = initialYaw;
    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
    });
    resize.observe(canvas.parentElement ?? canvas);
    let frame = 0;
    const draw = () => {
      jacket.rotation.y = dragRef.current.yaw;
      jacket.rotation.x = dragRef.current.pitch;
      camera.position.set(0, 0.05, zoomRef.current);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.dispose();
      scene.clear();
    };
  }, [view, state]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Interactive 3D varsity jacket preview. Drag to rotate; use the mouse wheel to zoom."
      className={cn("h-full w-full touch-none", className)}
      onPointerDown={(e) => { dragRef.current.active = true; dragRef.current.x = e.clientX; dragRef.current.y = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={() => { dragRef.current.active = false; }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        dragRef.current.yaw += dx * 0.012;
        dragRef.current.pitch = THREE.MathUtils.clamp(dragRef.current.pitch + dy * 0.008, -0.55, 0.55);
        dragRef.current.x = e.clientX; dragRef.current.y = e.clientY;
      }}
      onWheel={(e) => { zoomRef.current = THREE.MathUtils.clamp(zoomRef.current + e.deltaY * 0.003, 2.7, 5.2); }}
    />
  );
}
