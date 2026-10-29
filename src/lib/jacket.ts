import { z } from "zod";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const SLOTS = ["L1", "L2", "L3", "R1", "R2", "R3"] as const;
export type Slot = (typeof SLOTS)[number];

export const PATCH_IDS = [
  "num_en",
  "num_ar",
  "initials",
  "name_ar",
  "quote",
  "flag",
  "n07",
  "n08",
  "n09",
  "redbull",
  "bmw",
  "horse",
  "custom",
] as const;
export type PatchId = (typeof PATCH_IDS)[number];

export const PATCH_LABELS: Record<PatchId, string> = {
  num_en: "Number (27)",
  num_ar: "Number (27)",
  initials: "Initials",
  name_ar: "Name",
  quote: "Your quote",
  flag: "Country flag",
  n07: "07",
  n08: "08",
  n09: "Sleeve number",
  redbull: "Red Bull",
  bmw: "BMW",
  horse: "Horse",
  custom: "Custom patch",
};

export type SlotMap = Record<Slot, PatchId | null>;
export const emptySlots = (): SlotMap => ({ L1: null, L2: null, L3: null, R1: null, R2: null, R3: null });

export const countPlaced = (slots: SlotMap) => Object.values(slots).filter(Boolean).length;

/** Can a patch be placed into `slot` given the PATCH NUM limit? Replacing an occupied slot is always allowed. */
export function canPlace(slots: SlotMap, slot: Slot, limit: number) {
  if (slots[slot]) return true;
  return countPlaced(slots) < limit;
}

/** When the limit drops, remove patches from the last slots until it fits. */
export function trimToLimit(slots: SlotMap, limit: number): SlotMap {
  const next = { ...slots };
  let over = countPlaced(next) - limit;
  for (const s of [...SLOTS].reverse()) {
    if (over <= 0) break;
    if (next[s]) {
      next[s] = null;
      over--;
    }
  }
  return next;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toArabicDigits = (s: string) => s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)] ?? d);

export const orderSchema = z.object({
  num: z.string().trim().min(1, "NUM is required").max(3, "NUM can be at most 3 digits").regex(/^[0-9٠-٩]+$/, "NUM must be digits"),
  initials: z.string().trim().min(1, "Initials are required").max(2, "Use no more than 2 initials").regex(/^[\p{L}]{1,2}$/u, "Initials must be 1 or 2 letters"),
  country: z.string().regex(/^[A-Z]{2}$/, "Choose a country"),
  sleeveNumber: z.enum(["07", "08", "09"]),
  size: z.enum(SIZES, { message: "Pick a SIZE" }),
  name: z.string().trim().min(1, "NAME is required").max(30, "NAME must be 30 characters or less"),
  patchNum: z.number().int().min(1, "PATCH NUM must be 1-6").max(6, "PATCH NUM must be 1-6"),
  grade: z.string().trim().min(1, "GRADE is required").max(10, "GRADE must be 10 characters or less"),
  note: z.string().trim().max(500, "NOTE must be 500 characters or less").optional().default(""),
  backStyle: z.enum(["en", "ar"]),
  quote: z.string().trim().max(40, "Quote must be 40 characters or less").optional().default(""),
});
export type OrderInput = z.infer<typeof orderSchema>;

export const ACCEPTED_UPLOADS = ".png,.jpg,.jpeg,.webp,.heic,.heif,.gif,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,application/pdf";
