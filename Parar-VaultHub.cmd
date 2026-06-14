@echo off
cd /d "%~dp0"
start "" /B wscript.exe //B "%~dp0Parar-VaultHub.vbs"
exit /b 0
