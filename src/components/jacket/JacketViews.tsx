import type { ReactNode } from "react";
import type { Slot, SlotMap } from "@/lib/jacket";
import { toArabicDigits } from "@/lib/jacket";
import { PatchArt, type PatchCtx } from "./PatchArt";
import { cn } from "@/lib/utils";

export type ViewKey = "front" | "back" | "left" | "right";

export type JacketState = PatchCtx & { backStyle: "en" | "ar"; slots: SlotMap };

function Body({ children }: { children?: ReactNode }) {
  return (
    <svg viewBox="0 0 300 250" className="absolute inset-0 h-full w-full" aria-hidden>
      {/* sleeves */}
      <path d="M98 42 C70 48 52 58 44 80 L22 196 L60 204 L98 112 Z" className="fill-jacket-sleeve stroke-jacket-line" strokeWidth="1.5" />
      <path d="M202 42 C230 48 248 58 256 80 L278 196 L240 204 L202 112 Z" className="fill-jacket-sleeve stroke-jacket-line" strokeWidth="1.5" />
      {/* cuffs */}
      <path d="M20 194 L62 202 L58 222 L16 214 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      <path d="M280 194 L238 202 L242 222 L284 214 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      {/* body */}
      <path d="M98 42 Q150 30 202 42 L210 206 L90 206 Z" className="fill-jacket-body stroke-jacket-line" strokeWidth="1.5" />
      {/* waistband */}
      <rect x="88" y="204" width="124" height="22" rx="4" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      {Array.from({ length: 15 }).map((_, i) => (
        <line key={i} x1={94 + i * 8} y1="207" x2={94 + i * 8} y2="223" className="stroke-jacket-body" strokeWidth="1" />
      ))}
      {children}
    </svg>
  );
}

function Front() {
  return (
    <Body>
      <path d="M118 38 Q150 58 182 38 L178 30 Q150 46 122 30 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      <line x1="150" y1="50" x2="150" y2="204" className="stroke-jacket-line" strokeWidth="1.5" />
      {[70, 100, 130, 160, 188].map((y) => (
        <circle key={y} cx="150" cy={y} r="3" className="fill-jacket-sleeve" />
      ))}
      <line x1="112" y1="140" x2="124" y2="180" className="stroke-jacket-sleeve" strokeWidth="2" />
      <line x1="188" y1="140" x2="176" y2="180" className="stroke-jacket-sleeve" strokeWidth="2" />
    </Body>
  );
}

function Back() {
  return (
    <Body>
      <path d="M118 38 Q150 50 182 38 L178 32 Q150 42 122 32 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
    </Body>
  );
}

function SleeveSvg({ mirror }: { mirror?: boolean }) {
  return (
    <svg viewBox="0 0 160 320" className={cn("absolute inset-0 h-full w-full", mirror && "-scale-x-100")} aria-hidden>
      <path d="M40 22 Q90 4 128 18 L136 270 Q100 286 54 278 L30 120 Z" className="fill-jacket-body stroke-jacket-line" strokeWidth="1.5" />
      <path d="M44 16 Q90 0 126 12 L128 30 Q90 18 46 34 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      <ellipse cx="86" cy="150" rx="34" ry="112" className="fill-jacket-sleeve" opacity="0.85" />
      <path d="M54 270 Q100 280 136 266 L138 302 Q100 316 58 306 Z" className="fill-jacket-rib stroke-jacket-line" strokeWidth="1.5" />
      <line x1="40" y1="160" x2="48" y2="220" className="stroke-jacket-sleeve" strokeWidth="2" />
    </svg>
  );
}

export function JacketView({
  view,
  state,
  activeSlot,
  onSlotClick,
  className,
}: {
  view: ViewKey;
  state: JacketState;
  activeSlot?: Slot | null;
  onSlotClick?: (s: Slot) => void;
  className?: string;
}) {
  const num = state.num || "27";
  if (view === "front" || view === "back") {
    return (
      <div className={cn("relative aspect-[300/250] w-full [container-type:inline-size]", className)}>
        {view === "front" ? <Front /> : <Back />}
        {view === "front" ? (
          <div className="absolute left-[56%] top-[20%] h-[16%] w-[16%]" style={{ fontSize: "4cqw" }}>
            <PatchArt id="em" ctx={state} onJacket />
          </div>
        ) : (
          <>
            <div dir="auto" className="absolute left-[33%] top-[17%] w-[34%] truncate text-center font-arabic leading-tight text-patch-cream transition-all" style={{ fontSize: "5.4cqw" }}>
              {state.name || "الاسم"}
            </div>
            <div
              key={state.backStyle}
              className={cn(
                "animate-pop absolute left-[30%] top-[33%] w-[40%] text-center leading-none text-patch-cream",
                state.backStyle === "en" ? "font-varsity" : "font-arabic",
              )}
              style={{ fontSize: state.backStyle === "en" ? "17cqw" : "18cqw" }}
            >
              {state.backStyle === "en" ? num : toArabicDigits(num)}
            </div>
            <div dir="auto" className="absolute left-[32%] top-[70%] w-[36%] truncate text-center font-quote italic text-patch-cream" style={{ fontSize: "3.6cqw" }}>
              “{state.quote || "your quote"}”
            </div>
          </>
        )}
      </div>
    );
  }

  const prefix = view === "left" ? "L" : "R";
  const slots = [1, 2, 3].map((n) => `${prefix}${n}` as Slot);
  return (
    <div className={cn("relative mx-auto aspect-[160/320] w-full max-w-[60%] [container-type:inline-size]", className)}>
      <SleeveSvg mirror={view === "right"} />
      {slots.map((s, i) => {
        const p = state.slots[s];
        const top = 16 + i * 25;
        const Comp = onSlotClick ? "button" : "div";
        return (
          <Comp
            key={s}
            type={onSlotClick ? "button" : undefined}
            onClick={onSlotClick ? () => onSlotClick(s) : undefined}
            aria-label={`${view === "left" ? "Left" : "Right"} sleeve slot ${i + 1}`}
            className={cn(
              "absolute left-[30%] h-[19%] w-[48%] rounded-lg transition-all",
              !p && onSlotClick && "border border-dashed border-patch-cream/30",
              activeSlot === s && "ring-2 ring-primary",
            )}
            style={{ top: `${top}%`, fontSize: "9cqw" }}
          >
            {p ? (
              <div key={p} className="animate-pop h-full w-full p-[4%]">
                <PatchArt id={p} ctx={state} onJacket />
              </div>
            ) : onSlotClick ? (
              <span className="text-patch-cream/40" style={{ fontSize: "8cqw" }}>{i + 1}</span>
            ) : null}
          </Comp>
        );
      })}
    </div>
  );
}
