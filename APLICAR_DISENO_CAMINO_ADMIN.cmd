@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CAMINO - Aplicar diseno profesional del Centro Editorial
color 0B

echo.
echo ============================================================
echo   CAMINO - CENTRO EDITORIAL
echo   Aplicar identidad visual profesional
echo ============================================================
echo.

set "ZIP=%USERPROFILE%\Downloads\CAMINO_ADMIN_IDENTIDAD_VISUAL_UI_PATCH.zip"
set "DEST=C:\CAMINO\CAMINO_ADMIN_IDENTIDAD_VISUAL_UI"
set "ADMIN=C:\CAMINO\camino-admin"

echo [1/6] Verificando proyecto...
if not exist "%ADMIN%" (
    echo.
    echo ERROR: No existe:
    echo %ADMIN%
    echo.
    pause
    exit /b 1
)

echo [2/6] Verificando archivo ZIP...
if not exist "%ZIP%" (
    echo.
    echo ERROR: No encuentro:
    echo %ZIP%
    echo.
    echo Descarga primero:
    echo CAMINO_ADMIN_IDENTIDAD_VISUAL_UI_PATCH.zip
    echo y dejalo en la carpeta Descargas.
    echo.
    pause
    exit /b 1
)

echo [3/6] Preparando carpeta temporal...
if exist "%DEST%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Remove-Item -LiteralPath '%DEST%' -Recurse -Force -ErrorAction SilentlyContinue"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "New-Item -ItemType Directory -Path '%DEST%' -Force | Out-Null; Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%DEST%' -Force"

if errorlevel 1 (
    echo.
    echo ERROR: No fue posible extraer el parche.
    echo.
    pause
    exit /b 1
)

echo [4/6] Localizando APPLY_DESIGN.ps1...
set "APPLYSCRIPT="
for /r "%DEST%" %%F in (APPLY_DESIGN.ps1) do (
    if not defined APPLYSCRIPT set "APPLYSCRIPT=%%F"
)

if not defined APPLYSCRIPT (
    echo.
    echo ERROR: No se encontro APPLY_DESIGN.ps1 dentro del ZIP.
    echo.
    pause
    exit /b 1
)

echo Encontrado:
echo !APPLYSCRIPT!
echo.

echo [5/6] Aplicando diseno profesional...
powershell -NoProfile -ExecutionPolicy Bypass -File "!APPLYSCRIPT!"

if errorlevel 1 (
    echo.
    echo ============================================================
    echo   EL PARCHE NO TERMINO CORRECTAMENTE
    echo ============================================================
    echo.
    echo Revisa el mensaje anterior.
    echo El script de diseno crea respaldo antes de modificar.
    echo.
    pause
    exit /b 1
)

echo.
echo [6/6] Proceso finalizado.
echo.
echo ============================================================
echo   CAMINO ADMIN - DISENO APLICADO
echo ============================================================
echo.
echo Proyecto:
echo %ADMIN%
echo.
echo Para abrir el Centro Editorial:
echo.
echo   cd /d C:\CAMINO\camino-admin
echo   npm run dev
echo.
echo Luego abre:
echo   http://localhost:3001/admin
echo.
echo Si ya estaba abierto, usa Ctrl + Shift + R en el navegador.
echo.
pause
exit /b 0
