import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFileLinks, adminListOrders } from "@/lib/orders.functions";
import { PATCH_LABELS, SIZES, type PatchId } from "@/lib/jacket";
import { countryByCode } from "@/lib/countries";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Orders Admin — EM Varsity" },
      { name: "description", content: "Private list of varsity jacket orders." },
      { property: "og:title", content: "Orders Admin — EM Varsity" },
      { property: "og:description", content: "Private list of varsity jacket orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Order = Awaited<ReturnType<typeof adminListOrders>>["orders"][number];
const KEY = "em-admin-pw";

function AdminPage() {
  const [pw, setPw] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [grade, setGrade] = useState("all");
  const [size, setSize] = useState("all");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (saved) setPw(saved);
  }, []);

  useEffect(() => {
    if (!pw) return;
    setLoading(true);
    adminListOrders({ data: { password: pw, grade: grade === "all" ? undefined : grade, size: size === "all" ? undefined : size } })
      .then((r) => {
        setOrders(r.orders);
        setGrades(r.grades);
        sessionStorage.setItem(KEY, pw);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not load orders");
        sessionStorage.removeItem(KEY);
        setPw(null);
      })
      .finally(() => setLoading(false));
  }, [pw, grade, size]);

  const download = async (id: string) => {
    if (!pw) return;
    setBusyId(id);
    try {
      const { links } = await adminFileLinks({ data: { password: pw, id } });
      if (!links.length) toast("No files for this order.");
      links.forEach((l, i) => setTimeout(() => window.open(l.url, "_blank"), i * 300));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!pw) {
    return (
      <main className="grain-bg flex min-h-screen items-center justify-center px-5">
        <form
          className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (input) setPw(input);
          }}
        >
          <h1 className="font-varsity text-2xl">Orders admin</h1>
          <Input type="password" placeholder="Password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          <Button type="submit" className="w-full">Enter</Button>
          <Link to="/" className="block text-center text-sm text-muted-foreground underline">Back to order form</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-varsity text-3xl">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => { sessionStorage.removeItem(KEY); setPw(null); }}>
            <LogOut />
          </Button>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Initials</TableHead>
              <TableHead>NUM</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Sleeve #</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Patches</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={12} className="py-10 text-center"><Loader2 className="mx-auto animate-spin" /></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>
            ) : (
              orders.map((o) => {
                const patches = (o.patches as { slot: string; patch: PatchId }[]) ?? [];
                const files = (o.files as unknown[]) ?? [];
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-varsity">{o.order_number}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell dir="auto">{o.name}</TableCell>
                    <TableCell className="font-varsity">{o.initials}</TableCell>
                    <TableCell>{o.num} <span className="text-xs text-muted-foreground">({o.back_style})</span></TableCell>
                    <TableCell>{countryByCode(o.country).flag} {countryByCode(o.country).name}</TableCell>
                    <TableCell className="font-varsity">{o.sleeve_number}</TableCell>
                    <TableCell>{o.size}</TableCell>
                    <TableCell>{o.grade}</TableCell>
                    <TableCell className="max-w-56 text-xs">{patches.map((p) => `${p.slot}: ${PATCH_LABELS[p.patch] ?? p.patch}`).join(", ") || "—"} <span className="text-muted-foreground">/ {o.patch_num}</span></TableCell>
                    <TableCell className="max-w-48 truncate text-xs" dir="auto">{o.note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" disabled={busyId === o.id || (!o.summary_pdf_path && !files.length)} onClick={() => download(o.id)}>
                        {busyId === o.id ? <Loader2 className="animate-spin" /> : <Download />} {files.length + (o.summary_pdf_path ? 1 : 0)}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
