import type { CSSProperties } from "react";
import { X, Upload } from "lucide-react";
import type { PatchCtx } from "./PatchArt";
import type { Slot } from "@/lib/jacket";
import { cn } from "@/lib/utils";

export type PhotoViewKey = "front" | "back" | "left" | "right";
export type PatchImage = { uploadId: string; url: string; fileName: string };
export type JacketPhotoState = PatchCtx & { patchImages: Partial<Record<Slot, PatchImage>> };

type Spot = { number: number; slot?: Slot; x: number; y: number; w: number; h: number; fieldId?: string; label: string };

const SPOTS: Record<PhotoViewKey, Spot[]> = {
  front: [{ number: 1, x: 66, y: 30, w: 21, h: 13, fieldId: "initials", label: "Chest initials" }],
  back: [
    { number: 2, x: 50, y: 28, w: 48, h: 10, fieldId: "name", label: "Back name" },
    { number: 3, x: 50, y: 49, w: 38, h: 20, fieldId: "num", label: "Back number" },
    { number: 4, x: 50, y: 69, w: 46, h: 9, fieldId: "quote", label: "Back quote" },
  ],
  left: [
    { number: 5, slot: "L1", x: 52, y: 31, w: 26, h: 13, fieldId: "sleeve-number", label: "Left sleeve number patch" },
    { number: 6, slot: "L2", x: 52, y: 53, w: 29, h: 15, label: "Left sleeve patch 2" },
    { number: 7, slot: "L3", x: 52, y: 75, w: 29, h: 15, label: "Left sleeve patch 3" },
  ],
  right: [
    { number: 8, slot: "R1", x: 52, y: 31, w: 29, h: 15, fieldId: "country-search", label: "Right sleeve country flag patch" },
    { number: 9, slot: "R2", x: 52, y: 53, w: 29, h: 15, label: "Right sleeve patch 2" },
    { number: 10, slot: "R3", x: 52, y: 75, w: 29, h: 15, label: "Right sleeve patch 3" },
  ],
};

const position = (spot: Spot): CSSProperties => ({ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`, transform: "translate(-50%, -50%)" });

export function JacketPhotoView({
  view,
  state,
  onPatchUpload,
  onPatchRemove,
  onFieldFocus,
  interactive = true,
  className,
}: {
  view: PhotoViewKey;
  state: JacketPhotoState;
  onPatchUpload: (slot: Slot, file: File) => void;
  onPatchRemove: (slot: Slot) => void;
  onFieldFocus: (id: string) => void;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden rounded-xl bg-[#f7f6f3]", className)}>
      <img src={`/jacket/${view}.webp`} alt={`${view} view of the clean varsity jacket base`} className="absolute inset-0 h-full w-full object-contain" />

      {view === "front" && (
        <div dir="auto" className="absolute left-[66%] top-[30%] flex h-[13%] w-[21%] items-center justify-center overflow-hidden font-varsity text-[clamp(1rem,4vw,2.2rem)] text-[#f4f0e7]">
          {state.initials}
        </div>
      )}
      {view === "back" && (
        <>
          <div dir="auto" className="absolute left-1/2 top-[28%] flex h-[10%] w-[48%] -translate-x-1/2 items-center justify-center overflow-hidden font-arabic text-[clamp(.8rem,3vw,1.5rem)] text-[#f4f0e7]">{state.name}</div>
          <div className="absolute left-1/2 top-[49%] flex h-[20%] w-[38%] -translate-x-1/2 items-center justify-center overflow-hidden font-varsity text-[clamp(2rem,9vw,4rem)] text-[#f4f0e7]">{state.num || "27"}</div>
          <div dir="auto" className="absolute left-1/2 top-[69%] flex h-[9%] w-[46%] -translate-x-1/2 items-center justify-center overflow-hidden font-quote text-center text-[clamp(.65rem,2vw,1rem)] italic text-[#f4f0e7]">“{state.quote}”</div>
        </>
      )}
      {view === "left" && !state.patchImages.L1 && <div className="absolute left-[52%] top-[31%] flex h-[13%] w-[26%] items-center justify-center font-varsity text-[clamp(1rem,4vw,2rem)] text-[#f4f0e7]">{state.sleeveNumber}</div>}
      {view === "right" && !state.patchImages.R1 && <div className="absolute left-[52%] top-[31%] flex h-[15%] w-[29%] items-center justify-center"><span className="flex aspect-[3/2] h-[70%] items-center justify-center overflow-hidden rounded-sm border border-white/80 bg-white text-[clamp(1.3rem,5vw,2.8rem)] leading-none shadow">{[...state.country].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("")}</span></div>}

      {SPOTS[view].map((spot) => {
        const patch = spot.slot ? state.patchImages[spot.slot] : undefined;
        return (
          <div key={spot.number} className="absolute" style={position(spot)}>
            {patch && <img src={patch.url} alt={`Uploaded patch for location ${spot.number}`} className="absolute inset-0 h-full w-full object-contain drop-shadow" />}
            {spot.slot && interactive ? (
              <>
                <label className="absolute inset-0 z-10 cursor-pointer" aria-label={`Upload patch for location ${spot.number}`}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) onPatchUpload(spot.slot!, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {patch && <button type="button" aria-label={`Remove patch at location ${spot.number}`} onClick={() => onPatchRemove(spot.slot!)} className="absolute -end-2 -top-2 z-30 rounded-full bg-white p-1 text-black shadow"><X className="h-3 w-3" /></button>}
              </>
            ) : !spot.slot && interactive ? (
              <button type="button" onClick={() => spot.fieldId && onFieldFocus(spot.fieldId)} aria-label={`Edit ${spot.label}`} className="absolute inset-0 z-10 cursor-pointer" />
            ) : null}
            <span aria-hidden className="pointer-events-none absolute -end-2 -top-2 z-20 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-primary px-1 font-varsity text-xs text-primary-foreground shadow">{spot.number}</span>
            {spot.slot && !patch && interactive && <span aria-hidden className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-md border border-dashed border-white/80"><Upload className="h-4 w-4 text-white drop-shadow" /></span>}
          </div>
        );
      })}
    </div>
  );
}
