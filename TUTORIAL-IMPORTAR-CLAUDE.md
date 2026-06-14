# Tutorial — Importar conversas do Claude (Vault Hub)

Guia rápido em **2 partes**: primeiro você baixa o ZIP da Anthropic; depois roda **1 comando** no PowerShell. O resto é automático.

---

## O que você vai ter no final

| Pasta | Para quê |
|-------|----------|
| `D:\2606VAULT-ClaudeConversasOF` | Notas `.md` **formatadas e prontas** (sem “thinking” do Claude) |
| `D:\2606VAULT-ClaudeConversasOF-FINAL` | Mesmas notas, **sem “oi / tudo bem”** etc. (melhor para busca/RAG) |

Cada conversa vira um ficheiro `.md` com título, datas e turnos **You** / **Claude**.

---

## Antes de começar (checklist)

- [ ] PC com Windows e drive **D:** disponível  
- [ ] **PowerShell 7** instalado (`pwsh` no terminal — [instalar](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows))  
- [ ] Projeto clonado em: `c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas`  
- [ ] Conta Claude.ai com conversas para exportar  

---

## Parte 1 — Baixar o export (manual, ~5 min)

A Anthropic **não deixa** automatizar este passo: é clique + email.

1. Abra no **Chrome ou Edge** (aba normal, não o app PWA do Claude):  
   https://claude.ai/settings/data-privacy-controls  

2. Menu **Privacy** → botão **Export data** → confirme.

3. Aguarde o email (5–15 min). Dica: busque no Gmail por `anthropic`.

4. No email, clique para baixar. O ficheiro chega como algo assim:  
   `data-...-batch-0000.zip`

5. **Deixe o ZIP em Downloads** — não precisa renomear nem mover.  
   Caminho típico: `C:\Users\SeuNome\Downloads`

> Se o export tiver vários ficheiros `batch-0000`, `batch-0001`, … deixe **todos** em Downloads. O pipeline junta sozinho.

---

## Parte 2 — Rodar o pipeline (1 comando, ~1 min)

### Opção A — Pelo Vault Hub (recomendado)

1. Abra o app Vault Hub no browser (dev local ou deploy).
2. Entre em **Importar Conversas Claude**.
3. Aba **02 Executar pipeline**.
4. Clique **Copiar comando**.
5. Abra **PowerShell** (Windows Terminal ou menu Iniciar → digite `pwsh`).
6. **Cole** (`Ctrl+V`) e pressione **Enter**.

### Opção B — Comando direto (sem abrir o app)

Cole isto no PowerShell:

```powershell
pwsh -ExecutionPolicy Bypass -File "c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas\scripts\pipeline\Run-Pipeline-Auto.ps1"
```

---

## O que acontece quando você roda

1. O script acha o ZIP **mais recente** em Downloads (`data-*.zip`).
2. **Etapa 1** — Lê o JSON, remove blocos internos do Claude, grava `.md` em `D:\2606VAULT-ClaudeConversasOF`.
3. **Etapa 2** — Remove cortesias (“oi”, “obrigado”, …) → `D:\2606VAULT-ClaudeConversasOF-FINAL`.
4. Abre um **log no Notepad** com o resumo (quantos ficheiros, erros se houver).

Na **segunda vez** que rodar com o mesmo export, a Etapa 2 **pula** o que já está feito — não duplica trabalho.

---

## Como saber se deu certo

- [ ] Pasta `D:\2606VAULT-ClaudeConversasOF` tem ficheiros `.md` novos/atualizados  
- [ ] Abrir um `.md`: tem `---` no topo (título, uuid) e secções `## 👤 You` / `## 🤖 Claude`  
- [ ] **Não** aparecem blocos longos de raciocínio interno em inglês  
- [ ] Notepad abriu com linhas tipo `ETAPA 1 OK` e `ETAPA 2 OK`  

---

## Problemas comuns

| O que aparece | O que fazer |
|---------------|-------------|
| `nenhum data-*.zip encontrado` | Baixe o export de novo e confirme que o ZIP está em **Downloads** |
| `drive D: indisponivel` | Use um PC com D: ou peça ajuste do caminho de saída no script |
| `running scripts is disabled` | Use o comando completo com `-ExecutionPolicy Bypass` (já vem no tutorial) |
| `pwsh` não reconhecido | Instale PowerShell 7 ou troque `pwsh` por `powershell` (pode ser mais lento) |
| Windows pede confirmação | Aceite executar o script local (não baixa nada da internet — só lê o ZIP) |
| Quero reprocessar cortesias | Edite `scripts\pipeline\Run-Pipeline-Auto.ps1` → `$Force = $true` e rode de novo |

---

## Onde ficam os ficheiros do pipeline

```
c:\projetos\606-14_VAULTCLAUDE-ImportarExportarConversas\scripts\pipeline\
├── Run-Pipeline-Auto.ps1    ← o que o comando executa
├── _Core.ps1                ← motor (não rode sozinho)
└── 2606-RegexRegrasConversas.txt   ← lista de cortesias
```

Detalhes técnicos: [scripts/pipeline/README.md](scripts/pipeline/README.md)

---

## Resumo em 3 linhas

1. **Export data** no Claude → baixar ZIP → deixar em **Downloads**.  
2. **Copiar comando** no Vault Hub (aba 02) → colar no **PowerShell** → Enter.  
3. Usar as notas em **`D:\2606VAULT-ClaudeConversasOF`** (ou **`-FINAL`** para corpus mais limpo).

---

*Vault Hub · pipeline `2606-ClaudeVaultPipeline` · atualizado jun/2026*
