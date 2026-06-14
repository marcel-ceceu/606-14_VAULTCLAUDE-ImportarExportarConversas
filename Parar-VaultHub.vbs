' Encerra o servidor Vault Hub em segundo plano (sem janela)
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = root & "\VaultHub-Launcher.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -Stop"
CreateObject("Wscript.Shell").Run cmd, 0, False
