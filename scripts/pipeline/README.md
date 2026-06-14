# Pipeline Vault Claude — scripts locais (Vault Hub 606)

Motor copiado de `2606-ClaudeVaultPipeline`. Etapa 1 gera `.md` formatados; Etapa 2 remove cortesias.

**Tutorial passo a passo (utilizador):** [TUTORIAL-IMPORTAR-CLAUDE.md](../../TUTORIAL-IMPORTAR-CLAUDE.md) na raiz do repo.

## Pré-requisitos

- PowerShell 7+ (`pwsh`) recomendado
- Export do Claude.ai baixado em `%USERPROFILE%\Downloads` (`data-*-batch-*.zip`)
- Drive `D:\` acessível (pastas de saída)

## Uso rápido

```powershell
pwsh -ExecutionPolicy Bypass -File "c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas\scripts\pipeline\Run-Pipeline-Auto.ps1"
```

Ou copie o comando da rota **Importar Claude** no Vault Hub.

## Saídas

| Pasta | Conteúdo |
|-------|----------|
| `D:\2606VAULT-ClaudeConversasOF` | Etapa 1 — `.md` sem thinking, prontos para uso |
| `D:\2606VAULT-ClaudeConversasOF-FINAL` | Etapa 2 — sem cortesias (RAG) |

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `_Core.ps1` | Motor (`Invoke-Conversor`, `Invoke-Cortesias`) |
| `Run-Pipeline-Auto.ps1` | Entrypoint one-liner (auto-ZIP + defaults) |
| `Run-Pipeline.ps1` | Entrypoint parametrizado (Tauri/futuro) |
| `2606-RegexRegrasConversas.txt` | Regras de cortesia (fallback) |

Regras oficiais (se existir): `D:\2606-ExportarConversasClaude\2606-RegexRegrasConversas.txt`

## Forçar reprocessamento Etapa 2

Edite `Run-Pipeline-Auto.ps1`: `$Force = $true`

## Log

`Desktop\CAIXA DE ENTRADA\powerlogs-testes\_TEMP_vault_hub_auto_*.txt` — abre no Notepad ao final.
