# Cria atalhos na Area de Trabalho: "Vault Hub" (abrir) e "Parar Vault Hub" (opcional)
$ErrorActionPreference = 'Stop'

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { 'c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas' }
$Desktop = [Environment]::GetFolderPath('Desktop')
$Wsh = New-Object -ComObject WScript.Shell
$Wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

function New-DeskShortcut {
    param(
        [string]$Name,
        [string]$Target,
        [string]$Arguments,
        [string]$Icon,
        [string]$Tip
    )
    $path = Join-Path $Desktop "$Name.lnk"
    $sc = $Wsh.CreateShortcut($path)
    $sc.TargetPath = $Target
    if ($Arguments) { $sc.Arguments = $Arguments }
    $sc.WorkingDirectory = $Root
    $sc.IconLocation = $Icon
    $sc.Description = $Tip
    $sc.Save()
    Write-Host "Criado: $path" -ForegroundColor Green
}

$IniciarCmd = Join-Path $Root 'Iniciar-VaultHub.cmd'
$PararCmd = Join-Path $Root 'Parar-VaultHub.cmd'
$Icon = "$env:SystemRoot\System32\imageres.dll,109"

if (-not (Test-Path $IniciarCmd)) {
    Write-Host "ERRO: falta $IniciarCmd" -ForegroundColor Red
    exit 1
}

# .cmd evita o dialogo "Abrir com" quando .vbs nao esta associado ao wscript
New-DeskShortcut -Name 'Vault Hub' `
    -Target $IniciarCmd `
    -Arguments '' `
    -Icon $Icon `
    -Tip 'Abrir Vault Hub — importar/exportar conversas Claude (servidor local em segundo plano)'

New-DeskShortcut -Name 'Parar Vault Hub' `
    -Target $PararCmd `
    -Arguments '' `
    -Icon "$env:SystemRoot\System32\shell32.dll,131" `
    -Tip 'Encerrar o servidor local do Vault Hub'

Write-Host ''
Write-Host 'Pronto. Duplo-clique em "Vault Hub" na Area de Trabalho.' -ForegroundColor Cyan
Write-Host 'Se ainda pedir "Abrir com", use o atalho .cmd na pasta do projeto.' -ForegroundColor Gray
