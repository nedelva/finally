<#
.SYNOPSIS
    Build (if needed) and run the FinAlly Docker container.
.DESCRIPTION
    Idempotent: safe to run multiple times. Pass -Build to force a rebuild.
#>
param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$ImageName = "finally:latest"
$ContainerName = "finally-app"
$VolumeName = "finally-data"
$Port = 8000

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# --- .env handling -----------------------------------------------------
$EnvFile = Join-Path $ProjectRoot ".env"
$EnvArgs = @()
if (Test-Path $EnvFile) {
    $EnvArgs = @("--env-file", $EnvFile)
} else {
    Write-Host "Warning: no .env file found at $EnvFile."
    Write-Host "  Create one with:  Copy-Item .env.example .env   (then add your OPENROUTER_API_KEY)"
    Write-Host "  Continuing without it -- the AI chat feature will not work until OPENROUTER_API_KEY is set."
}

# --- Build image if missing or -Build passed ----------------------------
# Note: `docker image inspect` on a missing image exits non-zero but does not throw a
# catchable PowerShell exception (it's a native command), so check $LASTEXITCODE explicitly.
docker image inspect $ImageName *>$null
$imageExists = ($LASTEXITCODE -eq 0)

if ($Build -or -not $imageExists) {
    Write-Host "Building Docker image $ImageName..."
    docker build -t $ImageName $ProjectRoot
    if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
} else {
    Write-Host "Docker image $ImageName already exists (use -Build to force a rebuild)."
}

# --- Remove any existing container with the same name -------------------
$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"
if ($existing) {
    Write-Host "Removing existing container $ContainerName..."
    docker rm -f $ContainerName | Out-Null
}

# --- Run --------------------------------------------------------------
Write-Host "Starting $ContainerName..."
$runArgs = @(
    "run", "-d",
    "--name", $ContainerName,
    "-p", "${Port}:8000",
    "-v", "${VolumeName}:/app/db"
) + $EnvArgs + @($ImageName)

docker @runArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "docker run failed" }

Write-Host ""
Write-Host "FinAlly is starting at http://localhost:$Port"

# Optionally open the browser (best-effort; never fail the script if unavailable).
try {
    Start-Process "http://localhost:$Port" | Out-Null
} catch {
    # Ignore -- e.g. running headless/CI.
}
