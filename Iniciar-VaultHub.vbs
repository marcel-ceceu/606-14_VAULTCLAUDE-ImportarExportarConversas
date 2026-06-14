' Duplo-clique: abre Vault Hub no browser (sem janela PowerShell)
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = root & "\VaultHub-Launcher.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
CreateObject("Wscript.Shell").Run cmd, 0, False
