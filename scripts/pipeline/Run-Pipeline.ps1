param(
    [string]$Downloads,
    [string]$Zip,
    [int]$Dias = 0,
    [string]$Vault,
    [string]$Final,
    [string]$Regras,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}

# Descobre a pasta do proprio script SEM depender de $PSScriptRoot.
# (O Tauri passa o caminho com prefixo \\?\, que deixa $PSScriptRoot nulo.)
$self = $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($self)) { $self = $PSCommandPath }
$self = $self -replace '^\\\\\?\\', ''
$here = Split-Path -Parent $self

# Silencia Write-Host do _Core e manda tudo para stdout (capturado pelo Rust).
function Write-Host { param([Parameter(ValueFromRemainingArguments=$true)]$Ignored) }

. (Join-Path $here '_Core.ps1')
$script:LogAction = { param($l) [Console]::Out.WriteLine($l) }

if ([string]::IsNullOrWhiteSpace($Regras)) {
    $Regras = Join-Path $here '2606-RegexRegrasConversas.txt'
}

Start-PipeLog 'tauri_pipeline' | Out-Null
$r1 = Invoke-Conversor -ArquivoZip $Zip -Downloads $Downloads -Saida $Vault -DiasAtras $Dias
if ($r1) {
    Invoke-Cortesias -Entrada $Vault -Saida $Final -Regras $Regras -Force:$Force | Out-Null
}
Write-PipeLog 'PIPELINE COMPLETO.'