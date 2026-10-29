import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { orderSchema, SLOTS, PATCH_IDS } from "./jacket";

const BUCKET = "order-files";

const createInput = orderSchema.extend({
  patches: z.array(z.object({ slot: z.enum(SLOTS), patch: z.enum(PATCH_IDS) })).max(6),
  fileNames: z.array(z.string().max(200)).max(15),
});

function safeName(n: string, i: number) {
  const base = n.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "file";
  return `${String(i + 1).padStart(2, "0")}_${base}.pdf`;
}

/** Creates the order row and returns one-time upload slots for its PDFs. */
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data }) => {
    if (data.patches.length > data.patchNum) throw new Error("Too many patches for the chosen PATCH NUM");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        num: data.num,
        size: data.size,
        name: data.name,
        patch_num: data.patchNum,
        grade: data.grade.toUpperCase(),
        note: data.note || null,
        back_style: data.backStyle,
        quote: data.quote || null,
        patches: data.patches,
      })
      .select("id, order_number")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not save order");

    const paths = [...data.fileNames.map((n, i) => `${row.id}/uploads/${safeName(n, i)}`), `${row.id}/order-summary-${row.order_number}.pdf`];
    const uploads = [];
    for (const path of paths) {
      const { data: s, error: e } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (e || !s) throw new Error(e?.message ?? "Upload slot failed");
      uploads.push({ path, token: s.token });
    }
    return { id: row.id, orderNumber: row.order_number, uploads };
  });

/** Records uploaded file paths + summary path. Only allowed once per order. */
export const finalizeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        files: z.array(z.object({ path: z.string().max(300), name: z.string().max(200) })).max(15),
        summaryPath: z.string().max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ok = (p: string) => p.startsWith(`${data.id}/`);
    if (!ok(data.summaryPath) || !data.files.every((f) => ok(f.path))) throw new Error("Invalid paths");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ files: data.files, summary_pdf_path: data.summaryPath })
      .eq("id", data.id)
      .is("summary_pdf_path", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function checkPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Admin password is not set up yet");
  if (pw !== expected) throw new Error("Wrong password");
}

export const adminListOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().max(200), grade: z.string().max(10).optional(), size: z.string().max(4).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.grade) q = q.eq("grade", data.grade.toUpperCase());
    if (data.size) q = q.eq("size", data.size);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const all = await supabaseAdmin.from("orders").select("grade");
    const grades = [...new Set((all.data ?? []).map((r) => r.grade))].sort();
    return { orders: rows ?? [], grades };
  });

export const adminFileLinks = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().max(200), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("orders").select("files, summary_pdf_path").eq("id", data.id).single();
    if (error || !row) throw new Error("Order not found");
    const items = [
      ...(row.summary_pdf_path ? [{ name: "Order summary", path: row.summary_pdf_path }] : []),
      ...((row.files as { path: string; name: string }[]) ?? []),
    ];
    const links = [];
    for (const it of items) {
      const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(it.path, 600, { download: true });
      if (s) links.push({ name: it.name, url: s.signedUrl });
    }
    return { links };
  });
