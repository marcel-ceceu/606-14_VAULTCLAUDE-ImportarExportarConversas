@echo off
REM Duplo-clique: abre Vault Hub (sem depender da associacao .vbs do Windows)
cd /d "%~dp0"
start "" /B wscript.exe //B "%~dp0Iniciar-VaultHub.vbs"
exit /b 0
