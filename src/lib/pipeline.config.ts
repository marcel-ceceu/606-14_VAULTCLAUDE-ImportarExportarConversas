export const PIPELINE_DEFAULTS = {
  scriptDir: "c:\\projetos\\606-14_VAULTCLAUDE-ImportarExportarConversas\\scripts\\pipeline",
  vault: "D:\\2606VAULT-ClaudeConversasOF",
  final: "D:\\2606VAULT-ClaudeConversasOF-FINAL",
  downloads: "%USERPROFILE%\\Downloads",
} as const;

export const PIPELINE_COMMAND = `pwsh -ExecutionPolicy Bypass -File "${PIPELINE_DEFAULTS.scriptDir}\\Run-Pipeline-Auto.ps1"`;
