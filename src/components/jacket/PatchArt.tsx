import redbull from "@/assets/patches/redbull.png";
import bmw from "@/assets/patches/bmw.png";
import horse from "@/assets/patches/horse.png";
import { Lock } from "lucide-react";
import type { PatchId } from "@/lib/jacket";
import { countryByCode } from "@/lib/countries";
import { cn } from "@/lib/utils";

export type PatchCtx = { num: string; name: string; initials: string; quote: string; country: string; sleeveNumber: "07" | "08" | "09"; customUrl?: string | null };

const IMG: Partial<Record<PatchId, string>> = { redbull, bmw, horse };

/** Renders a patch. `onJacket` switches text to light ink for the dark sleeves. */
export function PatchArt({ id, ctx, onJacket = false, className }: { id: PatchId; ctx: PatchCtx; onJacket?: boolean; className?: string }) {
  const ink = onJacket ? "text-patch-cream" : "text-tile-ink";
  const wrap = cn("flex h-full w-full items-center justify-center overflow-hidden select-none", className);

  if (IMG[id]) return <div className={wrap}><img src={IMG[id]} alt="" className="max-h-full max-w-full object-contain" draggable={false} /></div>;

  switch (id) {
    case "num_en":
      return <div className={cn(wrap, ink, "font-varsity leading-none text-[2.2em]")}>27</div>;
    case "num_ar":
      return <div className={cn(wrap, ink, "font-varsity leading-none text-[2.2em]")}>27</div>;
    case "initials":
      return (
        <div className={cn(wrap, ink, "font-varsity leading-none")}>
          <span className="text-[1.9em]">{ctx.initials || "EM"}</span>
        </div>
      );
    case "name_ar":
      return <div dir="auto" className={cn(wrap, ink, "font-arabic text-[1.4em] leading-tight text-center px-1 break-words")}>{ctx.name || "الاسم"}</div>;
    case "quote":
      return <div dir="auto" className={cn(wrap, ink, "font-quote italic text-[1.1em] text-center px-2 leading-tight")}>“{ctx.quote || "your quote"}”</div>;
    case "flag":
      return <div className={cn(wrap, "text-[3em]")} aria-label={countryByCode(ctx.country).name}>{countryByCode(ctx.country).flag}</div>;
    case "n07":
    case "n08":
    case "n09":
      return <div className={cn(wrap, ink, "font-varsity leading-none text-[2.2em]")}>{ctx.sleeveNumber}</div>;
    case "custom":
      return ctx.customUrl ? (
        <div className={wrap}><img src={ctx.customUrl} alt="" className="max-h-full max-w-full object-contain" /></div>
      ) : (
        <div className={cn(wrap, ink, "opacity-60")}><Lock className="h-[1.8em] w-[1.8em]" strokeWidth={1.4} /></div>
      );
  }
  return null;
}
