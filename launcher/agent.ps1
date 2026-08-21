param([switch]$PairOnly)

$ErrorActionPreference = "Stop"
$Root = Join-Path $env:USERPROFILE "IntornaLauncher"
$ConfigPath = Join-Path $Root "config.json"
$FunctionUrl = "https://sqeqehohwrfqtbdxcnfs.supabase.co/functions/v1/launcher-agent"
$PublicKey = "sb_publishable_uN4524408hXErU-OgTA9hA_XDQiPyvS"

function Read-Config {
    if (!(Test-Path $ConfigPath)) { throw "Configuração do Launcher não encontrada. Execute o instalador novamente." }
    return Get-Content $ConfigPath -Raw | ConvertFrom-Json
}

function Invoke-AgentPublic([hashtable]$Body) {
    $headers = @{ "apikey" = $PublicKey; "Content-Type" = "application/json" }
    return Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body ($Body | ConvertTo-Json -Depth 8) -TimeoutSec 20
}

function Invoke-AgentAuth([hashtable]$Body) {
    $cfg = Read-Config
    $headers = @{ "apikey" = $PublicKey; "x-launcher-token" = [string]$cfg.secret; "Content-Type" = "application/json" }
    return Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

function Pair-Start {
    $cfg = Read-Config
    $r = Invoke-AgentPublic @{ action="pair_start"; secret=[string]$cfg.secret; pairCode=[string]$cfg.pairCode; label=[string]$cfg.label }
    return $r
}

function Wsl([string]$Command) {
    $out = & wsl.exe -d Ubuntu -u root -- bash -lc $Command 2>&1
    return ($out | Out-String).Trim()
}

function Ensure-Docker {
    $ok = Wsl "docker info >/dev/null 2>&1 && echo OK || true"
    if ($ok -notmatch "OK") {
        Wsl "dockerd >/tmp/dockerd.log 2>&1 &"
        Start-Sleep -Seconds 7
    }
    $ok2 = Wsl "docker info >/dev/null 2>&1 && echo OK || true"
    if ($ok2 -notmatch "OK") { throw "Docker não iniciou. Consulte /tmp/dockerd.log." }
}

function Ensure-Waha {
    Ensure-Docker
    Wsl "cd /home/wagner/waha && if grep -q '^WHATSAPP_DEFAULT_ENGINE=' .env; then sed -i 's/^WHATSAPP_DEFAULT_ENGINE=.*/WHATSAPP_DEFAULT_ENGINE=GOWS/' .env; else printf '\nWHATSAPP_DEFAULT_ENGINE=GOWS\n' >> .env; fi" | Out-Null
    $exists = Wsl "docker ps -a --format '{{.Names}}' | grep -qx 'waha' && echo YES || true"
    if ($exists -notmatch "YES") {
        $cmd = "docker run -d --name=waha --restart=unless-stopped --dns=1.1.1.1 --dns=8.8.8.8 --env-file=/home/wagner/waha/.env -v /home/wagner/waha/sessions:/app/.sessions -p 3000:3000 devlikeapro/waha:latest"
        Wsl $cmd | Out-Null
        Start-Sleep -Seconds 9
    } else {
        Wsl "docker start waha >/dev/null 2>&1 || true" | Out-Null
        Start-Sleep -Seconds 3
    }
}

function Get-TunnelUrl {
    return (Wsl "grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/intorna-cloudflared.log 2>/dev/null | tail -n1").Trim()
}

function Start-Tunnel([bool]$Renew=$false) {
    Ensure-Waha
    $current = Get-TunnelUrl
    $proc = Wsl "pgrep -f 'cloudflared tunnel --url http://localhost:3000' >/dev/null && echo RUNNING || true"
    if (!$Renew -and $current -and $proc -match "RUNNING") { return $current }
    Wsl "pkill -f 'cloudflared tunnel --url http://localhost:3000' >/dev/null 2>&1 || true" | Out-Null
    Wsl "cd /home/wagner/waha && rm -f /tmp/intorna-cloudflared.log && nohup ./cloudflared tunnel --url http://localhost:3000 >/tmp/intorna-cloudflared.log 2>&1 </dev/null &" | Out-Null
    Start-Sleep -Seconds 10
    $url = Get-TunnelUrl
    if (!$url) {
        Start-Sleep -Seconds 6
        $url = Get-TunnelUrl
    }
    if (!$url) { throw "Cloudflare iniciou, mas a URL ainda não apareceu." }
    return $url
}

function Get-StackStatus {
    $docker = Wsl "docker info >/dev/null 2>&1 && echo true || echo false"
    $waha = Wsl "docker ps --format '{{.Names}}' | grep -qx 'waha' && echo true || echo false"
    $http = Wsl "curl -sS -o /dev/null -w '%{http_code}' --max-time 4 http://localhost:3000 2>/dev/null || true"
    $tunnel = Get-TunnelUrl
    $tproc = Wsl "pgrep -f 'cloudflared tunnel --url http://localhost:3000' >/dev/null && echo true || echo false"
    return @{
        dockerOnline = ($docker -match "true")
        wahaOnline = ($waha -match "true")
        wahaHttp = $http
        tunnelProcess = ($tproc -match "true")
        tunnelUrl = $tunnel
        checkedAt = (Get-Date).ToString("o")
    }
}

function Run-Diagnostic {
    $parts = @()
    $parts += "=== DOCKER ==="
    $parts += Wsl "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1"
    $parts += "`n=== DNS ==="
    $parts += Wsl "docker exec waha getent hosts web.whatsapp.com 2>&1 || true"
    $parts += Wsl "docker exec waha getent hosts sqeqehohwrfqtbdxcnfs.supabase.co 2>&1 || true"
    $parts += "`n=== WAHA LOGS ==="
    $parts += Wsl "docker logs --since 10m waha 2>&1 | tail -n 80"
    $parts += "`n=== CLOUDFLARE ==="
    $parts += Wsl "tail -n 60 /tmp/intorna-cloudflared.log 2>&1 || true"
    $text = ($parts -join "`n")
    if ($text.Length -gt 12000) { $text = $text.Substring($text.Length-12000) }
    return $text
}

function Complete-Job([string]$JobId,[bool]$Ok,[hashtable]$Result,[string]$ErrorMessage="") {
    try {
        Invoke-AgentAuth @{ action="complete"; jobId=$JobId; ok=$Ok; result=$Result; error=$ErrorMessage } | Out-Null
    } catch {}
}

New-Item -ItemType Directory -Path $Root -Force | Out-Null
$pair = Pair-Start

if ($PairOnly) {
    $cfg = Read-Config
    $txt = Join-Path ([Environment]::GetFolderPath("Desktop")) "INTORNA_LAUNCHER_PAREAMENTO.txt"
    @"
INTORNÁ PIXELS • RC20

CÓDIGO DE PAREAMENTO:
$($cfg.pairCode)

No Intorná:
Plataforma > Infra + Launcher > Parear notebook

Este código expira em aproximadamente 20 minutos.
NÃO compartilhe o arquivo config.json da pasta IntornaLauncher.
"@ | Set-Content -Path $txt -Encoding UTF8
    Start-Process notepad.exe $txt
    exit 0
}

$counter = 0
while ($true) {
    try {
        $poll = Invoke-AgentAuth @{ action="poll" }
        if ($poll.job) {
            $job = $poll.job
            $result = @{}
            try {
                switch ([string]$job.action) {
                    "status" {
                        $st = Get-StackStatus
                        $result = @{ status=$st; tunnelUrl=[string]$st.tunnelUrl }
                    }
                    "start_stack" {
                        Ensure-Waha
                        $url = Start-Tunnel $false
                        $st = Get-StackStatus
                        $result = @{ status=$st; tunnelUrl=$url; message="Pilha recuperada." }
                    }
                    "renew_tunnel" {
                        $url = Start-Tunnel $true
                        $st = Get-StackStatus
                        $result = @{ status=$st; tunnelUrl=$url; message="Quick Tunnel renovado." }
                    }
                    "restart_waha" {
                        Ensure-Docker
                        Wsl "docker restart waha >/dev/null" | Out-Null
                        Start-Sleep -Seconds 8
                        $st = Get-StackStatus
                        $result = @{ status=$st; tunnelUrl=[string]$st.tunnelUrl; message="WAHA reiniciado." }
                    }
                    "diagnose" {
                        $st = Get-StackStatus
                        $result = @{ status=$st; tunnelUrl=[string]$st.tunnelUrl; log=(Run-Diagnostic) }
                    }
                    default { throw "Ação não reconhecida pelo Launcher." }
                }
                Complete-Job ([string]$job.id) $true $result ""
            } catch {
                Complete-Job ([string]$job.id) $false @{ status=(Get-StackStatus) } $_.Exception.Message
            }
        }
        $counter++
        if ($counter -ge 6) {
            $counter = 0
            $st = Get-StackStatus
            Invoke-AgentAuth @{ action="heartbeat"; status=$st; tunnelUrl=[string]$st.tunnelUrl } | Out-Null
        }
    } catch {
        Start-Sleep -Seconds 10
        try { Pair-Start | Out-Null } catch {}
    }
    Start-Sleep -Seconds 5
}
