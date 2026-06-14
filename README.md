# 606-14 VAULTCLAUDE — Importar / Exportar Conversas

Vault Hub focado em importar conversas do Claude.ai, transformar em notas `.md` (pipeline Etapa 1 + 2) e ferramentas auxiliares (Vault Copy, leitura).

## Abrir o app (local)

Duplo-clique ou PowerShell:

```powershell
Set-Location "c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas"
powershell -ExecutionPolicy Bypass -File ".\260606-AbrirServerPowerShell.ps1"
```

## Importar conversas do Claude

Tutorial para utilizador final: [TUTORIAL-IMPORTAR-CLAUDE.md](TUTORIAL-IMPORTAR-CLAUDE.md)

Motor PowerShell: [scripts/pipeline/](scripts/pipeline/)

## Stack

TanStack Start + Vite + React (Lovable)

## Origem

Duplicado de `606-14_vaultsync-lovable` com pipeline `2606-ClaudeVaultPipeline` integrado.
