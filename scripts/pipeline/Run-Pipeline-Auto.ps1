# Run-Pipeline-Auto.ps1 — entrypoint one-liner do Vault Hub 606
# Detecta o ZIP mais recente em Downloads e roda Etapa 1 + Etapa 2.
# Parametros opcionais: -Vault -Final -SkipFinal -Dias -Force

param(
    [string]$Vault = 'D:\2606VAULT-ClaudeConversasOF',
    [string]$Final = 'D:\2606VAULT-ClaudeConversasOF-FINAL',
    [switch]$SkipFinal,
    [int]$Dias = 0,
    [switch]$Force
)

$Downloads = Join-Path $env:USERPROFILE 'Downloads'

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here '_Core.ps1')

$regrasOficial = 'D:\2606-ExportarConversasClaude\2606-RegexRegrasConversas.txt'
$Regras = if (Test-Path -LiteralPath $regrasOficial) { $regrasOficial } else { Join-Path $here '2606-RegexRegrasConversas.txt' }

$zipItem = Get-ChildItem -LiteralPath $Downloads -Filter 'data-*.zip' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$log = Start-PipeLog 'vault_hub_auto'

if (-not $zipItem) {
    Write-PipeLog "FALHA -- nenhum data-*.zip encontrado em $Downloads"
    Write-PipeLog "Baixe o export do Claude.ai e deixe o ZIP em Downloads."
    Start-Process notepad.exe -ArgumentList $log
    exit 1
}

Write-PipeLog "ZIP selecionado: $($zipItem.Name) ($([math]::Round($zipItem.Length / 1MB, 2)) MB)"

$r1 = Invoke-Conversor -ArquivoZip $zipItem.Name -Downloads $Downloads -Saida $Vault -DiasAtras $Dias
if ($r1 -and -not $SkipFinal) {
    Invoke-Cortesias -Entrada $Vault -Saida $Final -Regras $Regras -Force:$Force | Out-Null
} elseif ($r1 -and $SkipFinal) {
    Write-PipeLog "Etapa 2 ignorada (-SkipFinal). Saida apenas em: $Vault"
}

Write-PipeLog "PIPELINE COMPLETO. VAULT: $Vault$(if (-not $SkipFinal) { " | FINAL: $Final" } else { ' | FINAL: (nao gerado)' })"
Write-PipeLog "Log: $log"
Start-Process notepad.exe -ArgumentList $log
exit 0
