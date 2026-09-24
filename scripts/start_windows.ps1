# Idempotent Windows PowerShell launcher for FinAlly (PLAN.md section 11).
#
# A 1:1 logic port of scripts/start_mac.sh: builds the image if absent (or
# when -Build is passed), starts the container if it exists but is stopped,
# creates it if it does not exist yet, and blocks until the app actually
# answers /api/health before printing the ready message. Safe to run
# repeatedly: an already-running container is a no-op success.

param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$ContainerName = "finally"
$ImageName = "finally"
$VolumeName = "finally-data"

Set-Location (Join-Path $PSScriptRoot "..")

$imageExists = $true
docker image inspect $ImageName *> $null
if ($LASTEXITCODE -ne 0) {
    $imageExists = $false
}

if ($Build -or -not $imageExists) {
    docker build -t $ImageName .
    if ($LASTEXITCODE -ne 0) {
        throw "docker build failed"
    }
}

$runningNames = docker ps --format '{{.Names}}'
$isRunning = $runningNames | Where-Object { $_ -eq $ContainerName }

if ($isRunning) {
    # already running - fall through to the readiness gate and ready message
}
else {
    $allNames = docker ps -a --format '{{.Names}}'
    $exists = $allNames | Where-Object { $_ -eq $ContainerName }
    if ($exists) {
        docker start $ContainerName | Out-Null
    }
    else {
        docker run -d --name $ContainerName `
            -v "${VolumeName}:/app/db" `
            -p 8000:8000 --env-file .env $ImageName | Out-Null
    }
}

# Readiness gate: never announce success against a container that is still
# booting, or that booted degraded. Poll for up to ~90 seconds.
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:8000/api/health" -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    }
    catch {
        # not ready yet - keep polling
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Error "FinAlly did not become ready within 90 seconds. Check 'docker logs $ContainerName' for details."
    exit 1
}

Write-Host "FinAlly running at http://localhost:8000"
