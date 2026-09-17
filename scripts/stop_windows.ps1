<#
.SYNOPSIS
    Stop and remove the running FinAlly container. Does NOT remove the data volume.
.DESCRIPTION
    Idempotent: safe to run multiple times, even if the container isn't running.
#>

$ErrorActionPreference = "Stop"

$ContainerName = "finally-app"

$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"
if ($existing) {
    Write-Host "Stopping and removing container $ContainerName..."
    docker rm -f $ContainerName | Out-Null
    Write-Host "Done. (The 'finally-data' volume was preserved.)"
} else {
    Write-Host "No container named $ContainerName found. Nothing to do."
}
