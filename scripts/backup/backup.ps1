<#
.SYNOPSIS
    OVS Automated Database Backup Script (PowerShell)
.DESCRIPTION
    Performs consistent PostgreSQL database backup, computes SHA-256 hash,
    optionally encrypts artifact, and prunes older backups.
#>
[CmdletBinding()]
param(
    [string]$BackupDir = "./backups",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "ovs_db",
    [string]$DbUser = "ovs_admin",
    [int]$RetentionDays = 14,
    [string]$ContainerName = "ovs-prod-postgres"
)

$ErrorActionPreference = "Stop"
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$BackupFileName = "ovs_${DbName}_${Timestamp}.dump"
$BackupPath = Join-Path $BackupDir $BackupFileName
$ChecksumPath = "$BackupPath.sha256"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "[INFO] Starting OVS database backup for '$DbName' on $DbHost:$DbPort..."

$pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue
if ($pgDump) {
    & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $BackupPath
} else {
    Write-Host "[WARN] pg_dump CLI not found on host path. Delegating to Docker container '$ContainerName'..."
    docker exec $ContainerName pg_dump -U $DbUser -d $DbName -Fc | Set-Content -Path $BackupPath -AsByteStream -ErrorAction SilentlyContinue
}

if (-not (Test-Path $BackupPath) -or (Get-Item $BackupPath).Length -eq 0) {
    Write-Error "[ERROR] Backup failed: Artifact was not generated or is zero bytes."
    exit 1
}

$fileSize = (Get-Item $BackupPath).Length
Write-Host "[INFO] Backup created successfully: $BackupPath ($fileSize bytes)"

# Calculate SHA256
$hash = Get-FileHash -Path $BackupPath -Algorithm SHA256
"$($hash.Hash.ToLower())  $BackupFileName" | Out-File -FilePath $ChecksumPath -Encoding ascii
Write-Host "[INFO] SHA-256 checksum saved to: $ChecksumPath"

# Prune older than RetentionDays
Write-Host "[INFO] Applying retention policy: removing archives older than $RetentionDays days..."
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -File | Where-Object {
    ($_.Name -like "ovs_*.dump*" -or $_.Name -like "ovs_*.sha256") -and $_.LastWriteTime -lt $cutoff
} | Remove-Item -Force

Write-Host "[SUCCESS] Backup routine finished successfully."
