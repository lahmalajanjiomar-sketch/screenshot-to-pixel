import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { FileText, ImagePlus, Loader2, X, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JacketView, type ViewKey } from "@/components/jacket/JacketViews";
import { PatchArt } from "@/components/jacket/PatchArt";
import {
  ACCEPTED_UPLOADS,
  PATCH_LABELS,
  SIZES,
  SLOTS,
  canPlace,
  countPlaced,
  emptySlots,
  orderSchema,
  trimToLimit,
  type PatchId,
  type Slot,
  type SlotMap,
} from "@/lib/jacket";
import { dict, type Lang } from "@/lib/i18n";
import { fileToPdf, buildSummaryPdf } from "@/lib/pdf";
import { createOrder, finalizeOrder } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Custom Varsity Jacket Order — EM" },
      { name: "description", content: "Design your custom EM varsity jacket: pick patches, add your name and number, and send your order." },
      { property: "og:title", content: "Custom Varsity Jacket Order — EM" },
      { property: "og:description", content: "Pick patches, add your Arabic or English name and number, and order your varsity jacket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderPage,
});

type Upload = { id: string; name: string; thumb: string | null; isPdf: boolean; pdf: Blob | null; status: "converting" | "ready" | "error" };

const TILE_ORDER: PatchId[] = ["num_en", "num_ar", "em", "name_ar", "quote", "flag", "n09", "redbull", "bmw", "custom", "horse"];
const VIEWS: ViewKey[] = ["front", "back", "left", "right"];

const isDisplayableImage = (f: File) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type);

function OrderPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = dict[lang];
  const [num, setNum] = useState("");
  const [size, setSize] = useState<string>("");
  const [name, setName] = useState("");
  const [patchNum, setPatchNum] = useState(6);
  const [grade, setGrade] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [backStyle, setBackStyle] = useState<"en" | "ar">("en");
  const [slots, setSlots] = useState<SlotMap>(emptySlots);
  const [selected, setSelected] = useState<PatchId | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNumber: number; url: string } | null>(null);
  const [tab, setTab] = useState<ViewKey>("front");

  const customInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  const state = useMemo(() => ({ num, name, quote, customUrl, backStyle, slots }), [num, name, quote, customUrl, backStyle, slots]);
  const placed = countPlaced(slots);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const placeAt = (slot: Slot) => {
    if (!selected) {
      if (slots[slot]) {
        setSlots((s) => ({ ...s, [slot]: null }));
        return;
      }
      toast(t.selectFirst);
      return;
    }
    if (!canPlace(slots, slot, patchNum)) {
      toast.error(t.limitReached);
      return;
    }
    setSlots((s) => ({ ...s, [slot]: selected }));
  };

  const changePatchNum = (n: number) => {
    setPatchNum(n);
    setSlots((s) => trimToLimit(s, n));
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 15 - uploads.length);
    for (const f of list) {
      const id = crypto.randomUUID();
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const thumb = isDisplayableImage(f) ? URL.createObjectURL(f) : null;
      setUploads((u) => [...u, { id, name: f.name, thumb, isPdf, pdf: null, status: "converting" }]);
      try {
        const pdf = await fileToPdf(f);
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, pdf, status: "ready" } : x)));
      } catch (e) {
        console.error(e);
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error" } : x)));
      }
    }
  };

  const onCustomPatch = async (f: File) => {
    let display: Blob = f;
    if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) {
      const heic2any = (await import("heic2any")).default;
      const out = await heic2any({ blob: f, toType: "image/jpeg" });
      display = (Array.isArray(out) ? out[0] : out) ?? f;
    }
    if (display.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setCustomUrl(reader.result as string);
      reader.readAsDataURL(display);
    }
    setSelected("custom");
    addFiles([f]);
  };

  const submit = async () => {
    const parsed = orderSchema.safeParse({ num, size, name, patchNum, grade, note, backStyle, quote });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      toast.error(t.fixErrors);
      return;
    }
    setErrors({});
    if (uploads.some((u) => u.status === "converting")) {
      toast("Please wait — files are still converting.");
      return;
    }
    setSubmitting(true);
    try {
      const ready = uploads.filter((u) => u.status === "ready" && u.pdf);
      const patches = SLOTS.filter((s) => slots[s]).map((s) => ({ slot: s, patch: slots[s]! }));
      const res = await createOrder({ data: { ...parsed.data, patches, fileNames: ready.map((u) => u.name) } });
      const files: { path: string; name: string }[] = [];
      for (let i = 0; i < ready.length; i++) {
        const up = res.uploads[i]!;
        const item = ready[i]!;
        const { error } = await supabase.storage.from("order-files").uploadToSignedUrl(up.path, up.token, item.pdf!, { contentType: "application/pdf" });
        if (error) throw error;
        files.push({ path: up.path, name: item.name });
      }
      // summary sheet
      setSheetOrder(res.orderNumber);
      await new Promise((r) => setTimeout(r, 80));
      const png = await toPng(sheetRef.current!, { pixelRatio: 2, cacheBust: true });
      const summary = await buildSummaryPdf(png, ready.map((u) => u.pdf!));
      const sumSlot = res.uploads[res.uploads.length - 1]!;
      const { error: sErr } = await supabase.storage.from("order-files").uploadToSignedUrl(sumSlot.path, sumSlot.token, summary, { contentType: "application/pdf" });
      if (sErr) throw sErr;
      await finalizeOrder({ data: { id: res.id, files, summaryPath: sumSlot.path } });
      setDone({ orderNumber: res.orderNumber, url: URL.createObjectURL(summary) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const [sheetOrder, setSheetOrder] = useState<number | null>(null);

  const reset = () => {
    setDone(null);
    setNum("");
    setSize("");
    setName("");
    setPatchNum(6);
    setGrade("");
    setNote("");
    setQuote("");
    setSlots(emptySlots());
    setSelected(null);
    setCustomUrl(null);
    setUploads([]);
    setSheetOrder(null);
  };

  const scrollToView = (v: ViewKey) => {
    setTab(v);
    const el = swipeRef.current;
    if (el) el.scrollTo({ left: VIEWS.indexOf(v) * el.clientWidth * (lang === "ar" ? -1 : 1), behavior: "smooth" });
  };

  const viewLabel = (v: ViewKey) => t[v];

  if (done) {
    return (
      <main className="grain-bg flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center animate-pop">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 font-varsity text-3xl">{t.thanks}</h1>
          <p className="mt-6 text-sm text-muted-foreground">{t.orderNo}</p>
          <p className="font-varsity text-6xl text-primary">#{done.orderNumber}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild size="lg">
              <a href={done.url} download={`order-${done.orderNumber}.pdf`}>
                <Download /> {t.download}
              </a>
            </Button>
            <Button variant="secondary" onClick={reset}>{t.newOrder}</Button>
          </div>
        </div>
      </main>
    );
  }

  const field = (key: string) => (errors[key] ? "border-destructive focus-visible:ring-destructive" : "");
  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="mt-1 text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <main className="grain-bg min-h-screen pb-28 lg:pb-12">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-6">
        <div className="min-w-0">
          <h1 className="truncate font-varsity text-2xl sm:text-3xl">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
          {lang === "en" ? "عربي" : "English"}
        </Button>
      </header>

      <div className="mx-auto mt-6 grid max-w-6xl gap-8 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* PREVIEW */}
        <section className="lg:sticky lg:top-6 lg:self-start">
          {/* mobile tabs + swipe */}
          <div className="lg:hidden">
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-secondary p-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => scrollToView(v)}
                  className={cn("rounded-lg px-1 py-2 text-xs font-semibold transition-colors", tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {viewLabel(v)}
                </button>
              ))}
            </div>
            <div
              ref={swipeRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
                if (VIEWS[i] && VIEWS[i] !== tab) setTab(VIEWS[i]);
              }}
              className="mt-3 flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-card [scrollbar-width:none]"
            >
              {VIEWS.map((v) => (
                <div key={v} className="flex aspect-square w-full shrink-0 snap-center items-center justify-center p-6">
                  <JacketView view={v} state={state} onSlotClick={v === "left" || v === "right" ? placeAt : undefined} className={v === "left" || v === "right" ? "h-full w-auto max-w-none" : ""} />
                </div>
              ))}
            </div>
          </div>
          {/* desktop stacked */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-2">
            {VIEWS.map((v) => (
              <div key={v} className="rounded-2xl border bg-card p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{viewLabel(v)}</p>
                <div className="flex aspect-square items-center justify-center">
                  <JacketView view={v} state={state} onSlotClick={v === "left" || v === "right" ? placeAt : undefined} className={v === "left" || v === "right" ? "h-full w-auto max-w-none" : ""} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PICKER + FORM */}
        <section className="space-y-8">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{t.patches}</h2>
              <span className={cn("text-sm tabular-nums", placed >= patchNum ? "text-primary" : "text-muted-foreground")}>
                {placed}/{patchNum} {t.placed}
              </span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{t.tapTile}</p>
            <div className="grid grid-cols-2 gap-3">
              {TILE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={PATCH_LABELS[id]}
                  aria-pressed={selected === id}
                  onClick={() => {
                    if (id === "custom" && !customUrl) {
                      customInput.current?.click();
                      return;
                    }
                    setSelected(selected === id ? null : id);
                  }}
                  onDoubleClick={() => id === "custom" && customInput.current?.click()}
                  className={cn("patch-tile h-24 p-3 text-[18px] sm:h-28", id === "quote" && "col-span-2", selected === id && "tile-selected")}
                >
                  <PatchArt id={id} ctx={state} />
                </button>
              ))}
            </div>
            {customUrl && (
              <button className="mt-2 text-xs text-muted-foreground underline" onClick={() => customInput.current?.click()}>
                Replace custom patch image
              </button>
            )}
            <input
              ref={customInput}
              type="file"
              accept={ACCEPTED_UPLOADS.replace(",.pdf", "").replace(",application/pdf", "")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCustomPatch(f);
                e.target.value = "";
              }}
            />

            <p className="mt-5 mb-2 text-sm font-semibold">{t.placeOn}</p>
            <div className="grid grid-cols-2 gap-3">
              {(["L", "R"] as const).map((side) => (
                <div key={side} className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{side === "L" ? t.left : t.right}</p>
                  {[1, 2, 3].map((n) => {
                    const s = `${side}${n}` as Slot;
                    const p = slots[s];
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => placeAt(s)}
                          className={cn(
                            "flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-secondary px-3 text-left text-sm transition-colors hover:border-primary",
                            p && "border-primary/50",
                          )}
                        >
                          <span className="font-varsity text-primary">{n}</span>
                          {p ? (
                            <span className="h-8 w-10 shrink-0 rounded-md bg-jacket-body p-0.5 text-[10px]">
                              <PatchArt id={p} ctx={state} onJacket />
                            </span>
                          ) : null}
                          <span className="truncate text-muted-foreground">{p ? PATCH_LABELS[p] : "—"}</span>
                        </button>
                        {p && (
                          <button type="button" aria-label={t.remove} onClick={() => setSlots((x) => ({ ...x, [s]: null }))} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* FORM */}
          <div className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="num">{t.num} *</Label>
                <Input id="num" inputMode="numeric" placeholder="01" maxLength={3} value={num} onChange={(e) => setNum(e.target.value.replace(/[^0-9٠-٩]/g, ""))} className={cn("mt-1.5 font-varsity text-lg", field("num"))} />
                <Err k="num" />
              </div>
              <div>
                <Label>{t.size} *</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className={cn("mt-1.5 w-full", field("size"))}>
                    <SelectValue placeholder={t.selectSize} />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Err k="size" />
              </div>
            </div>
            <div>
              <Label htmlFor="name">{t.name} *</Label>
              <Input id="name" dir="auto" placeholder="AAAAAA / الاسم" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} className={cn("mt-1.5", field("name"))} />
              <Err k="name" />
            </div>
            <div>
              <Label>{t.patchNum} *</Label>
              <div className="mt-1.5 grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changePatchNum(n)}
                    className={cn("h-11 rounded-xl border font-varsity text-lg transition-colors", patchNum === n ? "border-primary bg-primary text-primary-foreground" : "bg-secondary")}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Err k="patchNum" />
            </div>
            <div>
              <Label htmlFor="grade">{t.grade} *</Label>
              <Input id="grade" placeholder="12A" maxLength={10} value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} className={cn("mt-1.5", field("grade"))} />
              <Err k="grade" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t.backNumber}</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["en", "ar"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBackStyle(s)}
                      className={cn("h-11 rounded-xl border text-xl transition-colors", s === "en" ? "font-varsity" : "font-arabic", backStyle === s ? "border-primary bg-primary text-primary-foreground" : "bg-secondary")}
                    >
                      {s === "en" ? "27" : "٢٧"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="quote">{t.quote}</Label>
                <Input id="quote" dir="auto" placeholder="your quote" maxLength={40} value={quote} onChange={(e) => setQuote(e.target.value)} className={cn("mt-1.5 font-quote italic", field("quote"))} />
                <Err k="quote" />
              </div>
            </div>
            <div>
              <Label htmlFor="note">{t.note} <span className="text-muted-foreground">({t.optional})</span></Label>
              <Textarea id="note" dir="auto" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
              <Err k="note" />
            </div>
          </div>

          {/* UPLOADS */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold">{t.uploads}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.uploadHint}</p>
            <button
              type="button"
              onClick={() => filesInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed bg-secondary/50 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <ImagePlus className="h-6 w-6" /> {t.addFiles}
            </button>
            <input
              ref={filesInput}
              type="file"
              multiple
              accept={ACCEPTED_UPLOADS}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {uploads.length > 0 && (
              <ul className="mt-4 space-y-2">
                {uploads.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl bg-secondary p-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {u.thumb ? <img src={u.thumb} alt="" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{u.name}</p>
                      {u.status === "converting" && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t.converting}</span>}
                      {u.status === "ready" && <Badge className="mt-0.5">{u.isPdf ? t.keptPdf : t.converted}</Badge>}
                      {u.status === "error" && <Badge variant="destructive" className="mt-0.5">{t.failed}</Badge>}
                    </div>
                    <button type="button" aria-label={t.remove} onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))} className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <Button size="lg" className="h-14 w-full text-base font-bold" disabled={submitting} onClick={submit}>
              {submitting ? <><Loader2 className="animate-spin" /> {t.submitting}</> : t.submit}
            </Button>
          </div>
        </section>
      </div>

      {/* Off-screen sheet captured into the summary PDF */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]" dir="ltr">
        <div ref={sheetRef} className="summary-sheet w-[1000px] p-10 font-sans">
          <div className="flex items-end justify-between border-b-2 border-tile-ink pb-4">
            <h2 className="font-varsity text-4xl">EM Varsity Jacket</h2>
            <p className="font-varsity text-3xl">Order #{sheetOrder ?? "—"}</p>
          </div>
          <div className="mt-6 grid grid-cols-4 items-center gap-4">
            {VIEWS.map((v) => (
              <div key={v} className="text-center">
                <div className="flex h-56 items-center justify-center"><JacketView view={v} state={state} className={v === "left" || v === "right" ? "h-full w-auto max-w-none" : ""} /></div>
                <p className="mt-2 text-sm font-semibold uppercase tracking-widest">{dict.en[v]}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8">
            <table className="w-full text-lg">
              <tbody>
                {[
                  ["NUM", num],
                  ["SIZE", size],
                  ["NAME", name],
                  ["PATCH NUM", String(patchNum)],
                  ["GRADE", grade],
                  ["BACK STYLE", backStyle === "en" ? "English (27)" : "Arabic (٢٧)"],
                  ["QUOTE", quote || "—"],
                  ["NOTE", note || "—"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-tile">
                    <td className="py-1.5 pe-4 font-bold">{k}</td>
                    <td className="py-1.5" dir="auto">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <p className="mb-2 font-bold">PATCHES</p>
              <div className="grid grid-cols-3 gap-3">
                {SLOTS.map((s) => (
                  <div key={s} className="text-center">
                    <div className="h-20 rounded-lg bg-jacket-body p-2 text-[14px]">{slots[s] && <PatchArt id={slots[s]!} ctx={state} onJacket />}</div>
                    <p className="mt-1 text-xs">{s.startsWith("L") ? "Left" : "Right"} {s[1]} · {slots[s] ? PATCH_LABELS[slots[s]!] : "empty"}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm">Attached files: {uploads.filter((u) => u.status === "ready").length}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
