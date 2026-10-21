@echo off
setlocal
cd /d "%~dp0"

if not exist "package.json" (
  echo Could not find package.json. Keep start.bat in the project folder.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Project dependencies are not installed.
  echo Run npm install from this folder, then try again.
  pause
  exit /b 1
)

echo Starting Craft SMP in a separate server window...
start "Craft SMP dev server" /D "%~dp0" cmd.exe /k "npm.cmd run dev -- --host 127.0.0.1"

echo Waiting for the website to become ready...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$urls = @('http://127.0.0.1:5173/', 'http://127.0.0.1:8080/'); $deadline = (Get-Date).AddSeconds(90); while ((Get-Date) -lt $deadline) { foreach ($url in $urls) { try { $response = Invoke-WebRequest -Uri $url -TimeoutSec 2; if ($response.StatusCode -eq 200 -and $response.Content.Contains('Craft SMP')) { Start-Process $url; Write-Output ('Opened ' + $url); exit 0 } } catch {} }; Start-Sleep -Seconds 1 }; Write-Error 'The website did not respond within 90 seconds. Check the Craft SMP dev server window.'; exit 1"

if errorlevel 1 (
  echo Check the Craft SMP dev server window for errors.
  pause
  exit /b 1
)

echo The website is open in your browser.
echo To stop it, close the Craft SMP dev server window.
pause
