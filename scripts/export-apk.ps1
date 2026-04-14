$ErrorActionPreference = 'Stop'
$src = 'C:\Users\user\Downloads\Incirql\android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $src)) {
  throw "APK not found: $src"
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dstStamped = "C:\Users\user\Downloads\Incirql-debug-whatsapp-single-avatar-aligned-$stamp.apk"
$dstLatest = 'C:\Users\user\Downloads\Incirql-debug-latest.apk'
Copy-Item $src $dstStamped -Force
Copy-Item $src $dstLatest -Force
Get-Item $dstStamped, $dstLatest | Select-Object FullName, Length, LastWriteTime | Format-List
