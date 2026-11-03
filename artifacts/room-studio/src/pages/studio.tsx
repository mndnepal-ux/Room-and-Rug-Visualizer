import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Expand, Shrink, Share2, Bookmark, RotateCcw, RotateCw, Upload, Search, Trash2,
  Eye, EyeOff, Lock, Unlock, Move, HardDrive, ImagePlus, X, Check, FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SCENES, CANVAS_W, CANVAS_H, CROP_Y, type Scene } from "@/lib/scenes";
import { CATALOG, makeRugTexture, rugThumb, type Rug, type Category, type ColorFamily } from "@/lib/rugs";
import { drawRoom, drawDetail, drawPlan, hitRug, unproject, movementBounds, registerPhotoFloorMask, type RugPlacement, type TexSource } from "@/lib/render";
import { isVisibleFloor } from "@/lib/floor-masks";
import {
  putUpload, getUploads, deleteUpload, putThumb, getThumb, deleteThumb,
  loadDesigns, storeDesigns, type SavedDesign,
} from "@/lib/storage";

type View = "room" | "detail" | "plan";
type Tab = "rugs" | "rooms" | "saved";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const FILTERS: ("All" | Category)[] = ["MND Nepal", "All", "Uploads", "Flatweave", "Persian-inspired", "Berber", "Modern", "Solid"];
const FAMILIES: { id: ColorFamily; label: string; sw: string }[] = [
  { id: "warm", label: "Warm", sw: "#b23a2b" },
  { id: "cool", label: "Cool", sw: "#2f4058" },
  { id: "neutral", label: "Neutral", sw: "#d8c9ad" },
  { id: "bold", label: "Bold", sw: "#e1a02a" },
];
const PRESETS: [number, number][] = [[160, 230], [200, 300], [240, 170], [250, 350], [300, 200]];

const ftIn = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Image failed to load"));
    i.src = src;
  });
}

interface UploadRug extends Rug { img: HTMLImageElement; thumb: string }

function readUrlConfig() {
  const q = new URLSearchParams(window.location.search);
  const n = (k: string) => (q.get(k) != null && !isNaN(Number(q.get(k))) ? Number(q.get(k)) : undefined);
  const scene = q.get("scene") === "bedroom-2" ? "bedroom" : q.get("scene");
  return { scene: scene ?? undefined, rug: q.get("rug") ?? undefined, w: n("w"), h: n("h"), x: n("x"), y: n("y"), r: n("r") };
}

function CtlImpl({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
  <div>
    <div className="flex justify-between items-baseline"><span className="text-[13px] font-medium">{label}</span><span className="font-mono text-[11px] text-muted-foreground">{value}</span></div>
    {children}
  </div>
);
}
const Ctl = CtlImpl;

export default function Studio() {
  const { toast } = useToast();
  const init = useMemo(readUrlConfig, []);
  const [sceneId, setSceneId] = useState(SCENES.find((s) => s.id === init.scene)?.id ?? SCENES[0].id);
  const scene = SCENES.find((s) => s.id === sceneId) as Scene;
  const [uploads, setUploads] = useState<UploadRug[]>([]);
  const [rugId, setRugId] = useState(CATALOG.find((r) => r.id === init.rug)?.id ?? CATALOG[0].id);
  const allRugs: Rug[] = useMemo(() => [...uploads, ...CATALOG], [uploads]);
  const rug = allRugs.find((r) => r.id === rugId) ?? CATALOG[0];
  const [place, setPlace] = useState<RugPlacement>(() => {
    const r0 = CATALOG.find((r) => r.id === init.rug) ?? CATALOG[0];
    const s0 = SCENES.find((s) => s.id === init.scene) ?? SCENES[0];
    return { wCm: init.w ?? r0.wCm, hCm: init.h ?? r0.hCm, x: init.x ?? s0.defaultPos.x, y: init.y ?? s0.defaultPos.y, rot: init.r ?? 0 };
  });
  const [view, setView] = useState<View>("room");
  const [showRug, setShowRug] = useState(true);
  const [lockAspect, setLockAspect] = useState(true);
  const [tab, setTab] = useState<Tab>("rugs");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof FILTERS)[number]>("MND Nepal");
  const [catalogPage, setCatalogPage] = useState(1);
  const [fam, setFam] = useState<ColorFamily | null>(null);
  const [catalogImages, setCatalogImages] = useState<Record<string, HTMLImageElement>>({});
  const [catalogError, setCatalogError] = useState<{ id: string; message: string } | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [roomImgs, setRoomImgs] = useState<Record<string, HTMLImageElement>>({});
  const [roomErr, setRoomErr] = useState<string | null>(null);
  const [designs, setDesigns] = useState<SavedDesign[]>(() => loadDesigns());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [isFs, setIsFs] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const libraryScrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const exitFullscreenRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const texCache = useRef(new Map<string, HTMLCanvasElement>());
  const dragOff = useRef<[number, number] | null>(null);

  // Load room photos
  const loadRooms = useCallback(() => {
    setRoomErr(null);
    Promise.all(SCENES.map(async (s) => {
      const [photo, mask] = await Promise.all([loadImage(s.src), loadImage(s.maskSrc)]);
      registerPhotoFloorMask(s.id, mask);
      return [s.id, photo] as const;
    }))
      .then((pairs) => setRoomImgs(Object.fromEntries(pairs)))
      .catch(() => setRoomErr("A room photograph or its floor mask could not be loaded. Please retry."));
  }, []);
  useEffect(loadRooms, [loadRooms]);

  // Load only the selected full-size catalogue texture. Thumbnails use separate
  // small images, and same-origin storage serving keeps PNG export untainted.
  useEffect(() => {
    if (!rug.imageSrc || catalogImages[rug.id]) return;
    let active = true;
    setCatalogError(null);
    loadImage(rug.imageSrc).then((img) => {
      if (active) setCatalogImages((current) => ({ ...current, [rug.id]: img }));
    }).catch(() => {
      if (active) setCatalogError({ id: rug.id, message: `${rug.name} could not be loaded. Please try again.` });
    });
    return () => { active = false; };
  }, [rug.id, rug.imageSrc, catalogImages, catalogRetry]);

  // Load uploads from IndexedDB
  useEffect(() => {
    getUploads()
      .then(async (recs) => {
        const list: UploadRug[] = [];
        for (const r of recs.sort((a, b) => b.createdAt - a.createdAt)) {
          const url = URL.createObjectURL(r.blob);
          try {
            const img = await loadImage(url);
            list.push({ id: r.id, name: r.name, maker: "Your upload", category: "Uploads", family: "neutral", palette: [], wCm: r.wCm, hCm: r.hCm, upload: true, img, thumb: url });
          } catch { /* skip corrupt */ }
        }
        setUploads(list);
      })
      .catch(() => { /* storage unavailable; uploads still work per session */ });
  }, []);

  // Load saved thumbs
  useEffect(() => {
    designs.forEach((d) => {
      if (thumbs[d.id]) return;
      getThumb(d.id).then((t) => t && setThumbs((m) => ({ ...m, [d.id]: t }))).catch(() => {});
    });
  }, [designs, thumbs]);

  const tex: TexSource | null = useMemo(() => {
    const u = uploads.find((x) => x.id === rug.id);
    if (u) return u.img;
    if (rug.imageSrc) return catalogImages[rug.id] ?? null;
    const w = Math.round(place.wCm / 10) * 10, h = Math.round(place.hCm / 10) * 10;
    const k = `${rug.id}:${w}x${h}`;
    let t = texCache.current.get(k);
    if (!t) {
      t = makeRugTexture(rug, w, h);
      if (texCache.current.size > 40) texCache.current.clear();
      texCache.current.set(k, t);
    }
    return t;
  }, [rug, uploads, catalogImages, place.wCm, place.hCm]);

  const rugLoading = !!rug.imageSrc && !catalogImages[rug.id];
  const activeCatalogError = catalogError?.id === rug.id ? catalogError.message : null;

  const roomImg = roomImgs[scene.id];

  const paint = useCallback((ctx: CanvasRenderingContext2D, v: View) => {
    if (!roomImg) return;
    if (v === "room") drawRoom(ctx, roomImg, scene, tex, place, showRug);
    else if (v === "detail") drawDetail(ctx, roomImg, scene, tex, place, showRug);
    else drawPlan(ctx, scene, tex, place, showRug);
  }, [roomImg, scene, tex, place, showRug]);

  useEffect(() => {
    const c = canvasRef.current?.getContext("2d");
    if (!c) return;
    const id = requestAnimationFrame(() => paint(c, view));
    return () => cancelAnimationFrame(id);
  }, [paint, view]);

  // fullscreen
  useEffect(() => {
    const f = () => setIsFs(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => {
    if (!isFs) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => exitFullscreenRef.current?.focus());
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setIsFs(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [isFs]);

  const toggleFs = async () => {
    if (isFs) {
      setIsFs(false);
      if (document.fullscreenElement === stageRef.current) {
        try { await document.exitFullscreen(); }
        catch { toast({ title: "Use Esc to leave browser full screen" }); }
      }
      return;
    }
    // The expanded in-app view still works on mobile browsers and inside
    // preview iframes that do not grant the browser Fullscreen API permission.
    setIsFs(true);
    try {
      if (document.fullscreenEnabled && stageRef.current?.requestFullscreen)
        await stageRef.current.requestFullscreen();
    } catch {
      // Keep the expanded view when native full screen is unavailable.
    }
  };

  const bounds = movementBounds(scene);
  const clampPlace = useCallback((p: RugPlacement): RugPlacement => ({
    ...p,
    x: Math.max(bounds.minX, Math.min(bounds.maxX, p.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, p.y)),
  }), [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const update = (patch: Partial<RugPlacement>) => setPlace((p) => clampPlace({ ...p, ...patch }));

  const setWidth = (w: number) => setPlace((p) => ({ ...p, wCm: w, hCm: lockAspect ? Math.round((w * p.hCm) / p.wCm) : p.hCm }));
  const setLength = (h: number) => setPlace((p) => ({ ...p, hCm: h, wCm: lockAspect ? Math.round((h * p.wCm) / p.hCm) : p.wCm }));

  const resetRug = () => {
    setPlace({ wCm: rug.wCm, hCm: rug.hCm, x: scene.defaultPos.x, y: scene.defaultPos.y, rot: 0 });
    toast({ title: "Placement reset", description: `${rug.name} returned to ${rug.wCm} x ${rug.hCm} cm, centred.` });
  };

  const chooseRug = (r: Rug) => {
    setRugId(r.id);
    setShowRug(true);
    setPlace((p) => ({ ...p, wCm: r.wCm, hCm: r.hCm }));
  };
  const chooseScene = (s: Scene) => {
    setSceneId(s.id);
    setPlace((p) => ({ ...p, x: s.defaultPos.x, y: s.defaultPos.y }));
  };

  // Pointer drag on canvas
  const toCanvas = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * CANVAS_W, ((e.clientY - r.top) / r.height) * CANVAS_H] as const;
  };
  const onDown = (e: React.PointerEvent) => {
    if (view !== "room" || !showRug) return;
    const [px, py] = toCanvas(e);
    const [mx, my] = unproject(scene, px, py);
    if (!isVisibleFloor(scene.id, px, py + CROP_Y)) return;
    dragOff.current = hitRug(scene, place, px, py) ? [place.x - mx, place.y - my] : [0, 0];
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    update({ x: mx + dragOff.current[0], y: my + dragOff.current[1] });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragOff.current) return;
    const [px, py] = toCanvas(e);
    const [mx, my] = unproject(scene, px, py);
    update({ x: mx + dragOff.current[0], y: my + dragOff.current[1] });
  };
  const onUp = () => { setDragging(false); dragOff.current = null; };

  // keyboard nudges
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const step = e.shiftKey ? 0.25 : 0.05;
      if (e.key === "ArrowLeft") setPlace((p) => clampPlace({ ...p, x: p.x - step }));
      else if (e.key === "ArrowRight") setPlace((p) => clampPlace({ ...p, x: p.x + step }));
      else if (e.key === "ArrowUp") setPlace((p) => clampPlace({ ...p, y: p.y - step }));
      else if (e.key === "ArrowDown") setPlace((p) => clampPlace({ ...p, y: p.y + step }));
      else if (e.key.toLowerCase() === "r") setPlace((p) => ({ ...p, rot: (p.rot + (e.shiftKey ? -15 : 15) + 360) % 360 }));
      else if (e.key.toLowerCase() === "b") setShowRug((s) => !s);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [clampPlace]);

  // Upload
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      toast({ title: "Unsupported file", description: "Use a PNG, JPG or WebP image of your rug.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: `That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 8 MB.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      if (img.naturalWidth < 200 || img.naturalHeight < 200) {
        URL.revokeObjectURL(url);
        toast({ title: "Image too small", description: "Rug photos need to be at least 200 px on each side.", variant: "destructive" });
        return;
      }
      const ratio = img.naturalHeight / img.naturalWidth;
      const wCm = ratio > 1 ? Math.round(240 / ratio) : 240;
      const hCm = ratio > 1 ? 240 : Math.round(240 * ratio);
      const id = `up-${Date.now().toString(36)}`;
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 32) || "Untitled rug";
      const u: UploadRug = { id, name, maker: "Your upload", category: "Uploads", family: "neutral", palette: [], wCm, hCm, upload: true, img, thumb: url };
      setUploads((l) => [u, ...l]);
      setRugId(id);
      setShowRug(true);
      setPlace((p) => ({ ...p, wCm, hCm }));
      try {
        await putUpload({ id, name, blob: file, wCm, hCm, createdAt: Date.now() });
        toast({ title: "Rug added", description: `${name} is placed in the room and stored on this device.` });
      } catch {
        toast({ title: "Rug added for this session", description: "Local storage was unavailable, so it will not persist after reload." });
      }
    } catch {
      URL.revokeObjectURL(url);
      toast({ title: "Could not read image", description: "The file appears to be damaged. Try exporting it again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeUpload = async (id: string) => {
    try { await deleteUpload(id); } catch { /* ignore */ }
    setUploads((l) => l.filter((u) => u.id !== id));
    if (rugId === id) chooseRug(CATALOG[0]);
    setConfirmDel(null);
    toast({ title: "Upload removed", description: "Deleted from this device." });
  };

  // Export
  const renderToCanvas = (v: View, scale = 1) => {
    const c = document.createElement("canvas");
    c.width = CANVAS_W; c.height = CANVAS_H;
    paint(c.getContext("2d")!, v);
    if (scale === 1) return c;
    const s = document.createElement("canvas");
    s.width = Math.round(CANVAS_W * scale); s.height = Math.round(CANVAS_H * scale);
    s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
    return s;
  };

  const download = () => {
    if (!roomImg) return;
    if (showRug && !tex) {
      toast({ title: "Design is not ready", description: "Wait for the rug image to load before exporting.", variant: "destructive" });
      return;
    }
    try {
      const c = renderToCanvas(view);
      c.toBlob((b) => {
        if (!b) { toast({ title: "Export failed", description: "The browser could not encode the image.", variant: "destructive" }); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `room-studio-${scene.id}-${rug.id}-${view}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast({ title: "PNG downloaded", description: `${CANVAS_W} x ${CANVAS_H} px, ${view} view exactly as shown.` });
      }, "image/png");
    } catch {
      toast({ title: "Export failed", description: "Something went wrong composing the image.", variant: "destructive" });
    }
  };

  const shareUrl = () => {
    const u = new URL(window.location.href);
    u.search = new URLSearchParams({
      scene: scene.id, rug: rug.id, w: String(place.wCm), h: String(place.hCm),
      x: place.x.toFixed(2), y: place.y.toFixed(2), r: String(Math.round(place.rot)),
    }).toString();
    return u.toString();
  };

  const share = async () => {
    const url = shareUrl();
    const isUpload = !!rug.upload;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${rug.name} in ${scene.name}`, text: "A rug styled in Room Studio", url });
        toast({ title: "Shared", description: isUpload ? "Uploaded rugs stay on your device, so the link opens with a catalogue rug." : "Link sent." });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: isUpload ? "Room, size and position are in the link. Your uploaded image stays on this device." : "Room, rug, size and position are encoded in the link." });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast({ title: "Could not share", description: url, variant: "destructive" });
    }
  };

  const save = async () => {
    if (!roomImg) return;
    if (!tex) {
      toast({ title: "Design is not ready", description: "Wait for the rug image to load before saving.", variant: "destructive" });
      return;
    }
    const d: SavedDesign = {
      id: `d-${Date.now().toString(36)}`,
      name: saveName.trim() || `${rug.name}, ${scene.name}`,
      sceneId: scene.id, rugId: rug.id, rugName: rug.name, placement: place, createdAt: Date.now(),
    };
    try {
      const next = [d, ...designs];
      storeDesigns(next);
      setDesigns(next);
      const thumb = renderToCanvas("room", 0.3).toDataURL("image/jpeg", 0.78);
      setThumbs((m) => ({ ...m, [d.id]: thumb }));
      putThumb(d.id, thumb).catch(() => {});
      setSaveName("");
      setTab("saved");
      toast({ title: "Design saved", description: "Stored in this browser only. Clearing site data removes it." });
    } catch {
      toast({ title: "Save failed", description: "Browser storage is full or disabled.", variant: "destructive" });
    }
  };

  const openDesign = (d: SavedDesign) => {
    const r = allRugs.find((x) => x.id === d.rugId);
    if (!r) { toast({ title: "Rug missing", description: "That uploaded rug has been removed from this device.", variant: "destructive" }); return; }
    setSceneId(d.sceneId === "bedroom-2" ? "bedroom" : d.sceneId);
    setRugId(d.rugId);
    setPlace(d.placement);
    setShowRug(true);
    setView("room");
    toast({ title: "Design opened", description: d.name });
  };

  const removeDesign = (id: string) => {
    const next = designs.filter((d) => d.id !== id);
    storeDesigns(next);
    setDesigns(next);
    deleteThumb(id).catch(() => {});
    setConfirmDel(null);
    toast({ title: "Design deleted" });
  };

  const filtered = allRugs.filter((r) =>
    (cat === "All" || r.category === cat) &&
    (!fam || r.family === fam) &&
    (!query || `${r.name} ${r.maker} ${r.category}`.toLowerCase().includes(query.toLowerCase())),
  );

  useEffect(() => { setCatalogPage(1); }, [cat, fam, query]);
  useEffect(() => { libraryScrollRef.current?.scrollTo({ top: 0 }); }, [catalogPage, cat, fam, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(catalogPage, pageCount);
  const pageRugs = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  const thumbFor = (r: Rug) => r.thumbnailSrc ?? (r.upload ? (r as UploadRug).thumb : rugThumb(r));
  const pct = (v: number, a: number, b: number) => ({ ["--pct" as string]: `${((v - a) / (b - a)) * 100}%` }) as React.CSSProperties;

  /* ---------- UI ---------- */
  const library = (
    <section className="flex flex-col min-h-0 h-full" data-testid="panel-library">
      <div className="flex gap-1 p-1 mx-4 mt-4 rounded-full bg-muted" role="tablist">
        {(["rugs", "rooms", "saved"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} data-testid={`tab-${t}`} onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 text-[13px] font-medium capitalize transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}{t === "saved" && designs.length > 0 && <span className="ml-1 font-mono text-[10px] text-primary">{designs.length}</span>}
          </button>
        ))}
      </div>

      {tab === "rugs" && (
        <div className="flex flex-col min-h-0 flex-1">
          <div className="px-4 pt-4 space-y-3">
            <div className="rounded-lg bg-card border px-3 py-2">
              <p className="text-xs font-medium">Modern Nature Design Nepal</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">81 designs from collection pages 1–5</p>
              <a href="https://modernnaturedesignnepal.com/collections" target="_blank" rel="noreferrer" className="text-[11px] text-primary underline underline-offset-2">View original collection</a>
            </div>
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input data-testid="input-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rugs or makers"
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-card border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              {query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>}
            </label>
            <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1 -mx-1 px-1">
              {FILTERS.map((f) => (
                <button key={f} data-testid={`filter-${f}`} onClick={() => setCat(f)}
                  className={`shrink-0 px-2.5 h-7 rounded-full text-xs border transition-colors ${cat === f ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>{f}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Colour</span>
              {FAMILIES.map((f) => (
                <button key={f.id} data-testid={`filter-color-${f.id}`} onClick={() => setFam(fam === f.id ? null : f.id)} title={f.label} aria-pressed={fam === f.id}
                  className={`flex items-center gap-1.5 h-6 pl-1 pr-2 rounded-full border text-[11px] transition ${fam === f.id ? "border-foreground bg-card" : "border-transparent hover:border-border"}`}>
                  <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: f.sw }} />{f.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={libraryScrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 py-4">
            <button data-testid="button-upload" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDropHover(true); }} onDragLeave={() => setDropHover(false)}
              onDrop={(e) => { e.preventDefault(); setDropHover(false); handleFile(e.dataTransfer.files[0]); }}
              className={`w-full mb-4 rounded-xl border-[1.5px] border-dashed p-4 flex items-center gap-3 text-left transition-all ${dropHover ? "border-primary bg-primary/5 scale-[1.01]" : "border-input hover:border-primary/60 hover:bg-card"}`}>
              <span className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                {uploading ? <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <ImagePlus className="size-5" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{uploading ? "Reading your rug..." : "Upload your own rug"}</span>
                <span className="block text-xs text-muted-foreground">PNG, JPG or WebP, flat top-down, up to 8 MB</span>
              </span>
            </button>
            {filtered.length === 0 ? (
              <div className="text-center py-10 px-4 rise" data-testid="empty-rugs">
                <div className="mx-auto mb-3 h-12 w-16 rounded border border-dashed border-input" style={{ backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--border)) 0 2px, transparent 2px 8px)" }} />
                <p className="font-display text-lg">Nothing on the loom</p>
                <p className="text-xs text-muted-foreground mt-1">No rugs match these filters.</p>
                <button className="mt-3 text-xs text-primary underline underline-offset-4" onClick={() => { setQuery(""); setCat("All"); setFam(null); }}>Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pageRugs.map((r, i) => (
                  <div key={r.id} className="relative group rise" style={{ animationDelay: `${i * 25}ms` }}>
                    <button data-testid={`card-rug-${r.id}`} onClick={() => chooseRug(r)}
                      className={`w-full text-left rounded-xl p-2 transition-all ${rugId === r.id ? "bg-card ring-2 ring-primary shadow-md" : "hover:bg-card hover:shadow-sm"}`}>
                      <div className="aspect-[4/3] rounded-lg bg-muted grid place-items-center overflow-hidden">
                         <img src={thumbFor(r)} alt={r.name} loading="lazy" decoding="async" className="max-h-[86%] max-w-[86%] object-contain drop-shadow-[0_3px_4px_rgba(30,18,8,0.25)] transition-transform duration-300 group-hover:scale-[1.05] group-hover:-rotate-1" />
                      </div>
                      <p className="mt-2 text-[13px] font-medium leading-tight truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.maker}</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{r.sourcePage ? `Collection page ${r.sourcePage}` : `${r.wCm} x ${r.hCm} cm`}</p>
                    </button>
                    {r.upload && (
                      confirmDel === r.id ? (
                        <div className="absolute top-3 right-3 flex gap-1">
                          <button aria-label="Confirm delete" data-testid={`button-confirm-delete-upload-${r.id}`} onClick={() => removeUpload(r.id)} className="size-7 grid place-items-center rounded-full bg-destructive text-destructive-foreground"><Check className="size-3.5" /></button>
                          <button aria-label="Cancel" onClick={() => setConfirmDel(null)} className="size-7 grid place-items-center rounded-full bg-card border"><X className="size-3.5" /></button>
                        </div>
                      ) : (
                        <button aria-label="Delete upload" data-testid={`button-delete-upload-${r.id}`} onClick={() => setConfirmDel(r.id)} className="absolute top-3 right-3 size-7 grid place-items-center rounded-full bg-card/90 border opacity-0 group-hover:opacity-100 focus:opacity-100 transition"><Trash2 className="size-3.5" /></button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {filtered.length > 0 && (
            <nav aria-label="Rug collection pages" className="shrink-0 border-t px-4 py-3 bg-background">
              <p className="text-[11px] text-muted-foreground mb-2" role="status">
                {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, filtered.length)} of {filtered.length} designs
              </p>
              <div className="flex items-center justify-between gap-1">
                <button aria-label="Previous collection page" disabled={currentPage === 1} onClick={() => setCatalogPage(currentPage - 1)} className="text-xs py-1.5 px-1 disabled:opacity-30">Prev</button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                  <button key={page} data-testid={`catalog-page-${page}`} aria-label={`Collection page ${page}`} aria-current={currentPage === page ? "page" : undefined}
                    onClick={() => setCatalogPage(page)}
                    className={`size-7 rounded-md text-xs transition ${currentPage === page ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`}>{page}</button>
                ))}
                <button aria-label="Next collection page" disabled={currentPage === pageCount} onClick={() => setCatalogPage(currentPage + 1)} className="text-xs py-1.5 px-1 disabled:opacity-30">Next</button>
              </div>
            </nav>
          )}
        </div>
      )}

      {tab === "rooms" && (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3">
          <div className="pb-1">
            <p className="text-sm font-medium">Your room photos</p>
            <p className="text-xs text-muted-foreground mt-1">5 rooms · 1 bedroom · 1 lobby</p>
          </div>
          {SCENES.map((s, i) => (
            <button key={s.id} data-testid={`card-scene-${s.id}`} onClick={() => chooseScene(s)}
              className={`w-full flex gap-3 items-center rounded-xl p-2 text-left transition-all rise ${sceneId === s.id ? "bg-card ring-2 ring-primary shadow-md" : "hover:bg-card"}`} style={{ animationDelay: `${i * 40}ms` }}>
              <img src={s.src} alt={s.name} className="w-24 h-20 object-cover rounded-lg" />
              <span>
                <span className="eyebrow block">{s.room}</span>
                <span className="font-display text-lg block leading-tight">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === "saved" && (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4">
          <div className="rounded-lg bg-muted/70 p-3 text-xs text-muted-foreground flex gap-2 mb-4" data-testid="text-local-scope">
            <HardDrive className="size-4 shrink-0 text-secondary" />
            <span>Saved designs live only in this browser on this device. Nothing is uploaded. Clearing site data deletes them.</span>
          </div>
          {designs.length === 0 ? (
            <div className="text-center py-10 rise" data-testid="empty-saved">
              <Bookmark className="size-6 mx-auto text-muted-foreground" />
              <p className="font-display text-lg mt-2">No saved rooms yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto">Style a rug, then press Save to keep the room, rug, size and position here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {designs.map((d) => (
                <div key={d.id} className="rounded-xl bg-card border p-2 rise" data-testid={`card-design-${d.id}`}>
                  {thumbs[d.id] ? <img src={thumbs[d.id]} alt={d.name} className="w-full object-cover rounded-lg" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }} /> : <div className="w-full rounded-lg skel" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }} />}
                  <div className="flex items-start justify-between gap-2 mt-2 px-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{d.placement.wCm} x {d.placement.hCm} cm / {new Date(d.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {confirmDel === d.id ? (
                        <>
                          <button data-testid={`button-confirm-delete-${d.id}`} onClick={() => removeDesign(d.id)} className="h-7 px-2 rounded-md bg-destructive text-destructive-foreground text-xs">Delete</button>
                          <button onClick={() => setConfirmDel(null)} className="h-7 px-2 rounded-md border text-xs">Keep</button>
                        </>
                      ) : (
                        <>
                          <button data-testid={`button-open-${d.id}`} onClick={() => openDesign(d)} className="h-7 px-2 rounded-md bg-secondary text-secondary-foreground text-xs flex items-center gap-1"><FolderOpen className="size-3.5" />Open</button>
                          <button aria-label="Delete design" data-testid={`button-delete-${d.id}`} onClick={() => setConfirmDel(d.id)} className="size-7 grid place-items-center rounded-md border hover:bg-destructive/10 hover:text-destructive transition"><Trash2 className="size-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );

  const controls = (
    <section className="p-5 space-y-6" data-testid="panel-controls">
      <div>
        <span className="eyebrow">Now styling</span>
        <h2 className="font-display text-2xl leading-tight mt-1" data-testid="text-rug-name">{rug.name}</h2>
        <p className="text-xs text-muted-foreground">{rug.maker} / {rug.category}</p>
        {rug.sourcePage && <p className="text-[11px] text-muted-foreground mt-1">Original design · collection page {rug.sourcePage}. Sizes below are adjustable preview sizes.</p>}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Size</span>
          <button data-testid="button-lock-aspect" onClick={() => setLockAspect((l) => !l)} className={`flex items-center gap-1 text-[11px] px-2 h-6 rounded-full border transition ${lockAspect ? "border-secondary text-secondary" : "text-muted-foreground"}`}>
            {lockAspect ? <Lock className="size-3" /> : <Unlock className="size-3" />}{lockAspect ? "Ratio locked" : "Free ratio"}
          </button>
        </div>
        <Ctl label="Width" value={`${place.wCm} cm / ${ftIn(place.wCm)}`}>
          <input type="range" className="range" min={60} max={420} step={5} value={place.wCm} style={pct(place.wCm, 60, 420)} data-testid="input-width" onChange={(e) => setWidth(Number(e.target.value))} />
        </Ctl>
        <Ctl label="Length" value={`${place.hCm} cm / ${ftIn(place.hCm)}`}>
          <input type="range" className="range" min={60} max={420} step={5} value={place.hCm} style={pct(place.hCm, 60, 420)} data-testid="input-length" onChange={(e) => setLength(Number(e.target.value))} />
        </Ctl>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([w, h]) => (
            <button key={`${w}x${h}`} data-testid={`button-preset-${w}x${h}`} onClick={() => setPlace((p) => ({ ...p, wCm: w, hCm: h }))}
              className={`font-mono text-[11px] h-7 px-2 rounded-md border transition ${place.wCm === w && place.hCm === h ? "bg-primary text-primary-foreground border-primary" : "hover:border-foreground/40"}`}>{w}x{h}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <span className="eyebrow">Position and rotation</span>
        <Ctl label="Across room" value={`${place.x.toFixed(2)} m`}>
          <input type="range" className="range" min={bounds.minX} max={bounds.maxX} step={0.01} value={place.x} style={pct(place.x, bounds.minX, bounds.maxX)} data-testid="input-x" onChange={(e) => update({ x: Number(e.target.value) })} />
        </Ctl>
        <Ctl label="Depth" value={`${place.y.toFixed(2)} m from wall`}>
          <input type="range" className="range" min={bounds.minY} max={bounds.maxY} step={0.01} value={place.y} style={pct(place.y, bounds.minY, bounds.maxY)} data-testid="input-y" onChange={(e) => update({ y: Number(e.target.value) })} />
        </Ctl>
        <Ctl label="Rotation" value={`${Math.round(place.rot)} deg`}>
          <div className="flex items-center gap-2">
            <button aria-label="Rotate left 15 degrees" data-testid="button-rotate-left" onClick={() => update({ rot: (place.rot - 15 + 360) % 360 })} className="size-8 shrink-0 grid place-items-center rounded-md border hover:bg-muted active:scale-95 transition"><RotateCcw className="size-4" /></button>
            <input type="range" className="range" min={0} max={359} step={1} value={place.rot} style={pct(place.rot, 0, 359)} data-testid="input-rotation" onChange={(e) => update({ rot: Number(e.target.value) })} />
            <button aria-label="Rotate right 15 degrees" data-testid="button-rotate-right" onClick={() => update({ rot: (place.rot + 15) % 360 })} className="size-8 shrink-0 grid place-items-center rounded-md border hover:bg-muted active:scale-95 transition"><RotateCw className="size-4" /></button>
          </div>
        </Ctl>
        <button data-testid="button-reset" onClick={resetRug} className="w-full h-9 rounded-lg border border-input text-sm flex items-center justify-center gap-2 hover:bg-muted active:scale-[.99] transition">
          <RotateCcw className="size-4" />Reset placement
        </button>
      </div>

      <div className="space-y-2">
        <span className="eyebrow">Keep this room</span>
        <input data-testid="input-design-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={`${rug.name}, ${scene.name}`} maxLength={60}
          className="w-full h-9 px-3 rounded-lg bg-card border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30" />
        <button data-testid="button-save" onClick={save} disabled={!roomImg || !tex} className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:brightness-110 active:scale-[.99] transition disabled:opacity-50">
          <Bookmark className="size-4" />Save design locally
        </button>
        <p className="text-[11px] text-muted-foreground flex gap-1.5"><HardDrive className="size-3.5 shrink-0 mt-px" />Saved to this browser only. Uploads stay on your device.</p>
      </div>

      <div className="hidden lg:block text-[11px] text-muted-foreground border-t pt-4 space-y-1 font-mono">
        <p>DRAG rug to move / ARROWS nudge</p>
        <p>R rotate / B before-after</p>
      </div>
    </section>
  );

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-background">
      <input ref={fileRef} type="file" accept={ACCEPT.join(",")} className="hidden" data-testid="input-file" onChange={(e) => handleFile(e.target.files?.[0])} />
      <header className="h-14 shrink-0 flex items-center justify-between px-4 lg:px-5 border-b bg-background/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-md bg-primary grid grid-cols-3 gap-[2px] p-[5px]" aria-hidden>
            {Array.from({ length: 9 }).map((_, i) => <span key={i} className={`rounded-[1px] ${i % 2 ? "bg-accent" : "bg-primary-foreground/90"}`} />)}
          </div>
          <div className="leading-none">
            <h1 className="font-display text-xl">Room Studio</h1>
            <p className="hidden sm:block text-[11px] text-muted-foreground mt-0.5">See the rug in the room before it leaves the loom</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground mr-2 px-2 h-7 rounded-full bg-muted"><HardDrive className="size-3.5" />Local saves · uploads stay on your device</span>
          <button data-testid="button-upload-header" onClick={() => fileRef.current?.click()} className="hidden sm:flex h-9 px-3 rounded-lg border text-sm items-center gap-2 hover:bg-muted transition"><Upload className="size-4" />Upload rug</button>
          <button data-testid="button-share" onClick={share} className="h-9 px-3 rounded-lg border text-sm flex items-center gap-2 hover:bg-muted transition"><Share2 className="size-4" /><span className="hidden sm:inline">Share</span></button>
          <button data-testid="button-download" onClick={download} disabled={!roomImg || (showRug && !tex)} className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground text-sm flex items-center gap-2 hover:brightness-125 transition disabled:opacity-50"><Download className="size-4" /><span className="hidden sm:inline">PNG</span></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[320px_1fr_300px]">
        <aside className="order-3 lg:order-1 lg:border-r bg-sidebar/50 min-h-0 h-[560px] lg:h-auto">{library}</aside>

        <main className="order-1 lg:order-2 min-h-0 flex flex-col p-3 lg:p-5 gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex p-1 rounded-full bg-muted" role="tablist" aria-label="Preview view">
              {([["room", "Room"], ["detail", "Close-up"], ["plan", "Plan"]] as [View, string][]).map(([v, l]) => (
                <button key={v} data-testid={`view-${v}`} onClick={() => setView(v)} aria-selected={view === v} role="tab"
                  className={`px-3 h-7 rounded-full text-xs font-medium transition-all ${view === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button data-testid="button-before-after" onClick={() => setShowRug((s) => !s)} aria-pressed={!showRug}
                className={`h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border transition ${!showRug ? "bg-accent text-accent-foreground border-accent" : "hover:bg-muted"}`}>
                {showRug ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}{showRug ? "After" : "Before"}
              </button>
              <button data-testid="button-fullscreen" aria-label="Full screen" aria-pressed={isFs} onClick={toggleFs} className="h-8 px-3 flex items-center gap-1.5 rounded-full border hover:bg-muted transition text-xs font-medium"><Expand className="size-3.5" /><span>Full screen</span></button>
            </div>
          </div>

          <div ref={stageRef} className={`flex items-center justify-center ${isFs ? "fixed inset-0 z-[100] bg-[#1b1714] p-3 sm:p-6" : "relative flex-1 min-h-0"}`} data-testid="stage">
            {isFs && (
              <button ref={exitFullscreenRef} onClick={toggleFs} data-testid="button-exit-fullscreen" className="absolute z-10 top-3 right-3 h-10 px-4 rounded-full bg-card shadow-lg border text-sm font-medium flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary"><Shrink className="size-4" />Exit full screen</button>
            )}
            <div className="relative w-full max-h-full" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, maxWidth: isFs ? `calc((100dvh - 48px) * ${CANVAS_W / CANVAS_H})` : `min(100%, calc((100dvh - 170px) * ${CANVAS_W / CANVAS_H}))` }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} data-testid="canvas-room"
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className={`w-full h-full rounded-xl shadow-[0_24px_60px_-28px_rgba(31,42,68,0.55)] touch-none select-none ${view === "room" && showRug ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`} />
              {!roomImg && !roomErr && <div className="absolute inset-0 rounded-xl skel" data-testid="status-loading" />}
              {roomImg && showRug && rugLoading && (
                <div role="status" className="absolute top-3 left-3 right-3 rounded-lg bg-card/95 border px-3 py-2 text-xs shadow-sm">
                  {activeCatalogError ? (
                    <><p className="text-destructive">{activeCatalogError}</p><button className="mt-1 text-primary underline" onClick={() => setCatalogRetry((v) => v + 1)}>Retry design image</button></>
                  ) : <p>Loading {rug.name}…</p>}
                </div>
              )}
              {roomErr && (
                <div className="absolute inset-0 rounded-xl bg-muted grid place-items-center text-center p-6" data-testid="status-error">
                  <div><p className="font-display text-xl">The room did not load</p><p className="text-sm text-muted-foreground mt-1">{roomErr}</p>
                    <button onClick={loadRooms} className="mt-3 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm">Try again</button></div>
                </div>
              )}
              {roomImg && (
                <>
                  <div className="absolute left-3 bottom-3 rounded-lg bg-[#1b1714]/70 text-[#f3ead8] backdrop-blur px-3 py-2 pointer-events-none">
                    <p className="text-[10px] font-mono tracking-[.14em] uppercase opacity-70">{scene.room} / {view === "plan" ? "Plan view" : view === "detail" ? "Close-up" : "Room view"}</p>
                    <p className="font-display text-base leading-tight">{scene.name}</p>
                  </div>
                  {!showRug && <div className="absolute top-3 left-3 rounded-full bg-accent text-accent-foreground px-3 h-7 grid place-items-center text-[11px] font-medium pointer-events-none">Before: bare floor</div>}
                  {view === "room" && showRug && !dragging && (
                    <div className="absolute right-3 bottom-3 rounded-full bg-card/85 backdrop-blur px-3 h-7 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground pointer-events-none"><Move className="size-3.5" />Drag rug or click anywhere on the floor</div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        <aside className="order-2 lg:order-3 lg:border-l overflow-y-auto scroll-thin bg-card/40">{controls}</aside>
      </div>
    </div>
  );
}
