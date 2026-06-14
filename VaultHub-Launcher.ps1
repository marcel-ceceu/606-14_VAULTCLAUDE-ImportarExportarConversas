# Vault Hub — launcher silencioso (atalho na Area de Trabalho)
# Inicia servidor em segundo plano se necessario, abre o browser e fecha este script.
# Parametros: -Stop (encerra servidores deste projeto) | -Verbose (mostra logs)

param(
    [switch]$Stop,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { 'c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas' }
$DesiredPort = 5173
$CandidatePorts = @(5173, 5174, 5175, 5176, 5177, 5178, 8080, 8081)
$LogDir = Join-Path $env:LOCALAPPDATA 'VaultHub606'
$LogFile = Join-Path $LogDir 'launcher.log'

function Write-Log {
    param([string]$Message, [string]$Color = 'Gray')
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
    if ($Verbose) { Write-Host $Message -ForegroundColor $Color }
}

function Test-PortFree {
    param([int]$Port)
    return -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-ExistingProjectServers {
    $rootNorm = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\').ToLower()
    $found = @()
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $cmd = $p.CommandLine
        if (-not $cmd) { continue }
        $cmdLower = $cmd.ToLower()
        if ($cmdLower.IndexOf($rootNorm) -lt 0) { continue }
        if ($cmdLower -notmatch 'vite|npm.*dev|npm.*preview|bun.*dev') { continue }
        $port = $DesiredPort
        if ($cmd -match '(?:--port|-p)\s+(\d+)') { $port = [int]$Matches[1] }
        $conns = Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($CandidatePorts -contains $c.LocalPort) {
                $port = $c.LocalPort
                break
            }
        }
        $found += [pscustomobject]@{ PID = $p.ProcessId; Port = $port }
    }
    return @($found | Sort-Object Port -Unique)
}

function Stop-ProjectDevServers {
    param($Servers)
    foreach ($s in $Servers) {
        Write-Log "Encerrando PID $($s.PID) porta $($s.Port)" 'Yellow'
        Stop-Process -Id $s.PID -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

function Wait-ServerReady {
    param([string]$Url, [int]$MaxSeconds = 120)
    for ($i = 1; $i -le $MaxSeconds; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

function Start-HiddenDevServer {
    param([int]$Port)
    $cmdLine = "npm run dev -- --port $Port --host localhost"
    Write-Log "A iniciar servidor oculto: $cmdLine" 'Cyan'
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList @('/c', $cmdLine) `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -PassThru | Out-Null
}

function Open-Browser {
    param([string]$Url)
    Write-Log "A abrir browser: $Url" 'Green'
    Start-Process $Url
}

Set-Location -LiteralPath $Root

if (-not (Test-Path (Join-Path $Root 'package.json'))) {
    Write-Log "ERRO: package.json nao encontrado em $Root" 'Red'
    Add-Type -AssemblyName System.Windows.Forms
    if (-not $Verbose) {
        [System.Windows.Forms.MessageBox]::Show(
            "Vault Hub: pasta do projeto invalida.`n$Root",
            'Vault Hub',
            'OK',
            'Error'
        ) | Out-Null
    }
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Log 'ERRO: npm nao encontrado' 'Red'
    if (-not $Verbose) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            'Instale Node.js (nodejs.org) para usar o Vault Hub.',
            'Vault Hub',
            'OK',
            'Error'
        ) | Out-Null
    }
    exit 1
}

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Log 'npm install...' 'Cyan'
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$Existing = @(Get-ExistingProjectServers)

if ($Stop) {
    if ($Existing.Count -eq 0) {
        Write-Log 'Nenhum servidor Vault Hub em execucao.' 'Yellow'
    } else {
        Stop-ProjectDevServers -Servers $Existing
        Write-Log 'Servidor(es) encerrado(s).' 'Green'
    }
    exit 0
}

if ($Existing.Count -gt 0) {
    $Url = "http://localhost:$($Existing[0].Port)"
    Write-Log "Servidor ja activo na porta $($Existing[0].Port)" 'Green'
    Open-Browser -Url $Url
    exit 0
}

$SelectedPort = $null
foreach ($port in $CandidatePorts) {
    if (Test-PortFree -Port $port) {
        $SelectedPort = $port
        break
    }
}

if (-not $SelectedPort) {
    Write-Log 'ERRO: nenhuma porta livre' 'Red'
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        'Vault Hub: nenhuma porta livre (5173-5178, 8080-8081). Feche outros servidores ou use Parar Vault Hub.',
        'Vault Hub',
        'OK',
        'Error'
    ) | Out-Null
    exit 1
}

$Url = "http://localhost:$SelectedPort"
Start-HiddenDevServer -Port $SelectedPort

if (-not (Wait-ServerReady -Url $Url)) {
    Write-Log "ERRO: servidor nao respondeu a tempo em $Url" 'Red'
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "O servidor demorou demais a iniciar.`nVeja o log:`n$LogFile",
        'Vault Hub',
        'OK',
        'Error'
    ) | Out-Null
    exit 1
}

Open-Browser -Url $Url
Write-Log 'Launcher concluido (servidor continua em segundo plano).' 'Green'
exit 0
