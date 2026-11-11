# Run from Windows PowerShell with Docker Desktop + WSL2 (Ubuntu).
# No administrator permissions are requested. All work is local except the
# fixed Geofabrik extract download done explicitly in Build mode.
param(
  [ValidateSet("Check","Build","Test","Stop")]
  [string]$Mode = "Check",
  [string]$Distro = "Ubuntu"
)
$ErrorActionPreference = "Stop"
$wslCommand = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslCommand) { throw "WSL2 is required. Install an Ubuntu WSL2 distribution first." }
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Resolve Windows path to WSL without constructing an arbitrary shell command
$wslPath = (& wsl.exe -d $Distro -- wslpath -a "$dir" | Select-Object -First 1)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($wslPath)) {
  throw "Cannot access project directory from WSL distro $Distro"
}
if ($wslPath -notmatch '^/mnt/[a-z]/') {
  throw "Expected a Windows project folder mounted below /mnt/<drive>; move the repo to C: or another shared drive."
}
# Arguments are passed to bash, directory never interpolated into shell code.
& wsl.exe -d $Distro -- bash "$wslPath/run_pilot.sh" $Mode.ToLowerInvariant()
if ($LASTEXITCODE -ne 0) { throw "Valhalla pilot $Mode failed with exit code $LASTEXITCODE" }
