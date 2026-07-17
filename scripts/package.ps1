param()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$appinfoPath = Join-Path $projectRoot "appinfo.json"

if (-not (Test-Path $appinfoPath)) {
    Write-Error "appinfo.json not found in $projectRoot"
    exit 1
}

$app = Get-Content $appinfoPath -Raw | ConvertFrom-Json
$out = "$($app.id)-$($app.version).ipk"

if (-not (Get-Command ares-package -ErrorAction SilentlyContinue)) {
    Write-Host "ares-package not found. Install with: npm install -g ares-cli"
    exit 1
}

Push-Location $projectRoot
Write-Host "Packaging project at $projectRoot -> $out"
ares-package . -o $out
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Error "ares-package failed with exit code $exitCode"
    Pop-Location
    exit $exitCode
}

Write-Host "Package created: $out"
Pop-Location
exit 0
