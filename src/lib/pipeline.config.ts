export const PIPELINE_DEFAULTS = {
  scriptDir: "c:\\projetos\\606-14_VAULTCLAUDE-ImportarExportarConversas\\scripts\\pipeline",
  vault: "D:\\2606VAULT-ClaudeConversasOF",
  final: "D:\\2606VAULT-ClaudeConversasOF-FINAL",
  downloads: "%USERPROFILE%\\Downloads",
} as const;

export type PipelineCommandOptions = {
  vault?: string;
  final?: string;
  skipFinal?: boolean;
};

export function buildPipelineCommand(opts: PipelineCommandOptions = {}): string {
  const vault = opts.vault ?? PIPELINE_DEFAULTS.vault;
  const final = opts.final ?? PIPELINE_DEFAULTS.final;
  const skipFinal = opts.skipFinal ?? false;
  const script = `${PIPELINE_DEFAULTS.scriptDir}\\Run-Pipeline-Auto.ps1`;
  const args = [`-Vault "${vault}"`, `-Final "${final}"`];
  if (skipFinal) args.push("-SkipFinal");
  return `pwsh -ExecutionPolicy Bypass -File "${script}" ${args.join(" ")}`;
}

export const PIPELINE_COMMAND = buildPipelineCommand();
