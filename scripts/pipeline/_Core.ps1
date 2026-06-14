# ##############################################################
# #  _Core.ps1  -  MOTOR COMPARTILHADO do pipeline                #
# #  Funcoes usadas pelos 3 scripts e pela UI. Nao roda sozinho.  #
# ##############################################################

$script:LogAction   = $null
$script:PipeLogFile = $null

function Start-PipeLog {
    param([string]$slug)
    $dir = 'C:\Users\Windows\Desktop\CAIXA DE ENTRADA\powerlogs-testes'
    if(-not(Test-Path -LiteralPath $dir)){ New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $stamp = Get-Date -Format 'yyMMdd_HHmm'
    $script:PipeLogFile = Join-Path $dir ("_TEMP_${slug}_${stamp}.txt")
    return $script:PipeLogFile
}
function Write-PipeLog {
    param([string]$m)
    $l = "[$(Get-Date -Format 'HH:mm:ss')] $m"
    Write-Host $l
    if($script:PipeLogFile){ Add-Content -LiteralPath $script:PipeLogFile -Value $l -Encoding UTF8 }
    if($script:LogAction){ try{ & $script:LogAction $l }catch{} }
}

# ---------- helpers ETAPA 1 (conversao) ----------
function Get-MsgText {
    param($m)
    $cont = $m.content
    if($cont -and (@($cont).Count -ge 1)){
        $parts=@()
        foreach($b in $cont){ if("$($b.type)" -eq 'text' -and "$($b.text)".Length -gt 0){ $parts += "$($b.text)" } }
        return (($parts -join "`r`n`r`n").Trim())
    }
    return ("$($m.text)").Trim()
}

function Invoke-Conversor {
    param([string]$ArquivoZip,[string]$Downloads,[string]$Saida,[int]$DiasAtras=0,[bool]$ManterRaw=$false)
    Write-PipeLog "=== ETAPA 1: CONVERSOR (JSON -> MD limpo) ==="
    Write-PipeLog ("ZIP: " + $ArquivoZip + " | Saida: " + $Saida + " | Filtro: " + $(if($DiasAtras -gt 0){"ultimos $DiasAtras dias"}else{"TODAS"}))
    $zipFull = Join-Path $Downloads $ArquivoZip
    if(-not(Test-Path -LiteralPath $zipFull)){ Write-PipeLog ("FALHA -- nao achei o zip em " + $Downloads); return $null }
    $prefixo = $ArquivoZip -replace 'batch-\d+\.zip$',''
    $batches = @(Get-ChildItem -LiteralPath $Downloads -Filter ($prefixo + 'batch-*.zip') -File -ErrorAction SilentlyContinue | Sort-Object Name)
    if($batches.Count -eq 0){ $batches = @(Get-Item -LiteralPath $zipFull) }
    Write-PipeLog ("Batches deste export: " + $batches.Count)
    $driveRoot=(Split-Path -Qualifier $Saida)+'\'
    if(-not(Test-Path -LiteralPath $driveRoot)){ Write-PipeLog ("FALHA -- drive " + $driveRoot + " indisponivel."); return $null }
    $parent = Split-Path -Parent $Saida; if($parent -eq ''){ $parent = $driveRoot }
    $work = Join-Path $parent ("_raw_" + (Get-Date -Format 'yyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    $bi=0
    foreach($z in $batches){
        $bi++
        try{ Unblock-File -LiteralPath $z.FullName -ErrorAction SilentlyContinue }catch{}
        $sub = Join-Path $work ([System.IO.Path]::GetFileNameWithoutExtension($z.Name))
        New-Item -ItemType Directory -Path $sub -Force | Out-Null
        try{ Expand-Archive -LiteralPath $z.FullName -DestinationPath $sub -Force; Write-PipeLog ("   extraido " + $bi + "/" + $batches.Count) }
        catch{ Write-PipeLog ("   FALHA extrair " + $z.Name + ": " + $_.Exception.Message) }
    }
    $jsons=@(Get-ChildItem -LiteralPath $work -Recurse -Filter 'conversations.json' -File -ErrorAction SilentlyContinue)
    $best=@{}; $lidas=0
    foreach($j in $jsons){
        try{ $d = (Get-Content -LiteralPath $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json) }catch{ Write-PipeLog ("   FALHA parse: " + $j.Name); continue }
        $arr = if($d -is [System.Array]){ $d } else { @($d) }
        foreach($c in $arr){
            $lidas++
            $u = "$($c.uuid)"; if($u -eq ''){ $u = [Guid]::NewGuid().ToString() }
            if(-not $best.ContainsKey($u) -or ("$($c.updated_at)" -gt "$($best[$u].updated_at)")){ $best[$u] = $c }
        }
    }
    Write-PipeLog ("Lidas: " + $lidas + " | unicas por uuid: " + $best.Count)
    New-Item -ItemType Directory -Path $Saida -Force | Out-Null
    $enc = New-Object System.Text.UTF8Encoding($false)
    $limite = if($DiasAtras -gt 0){ (Get-Date).AddDays(-$DiasAtras) } else { $null }
    $uni=@($best.Values); $tot=$uni.Count; $n=0; $escr=0; $vaz=0; $fora=0
    foreach($c in $uni){
        $n++; if($n % 200 -eq 0){ Write-PipeLog ("   ... " + $n + "/" + $tot) }
        if($limite){ $dtU=$null; try{ $dtU=[datetime]$c.updated_at }catch{}; if($dtU -and $dtU -lt $limite){ $fora++; continue } }
        $linhas = New-Object System.Collections.Generic.List[string]
        foreach($m in $c.chat_messages){
            $txt = Get-MsgText $m
            if($txt -eq ''){ continue }
            $snd = ("$($m.sender)").ToLower()
            $who = if($snd -eq 'human' -or $snd -eq 'user'){ "$([char]0xD83D)$([char]0xDC64) You" } else { "$([char]0xD83E)$([char]0xDD16) Claude" }
            $ts = ("$($m.created_at)"); if($ts.Length -ge 16){ $ts = $ts.Substring(0,16).Replace('T',' ') }
            $linhas.Add("## $who *($ts)*") | Out-Null
            $linhas.Add("") | Out-Null; $linhas.Add($txt) | Out-Null; $linhas.Add("") | Out-Null
        }
        if($linhas.Count -eq 0){ $vaz++; continue }
        $titulo = "$($c.name)"; if($titulo -eq ''){ $titulo = "sem-titulo" }
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append("---`r`n")
        [void]$sb.Append('title: "' + ($titulo -replace '"','') + '"' + "`r`n")
        [void]$sb.Append("uuid: " + "$($c.uuid)" + "`r`n")
        [void]$sb.Append("created: " + "$($c.created_at)" + "`r`n")
        [void]$sb.Append("updated: " + "$($c.updated_at)" + "`r`n")
        [void]$sb.Append("---`r`n`r`n")
        [void]$sb.Append(($linhas -join "`r`n"))
        $dt=$null; try{ $dt=[datetime]$c.created_at }catch{}
        $pref = if($dt){ $dt.ToString('yyyy-MM-dd') } else { '0000-00-00' }
        $sl = $titulo -replace '[<>:"/\\|?*\x00-\x1F]','' -replace '\s+','-' -replace '-{2,}','-'
        $sl = $sl.Trim('-'); if($sl.Length -gt 55){ $sl = $sl.Substring(0,55).Trim('-') }
        $outP = Join-Path $Saida ("$pref-$sl.md")
        if(Test-Path -LiteralPath $outP){ $outP = Join-Path $Saida ("$pref-$sl-" + "$($c.uuid)".Substring(0,[Math]::Min(8,"$($c.uuid)".Length)) + ".md") }
        try{ [System.IO.File]::WriteAllText($outP, $sb.ToString(), $enc); $escr++ }catch{ Write-PipeLog ("   FALHA gravar: " + $_.Exception.Message) }
    }
    if(-not $ManterRaw){ try{ Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction Stop }catch{} }
    Write-PipeLog ("ETAPA 1 OK -- escritas: " + $escr + " | vazias: " + $vaz + " | fora data: " + $fora)
    return @{ Unicas=$best.Count; Escritas=$escr; Vazias=$vaz; ForaData=$fora }
}

# ---------- helpers ETAPA 2 (cortesias) ----------
function ConvertTo-Norm {
    param([string]$s)
    $s = $s.ToLower()
    $d = $s.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach($ch in $d.ToCharArray()){
        if([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark){ [void]$sb.Append($ch) }
    }
    $r = $sb.ToString()
    $r = [regex]::Replace($r,'[^a-z0-9\s]',' ')
    return ([regex]::Replace($r,'\s+',' ')).Trim()
}
function Get-Residual {
    param([string]$piece,[string[]]$cort)
    $n = ConvertTo-Norm $piece
    $n = [regex]::Replace($n,'\bmarcel\b',' ')
    foreach($ph in $cort){ if($ph){ $n = [regex]::Replace($n,'\b' + [regex]::Escape($ph) + '\b',' ') } }
    return ([regex]::Replace($n,'\s',''))
}
function Test-Courtesy {
    param([string]$piece,[string[]]$cort)
    return ((Get-Residual $piece $cort).Length -le 2)
}
function Get-TrimLeading {
    param([string]$par,[string[]]$cort)
    $cut=0
    foreach($mm in [regex]::Matches($par,'[^.!?,;\r\n]+[.!?,;]*')){
        $seg=$mm.Value
        if($seg.Trim() -eq ''){ continue }
        if(Test-Courtesy $seg $cort){ $cut = $mm.Index + $mm.Length } else { break }
    }
    return ($par.Substring($cut)).TrimStart((" ,;:-`t").ToCharArray())
}
function Get-CleanTurn {
    param([string]$body,[string[]]$cort)
    if(Test-Courtesy $body $cort){ return $null }
    $paras = New-Object System.Collections.Generic.List[string]
    foreach($p in [regex]::Split($body,'\r?\n\r?\n')){ $paras.Add($p) | Out-Null }
    while($paras.Count -gt 0 -and (Test-Courtesy $paras[0] $cort)){ $paras.RemoveAt(0) }
    while($paras.Count -gt 0 -and (Test-Courtesy $paras[$paras.Count-1] $cort)){ $paras.RemoveAt($paras.Count-1) }
    if($paras.Count -eq 0){ return $null }
    $paras[0] = Get-TrimLeading $paras[0] $cort
    return (($paras -join "`r`n`r`n").Trim())
}

function Invoke-Cortesias {
    param([string]$Entrada,[string]$Saida,[string]$Regras,[bool]$Force=$false)
    Write-PipeLog "=== ETAPA 2: CORTESIAS (remove oi/tudo bem/etc) ==="
    if(-not(Test-Path -LiteralPath $Entrada)){ Write-PipeLog ("FALHA -- entrada nao existe: " + $Entrada); return $null }
    $cort=@()
    if(Test-Path -LiteralPath $Regras){
        foreach($ln in (Get-Content -LiteralPath $Regras -Encoding UTF8)){ $t=$ln.Trim(); if($t -eq '' -or $t.StartsWith('#')){ continue }; $cort += (ConvertTo-Norm $t) }
    } else { Write-PipeLog ("AVISO -- regras nao encontradas em " + $Regras + " (nada sera cortado)") }
    $cort = @($cort | Where-Object { $_ -ne '' } | Select-Object -Unique | Sort-Object { $_.Length } -Descending)
    Write-PipeLog ("Regras carregadas: " + $cort.Count)
    New-Item -ItemType Directory -Path $Saida -Force | Out-Null
    $regrasMtime = if(Test-Path -LiteralPath $Regras){ (Get-Item -LiteralPath $Regras).LastWriteTime } else { [datetime]::MinValue }
    $enc = New-Object System.Text.UTF8Encoding($false)
    $headRe = [regex]"(?m)^##\s+\S+\s+(You|Claude)\s+\*\([^)]*\)\*[^\r\n]*\r?\n"
    $files = @(Get-ChildItem -LiteralPath $Entrada -File -Filter *.md)
    $tot=$files.Count; $n=0; $proc=0; $pul=0; $turnRem=0
    foreach($f in $files){
        $n++; if($n % 200 -eq 0){ Write-PipeLog ("   ... " + $n + "/" + $tot) }
        $outP = Join-Path $Saida $f.Name
        if((-not $Force) -and (Test-Path -LiteralPath $outP)){
            $om=(Get-Item -LiteralPath $outP).LastWriteTime
            if(($om -ge $f.LastWriteTime) -and ($om -ge $regrasMtime)){ $pul++; continue }
        }
        $raw = [System.IO.File]::ReadAllText($f.FullName,[System.Text.Encoding]::UTF8)
        $yaml=''; $body=$raw
        $mY=[regex]::Match($raw,"(?s)^(---\r?\n.*?\r?\n---\r?\n)")
        if($mY.Success){ $yaml=$mY.Value; $body=$raw.Substring($mY.Length) }
        $codes=New-Object System.Collections.ArrayList
        $body=[regex]::Replace($body,'(?s)```.*?```',{ param($mm) $i=$codes.Add($mm.Value); "@@CODE_${i}@@" })
        $heads=$headRe.Matches($body)
        $sb=New-Object System.Text.StringBuilder
        if($heads.Count -eq 0){
            [void]$sb.Append($yaml); [void]$sb.Append($body)
        } else {
            [void]$sb.Append($yaml); [void]$sb.Append($body.Substring(0,$heads[0].Index))
            for($i=0;$i -lt $heads.Count;$i++){
                $h=$heads[$i]; $eH=$h.Index+$h.Length
                $nx= if($i+1 -lt $heads.Count){ $heads[$i+1].Index } else { $body.Length }
                $hdr=$h.Value; $cont=$body.Substring($eH,$nx-$eH)
                $clean=Get-CleanTurn $cont $cort
                if($null -eq $clean){ $turnRem++; continue }
                [void]$sb.Append($hdr); [void]$sb.Append("`r`n"); [void]$sb.Append($clean); [void]$sb.Append("`r`n`r`n")
            }
        }
        $outTxt=$sb.ToString()
        for($i=0;$i -lt $codes.Count;$i++){ $outTxt=$outTxt.Replace("@@CODE_${i}@@",$codes[$i]) }
        try{ [System.IO.File]::WriteAllText($outP,$outTxt,$enc); $proc++ }catch{ Write-PipeLog ("   FALHA gravar: " + $f.Name) }
    }
    Write-PipeLog ("ETAPA 2 OK -- processados: " + $proc + " | pulados (ja feitos): " + $pul + " | turnos removidos: " + $turnRem)
    return @{ Processados=$proc; Pulados=$pul; TurnosRemovidos=$turnRem }
}
