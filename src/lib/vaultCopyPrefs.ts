import { idbGet, idbSet } from "@/lib/vaultCopyIdb";

/** Chaves IndexedDB partilhadas do Vault Copy (persistem entre sessoes e rotas). */
export const VC_PREF_KEYS = {
  pasteArea: "pasteArea",
  destAbsPath: "destAbsPath",
  activePresetId: "activePresetId",
} as const;

export type VaultCopyUiPrefs = {
  pasteArea: string;
  destAbsPath: string;
  activePresetId: string;
};

export async function loadVaultCopyUiPrefs(): Promise<Partial<VaultCopyUiPrefs>> {
  const [pasteArea, destAbsPath, activePresetId] = await Promise.all([
    idbGet<string>(VC_PREF_KEYS.pasteArea),
    idbGet<string>(VC_PREF_KEYS.destAbsPath),
    idbGet<string>(VC_PREF_KEYS.activePresetId),
  ]);
  return {
    ...(pasteArea !== undefined ? { pasteArea } : {}),
    ...(destAbsPath ? { destAbsPath } : {}),
    ...(activePresetId ? { activePresetId } : {}),
  };
}

export async function savePasteArea(text: string): Promise<void> {
  await idbSet(VC_PREF_KEYS.pasteArea, text);
}

export async function saveDestAbsPath(path: string): Promise<void> {
  await idbSet(VC_PREF_KEYS.destAbsPath, path);
}

export async function saveActivePresetId(id: string): Promise<void> {
  await idbSet(VC_PREF_KEYS.activePresetId, id);
}
