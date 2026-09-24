# Idempotent Windows PowerShell stopper for FinAlly (PLAN.md section 11).
#
# A 1:1 logic port of scripts/stop_mac.sh: stops and removes the "finally"
# container only. Deliberately never issues any Docker subcommand that
# deletes or recreates the "finally-data" named volume - OPS-02 requires
# that stopping (repeatedly, in any order) never destroys the operator's
# trades, watchlist, or chat history.

$ErrorActionPreference = "Stop"

$ContainerName = "finally"

Set-Location (Join-Path $PSScriptRoot "..")

$allNames = docker ps -a --format '{{.Names}}'
$exists = $allNames | Where-Object { $_ -eq $ContainerName }

if ($exists) {
    docker stop $ContainerName *> $null
    docker rm $ContainerName *> $null
    Write-Host "FinAlly stopped."
}
else {
    Write-Host "FinAlly is not running."
}
