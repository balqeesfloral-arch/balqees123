@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [Balqees] Store transition hotfix only
echo --------------------------------------

if not exist "src\individual\IndividualPortalLayout.jsx" (
  echo [ERROR] This file must be placed in the Balqees project root next to package.json.
  echo Nothing was changed.
  pause
  exit /b 1
)

if not exist "src\pages\Store.jsx" (
  echo [ERROR] src\pages\Store.jsx was not found.
  echo Nothing was changed.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$raw=[IO.File]::ReadAllText('%~f0'); $m='###'+'BALQEES_POWERSHELL'+'###'; $parts=[regex]::Split($raw,[regex]::Escape($m),2); if($parts.Count -ne 2){throw 'Embedded patch script missing.'}; Invoke-Expression $parts[1]"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo [DONE] Store fix completed. No other files were touched.
) else (
  echo [STOPPED] Validation failed. The original target files were restored.
)
echo.
pause
exit /b %RC%

###BALQEES_POWERSHELL###
$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$layoutPath = Join-Path $root 'src\individual\IndividualPortalLayout.jsx'
$storePath = Join-Path $root 'src\pages\Store.jsx'
$utf8 = New-Object System.Text.UTF8Encoding($false)

$layout = [IO.File]::ReadAllText($layoutPath)
$store = [IO.File]::ReadAllText($storePath)
$originalLayout = $layout
$originalStore = $store

$mobileOld = 'to="/store" aria-label='
$mobileNew = 'to="/store" state={{ fromIndividualPortal: true }} aria-label='
if ($layout.Contains($mobileOld)) {
  if (([regex]::Matches($layout, [regex]::Escape($mobileOld))).Count -ne 1) { throw 'Unexpected number of mobile Store links. Nothing was changed.' }
  $layout = $layout.Replace($mobileOld, $mobileNew)
} elseif (-not $layout.Contains($mobileNew)) {
  throw 'Expected mobile Store link was not found. Nothing was changed.'
}

$sideOld = 'to={item.to} className={`individual-portal-nav-link'
$sideNew = 'to={item.to} state={item.key === ''store'' ? { fromIndividualPortal: true } : undefined} className={`individual-portal-nav-link'
if ($layout.Contains($sideOld)) {
  if (([regex]::Matches($layout, [regex]::Escape($sideOld))).Count -ne 1) { throw 'Unexpected sidebar Store navigation structure. Nothing was changed.' }
  $layout = $layout.Replace($sideOld, $sideNew)
} elseif (-not $layout.Contains($sideNew)) {
  throw 'Expected sidebar navigation line was not found. Nothing was changed.'
}

if (-not $store.Contains('location.state?.fromIndividualPortal')) {
  $reactOld = "import { useEffect, useState } from 'react';"
  $reactNew = "import { useEffect, useLayoutEffect, useState } from 'react';"
  if (-not $store.Contains($reactOld)) { throw 'Expected React import in Store.jsx was not found. Nothing was changed.' }
  $store = $store.Replace($reactOld, $reactNew)

  $lucideOld = "import { LoaderCircle } from 'lucide-react';"
  $lucideNew = $lucideOld + "`nimport { useLocation } from 'react-router-dom';"
  if (-not $store.Contains($lucideOld)) { throw 'Expected lucide import in Store.jsx was not found. Nothing was changed.' }
  $store = $store.Replace($lucideOld, $lucideNew)

  $functionOld = 'export default function Store({ lang }) {'
  $functionNew = $functionOld + "`n  const location = useLocation();"
  if (-not $store.Contains($functionOld)) { throw 'Store component declaration was not found. Nothing was changed.' }
  $store = $store.Replace($functionOld, $functionNew)

  $effectNeedle = '  useEffect(()=>{'
  $guard = @'
  useLayoutEffect(()=>{
    if(!location.state?.fromIndividualPortal) return undefined;
    document.body.classList.add('individual-account-active');
    return()=>{
      if(!window.location.pathname.startsWith('/store')) document.body.classList.remove('individual-account-active');
    };
  },[location.state?.fromIndividualPortal]);

'@
  $idx = $store.IndexOf($effectNeedle)
  if ($idx -lt 0) { throw 'Store session effect was not found. Nothing was changed.' }
  $store = $store.Insert($idx, $guard)
}

if (-not $layout.Contains($mobileNew)) { throw 'Mobile Store state validation failed.' }
if (-not $layout.Contains($sideNew)) { throw 'Sidebar Store state validation failed.' }
if (-not $store.Contains('useLayoutEffect')) { throw 'Store layout-effect validation failed.' }
if (-not $store.Contains('location.state?.fromIndividualPortal')) { throw 'Store portal-origin validation failed.' }

if ($layout -eq $originalLayout -and $store -eq $originalStore) {
  Write-Host '[OK] The Store hotfix is already installed. Nothing changed.' -ForegroundColor Green
  exit 0
}

try {
  [IO.File]::WriteAllText($layoutPath, $layout, $utf8)
  [IO.File]::WriteAllText($storePath, $store, $utf8)
} catch {
  [IO.File]::WriteAllText($layoutPath, $originalLayout, $utf8)
  [IO.File]::WriteAllText($storePath, $originalStore, $utf8)
  throw
}

Write-Host '[OK] Fixed only the Store transition from the individual portal.' -ForegroundColor Green
Write-Host '[OK] Touched only: IndividualPortalLayout.jsx and Store.jsx' -ForegroundColor Green
exit 0
