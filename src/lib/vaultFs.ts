import { PIPELINE_DEFAULTS } from "@/lib/pipeline.config";
import { idbGet, idbSet } from "@/lib/vaultCopyIdb";

export const DEFAULT_VAULT_ABS = PIPELINE_DEFAULTS.final;
export const DEFAULT_DEST_ABS = "C:\\Users\\Windows\\Desktop\\Area Trabalho\\RESULTADOSGERAL";

export type VaultLayout = {
  contentSubdir: string | null;
  rootHasMd: boolean;
};

export type StoredVaultLayout = VaultLayout & { name: string };

export function hasFsAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode,
): Promise<boolean> {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

async function countMdInDir(dirHandle: FileSystemDirectoryHandle, limit: number): Promise<number> {
  let n = 0;
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && /\.md$/i.test(name)) {
      n++;
      if (limit && n >= limit) return n;
    }
  }
  return n;
}

export async function detectVaultLayout(rootHandle: FileSystemDirectoryHandle): Promise<VaultLayout> {
  let rootHasMd = false;
  const subdirs: { name: string; handle: FileSystemDirectoryHandle }[] = [];
  for await (const [name, handle] of rootHandle.entries()) {
    if (handle.kind === "file" && /\.md$/i.test(name)) rootHasMd = true;
    if (handle.kind === "directory") subdirs.push({ name, handle });
  }
  const conv = subdirs.find(
    (d) => d.name.localeCompare("conversations", undefined, { sensitivity: "accent" }) === 0,
  );
  if (conv) return { contentSubdir: conv.name, rootHasMd };

  let best: { name: string; mdCount: number } | null = null;
  for (const d of subdirs) {
    const mdCount = await countMdInDir(d.handle, 1);
    if (mdCount > 0) {
      const fullCount = await countMdInDir(d.handle, 0);
      if (!best || fullCount > best.mdCount) best = { name: d.name, mdCount: fullCount };
    }
  }
  if (best) return { contentSubdir: best.name, rootHasMd };
  return { contentSubdir: null, rootHasMd };
}

export function buildPathAttempts(relPath: string, layout: VaultLayout | null): string[] {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const attempts = [normalized];
  const base = normalized.split("/").pop();
  const sub = layout?.contentSubdir;

  if (normalized.toLowerCase().startsWith("conversations/")) {
    const without = normalized.slice("conversations/".length);
    attempts.push(without);
    if (sub && sub.toLowerCase() !== "conversations") attempts.push(`${sub}/${without}`);
  }
  if (sub) {
    if (!normalized.toLowerCase().startsWith(sub.toLowerCase() + "/")) {
      attempts.push(`${sub}/${normalized}`);
      if (!normalized.includes("/") && base) attempts.push(`${sub}/${base}`);
    }
  }
  if (normalized.includes("/") && base) attempts.push(base);
  if (sub && normalized === base && base) attempts.push(`${sub}/${base}`);
  return [...new Set(attempts.filter(Boolean))];
}

async function getFileFromPathOnce(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
): Promise<{ fileHandle: FileSystemFileHandle; fileName: string }> {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) throw new Error("caminho vazio");
  const fileName = parts.pop()!;
  let dir: FileSystemDirectoryHandle = rootHandle;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch (e) {
      let msg = (e as Error).message || String(e);
      if (msg.includes("Name is not allowed")) {
        msg += " — path ainda parece absoluto ou inválido; verifique o prefixo do vault";
      }
      throw new Error(msg);
    }
  }
  return { fileHandle: await dir.getFileHandle(fileName), fileName };
}

export async function getFileFromPath(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
  layout: VaultLayout | null,
): Promise<{ fileHandle: FileSystemFileHandle; fileName: string }> {
  const attempts = buildPathAttempts(relPath, layout);
  let lastErr: Error | undefined;
  for (const attempt of attempts) {
    try {
      return await getFileFromPathOnce(rootHandle, attempt);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  const tried = attempts.join(", ");
  const hint = layout?.contentSubdir
    ? ` — tentou: ${tried}; subpasta detectada: ${layout.contentSubdir}/`
    : ` — tentou: ${tried}`;
  throw new Error((lastErr?.message || String(lastErr)) + hint);
}

export async function readVaultFileText(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
  layout: VaultLayout | null,
): Promise<{ text: string; fileName: string }> {
  const { fileHandle, fileName } = await getFileFromPath(rootHandle, relPath, layout);
  const text = await (await fileHandle.getFile()).text();
  return { text, fileName };
}

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string,
  mime = "text/markdown",
): Promise<void> {
  const ok = await ensurePermission(dir, "readwrite");
  if (!ok) {
    throw new Error(
      `sem permissão de escrita na pasta "${dir.name}" — clique em Selecionar pasta destino e autorize novamente`,
    );
  }
  try {
    const outHandle = await dir.getFileHandle(name, { create: true });
    const w = await outHandle.createWritable();
    await w.write(new Blob([content], { type: mime }));
    await w.close();
  } catch (e) {
    const msg = (e as Error).message || String(e);
    throw new Error(`falha ao gravar ${name} em ${dir.name}: ${msg}`);
  }
}

export async function copyFileToDir(
  src: FileSystemFileHandle,
  destDir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<void> {
  const ok = await ensurePermission(destDir, "readwrite");
  if (!ok) {
    throw new Error(`sem permissão de escrita na pasta "${destDir.name}"`);
  }
  const file = await src.getFile();
  const newHandle = await destDir.getFileHandle(fileName, { create: true });
  const writable = await newHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

export async function createSubfolder(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: "vault-picker", mode: "read" });
}

export async function pickDestDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: "dest-picker", mode: "readwrite" });
}

export async function saveVaultSelection(
  handle: FileSystemDirectoryHandle,
  layout: VaultLayout,
): Promise<void> {
  await idbSet("vault", handle);
  await idbSet("vaultLayout", { name: handle.name, ...layout });
}

export async function saveDestSelection(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet("dest", handle);
}

export async function restoreVaultFromIdb(): Promise<{
  handle: FileSystemDirectoryHandle;
  layout: VaultLayout;
} | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>("vault");
  if (!handle) return null;
  const savedLayout = await idbGet<StoredVaultLayout>("vaultLayout");
  let layout: VaultLayout;
  if (savedLayout && savedLayout.name === handle.name) {
    layout = { contentSubdir: savedLayout.contentSubdir, rootHasMd: savedLayout.rootHasMd };
  } else if ((await handle.queryPermission({ mode: "read" })) === "granted") {
    layout = await detectVaultLayout(handle);
    await idbSet("vaultLayout", { name: handle.name, ...layout });
  } else {
    layout = { contentSubdir: null, rootHasMd: false };
  }
  return { handle, layout };
}

export async function restoreDestFromIdb(): Promise<FileSystemDirectoryHandle | null> {
  return (await idbGet<FileSystemDirectoryHandle>("dest")) ?? null;
}

export function vaultLayoutHint(layout: VaultLayout | null): string {
  if (!layout) return "";
  if (layout.contentSubdir) {
    let msg = `subpasta ${layout.contentSubdir}/`;
    if (layout.rootHasMd) msg += " (há .md também na raiz)";
    return msg;
  }
  if (layout.rootHasMd) return ".md na raiz do vault";
  return "não encontrou .md — confira se a pasta certa foi autorizada";
}
