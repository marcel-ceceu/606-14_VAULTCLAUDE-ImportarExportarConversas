import { summarizeConversation } from "@/lib/vaultCopyAi";
import {
  buildImportConsolidado,
  buildLlmsTxtBody,
  buildSubfolderName,
  cleanExportMarkdown,
  consolidadoFileName,
  extractTitle,
  fileDate,
  mergeRelBase,
  type MergeConv,
  type PasteEntry,
} from "@/lib/vaultCopy";
import {
  copyFileToDir,
  createSubfolder,
  getFileFromPath,
  readVaultFileText,
  writeTextFile,
  type VaultLayout,
} from "@/lib/vaultFs";

export type ResultItem = { className: string; label: string; tag: string };

export type ExportResult = {
  summaryHtml: string;
  listItems: ResultItem[];
};

export type ExportCallbacks = {
  onPhase: (msg: string) => void;
  onItem: (index: number, state: "read" | "ai" | "copy" | "ok" | "fail" | "skip", detail?: string) => void;
};

type ExportContext = {
  vaultHandle: FileSystemDirectoryHandle;
  vaultLayout: VaultLayout | null;
  destHandle: FileSystemDirectoryHandle;
  vaultName: string;
  apiKey: string;
  aiModel: string;
  mergePrompt: string;
  cb: ExportCallbacks;
};

function okItems(convs: MergeConv[]): ResultItem[] {
  return convs.map((c) => {
    const resumoHint = c.jsonFailed
      ? " · resumo IA falhou — JSON inválido"
      : c.erro
        ? ` — ${c.erro}`
        : !c.resumo && !c.erro
          ? " · resumo indisponível"
          : "";
    return {
      className: c.erro ? "fail" : "ok",
      tag: c.erro ? "FAIL" : "OK",
      label: `${c.title}${resumoHint}`,
    };
  });
}

export async function runCopyFiles(
  ctx: ExportContext,
  entries: PasteEntry[],
): Promise<ExportResult> {
  const { vaultHandle, vaultLayout, destHandle, cb } = ctx;
  const copyEntries = entries.filter((e): e is Extract<PasteEntry, { status: "ok" }> => e.status === "ok");
  const subFolderName = buildSubfolderName();

  cb.onPhase(`A criar subpasta ${subFolderName} em ${destHandle.name}…`);
  const subDest = await createSubfolder(destHandle, subFolderName);

  let ok = 0;
  let fail = 0;
  let skip = 0;
  const listItems: ResultItem[] = [];
  let copyIdx = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const base =
      entry.status === "skip" ? entry.sourceLine.trim() : mergeRelBase(entry.relPath);

    if (entry.status === "skip") {
      copyIdx++;
      cb.onPhase(`[${copyIdx}/${entries.length}] Ignorado: ${entry.reason}`);
      cb.onItem(i, "skip", entry.reason);
      listItems.push({ className: "skip", tag: "SKIP", label: `${entry.sourceLine.trim()} — ${entry.reason}` });
      skip++;
      continue;
    }

    copyIdx++;
    cb.onPhase(`[${copyIdx}/${entries.length}] A copiar ${base}…`);
    cb.onItem(i, "copy", "a escrever bytes");
    try {
      const { fileHandle, fileName } = await getFileFromPath(vaultHandle, entry.relPath, vaultLayout);
      await copyFileToDir(fileHandle, subDest, fileName);
      cb.onItem(i, "ok", `${fileName} copiado`);
      listItems.push({ className: "ok", tag: "OK", label: fileName });
      ok++;
    } catch (e) {
      cb.onItem(i, "fail", (e as Error).message);
      listItems.push({
        className: "fail",
        tag: "FAIL",
        label: `${entry.relPath} — ${(e as Error).message}`,
      });
      fail++;
    }
  }

  const summaryHtml =
    `Copiados: <strong>${ok}</strong> de <strong>${copyEntries.length}</strong>` +
    (fail > 0 ? ` · Falhas: <strong>${fail}</strong>` : "") +
    (skip > 0 ? ` · Ignorados: <strong>${skip}</strong>` : "") +
    `<br>Pasta: <code>${subFolderName}</code> dentro de <code>${destHandle.name}</code>`;

  return { summaryHtml, listItems };
}

export async function runMerge(
  ctx: ExportContext,
  entries: Extract<PasteEntry, { status: "ok" }>[],
  useAI: boolean,
): Promise<ExportResult> {
  const { vaultHandle, vaultLayout, destHandle, vaultName, apiKey, aiModel, mergePrompt, cb } = ctx;
  const n = entries.length;
  const convs: MergeConv[] = [];

  cb.onPhase("A preparar leitura do vault…");

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const base = mergeRelBase(e.relPath);
    cb.onPhase(`[${i + 1}/${n}] A abrir no vault: ${base}`);
    cb.onItem(i, "read", "a ler bytes do .md");
    try {
      const { text, fileName } = await readVaultFileText(vaultHandle, e.relPath, vaultLayout);
      let content = cleanExportMarkdown(text);
      let title = extractTitle(content, fileName);
      let resumo = "";
      let tags: string[] = [];
      let jsonFailed = false;

      if (useAI && apiKey) {
        cb.onPhase(`[${i + 1}/${n}] A pedir resumo à API (${Math.min(content.length, 12000)} chars)…`);
        cb.onItem(i, "ai", "resumo IA");
        try {
          const r = await summarizeConversation(content, apiKey, aiModel, mergePrompt);
          if (r.jsonOk) {
            if (r.titulo) title = r.titulo;
            resumo = (r.resumo || "").trim();
            tags = Array.isArray(r.tags) ? r.tags.slice(0, 20) : [];
          } else {
            jsonFailed = true;
          }
        } catch {
          resumo = "";
        }
      }

      convs.push({ fileName, title, date: fileDate(fileName), content, resumo, tags, jsonFailed });
      cb.onItem(i, "ok", jsonFailed ? "resumo IA falhou" : title || fileName);
    } catch (err) {
      convs.push({
        fileName: e.relPath,
        title: e.relPath,
        date: "",
        content: "",
        resumo: "",
        tags: [],
        erro: (err as Error).message,
      });
      cb.onItem(i, "fail", (err as Error).message);
    }
  }

  cb.onPhase(`A ordenar ${convs.length} conversas por data…`);
  convs.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  cb.onPhase("A montar consolidado…");
  const md = buildImportConsolidado(convs, vaultName);
  const outName = consolidadoFileName();

  cb.onPhase(`A gravar ${outName} na raiz de ${destHandle.name}…`);
  await writeTextFile(destHandle, outName, md);

  const okN = convs.filter((c) => !c.erro).length;
  const failN = convs.length - okN;
  const summaryHtml =
    `Consolidado: <strong>${okN}</strong> conversas` +
    (failN ? ` · <strong>${failN}</strong> com erro na leitura` : "") +
    (useAI ? " · <strong>com IA</strong>" : "") +
    `<br>Gravado na <strong>raiz</strong> da pasta destino do picker (passo 03): ` +
    `<code>${destHandle.name}\\${outName}</code>` +
    `<br><span class="text-xs">Não vai para a subpasta <code>DDMMYY-HHMM_msgm_obsidian</code> — só Copiar arquivos / llms usam subpasta.</span>`;

  return { summaryHtml, listItems: okItems(convs) };
}

export async function runLlms(
  ctx: ExportContext,
  entries: Extract<PasteEntry, { status: "ok" }>[],
): Promise<ExportResult> {
  const { vaultHandle, vaultLayout, destHandle, apiKey, aiModel, mergePrompt, cb } = ctx;
  const sorted = entries.slice().sort((a, b) =>
    (fileDate(mergeRelBase(a.relPath)) || "9999").localeCompare(
      fileDate(mergeRelBase(b.relPath)) || "9999",
    ),
  );
  const subFolderName = buildSubfolderName();
  const n = sorted.length;

  cb.onPhase(`A criar subpasta ${subFolderName} em ${destHandle.name}…`);
  const subDest = await createSubfolder(destHandle, subFolderName);

  const indexRows: {
    fileName: string;
    title: string;
    date: string;
    resumo: string;
    tags: string[];
  }[] = [];
  const listItems: ResultItem[] = [];
  let okN = 0;
  let failN = 0;
  let warnN = 0;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const base = mergeRelBase(e.relPath);
    cb.onPhase(`[${i + 1}/${n}] copiando + resumindo… ${base}`);
    cb.onItem(i, "copy", "a copiar .md");

    try {
      const { fileHandle, fileName } = await getFileFromPath(vaultHandle, e.relPath, vaultLayout);
      const file = await fileHandle.getFile();
      await copyFileToDir(fileHandle, subDest, fileName);

      const cleaned = cleanExportMarkdown(await file.text());
      let title = extractTitle(cleaned, fileName);
      let resumo = "";
      let tags: string[] = [];
      let jsonFailed = false;

      cb.onItem(i, "ai", "a pedir resumo à API");
      cb.onPhase(`[${i + 1}/${n}] resumo IA…`);
      try {
        const r = await summarizeConversation(cleaned, apiKey, aiModel, mergePrompt);
        if (r.jsonOk) {
          if (r.titulo) title = r.titulo;
          resumo = (r.resumo || "").replace(/\s+/g, " ").trim();
          tags = Array.isArray(r.tags) ? r.tags.slice(0, 20) : [];
        } else {
          jsonFailed = true;
          title = extractTitle(cleaned, fileName);
        }
      } catch {
        jsonFailed = true;
      }

      const date = fileDate(fileName) || "s/ data";
      indexRows.push({ fileName, title, date, resumo, tags });

      const resumoHint = jsonFailed
        ? " · resumo IA falhou — JSON inválido"
        : !resumo
          ? " · sem resumo IA"
          : "";
      if (jsonFailed) warnN++;

      cb.onItem(i, "ok", `${fileName} copiado`);
      listItems.push({ className: "ok", tag: "OK", label: `${title}${resumoHint}` });
      okN++;
    } catch (err) {
      failN++;
      cb.onItem(i, "fail", (err as Error).message);
      listItems.push({
        className: "fail",
        tag: "FAIL",
        label: `${e.relPath} — ${(err as Error).message}`,
      });
    }
  }

  cb.onPhase("A gravar llms.txt na subpasta…");
  await writeTextFile(subDest, "llms.txt", buildLlmsTxtBody(indexRows), "text/plain;charset=utf-8");

  const summaryHtml =
    `Copiados: <strong>${okN}</strong> · llms.txt com <strong>${indexRows.length}</strong> entradas` +
    (failN ? ` · Falhas: <strong>${failN}</strong>` : "") +
    (warnN ? ` · Avisos IA: <strong>${warnN}</strong>` : "") +
    `<br>Pasta: <code>${subFolderName}</code> · índice: <code>llms.txt</code>`;

  return { summaryHtml, listItems };
}
