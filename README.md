# 🚀 Carbank · Carteira SP — Guia de Instalação

## O que você vai precisar
- Conta no **GitHub** (gratuita) → https://github.com
- Conta no **Supabase** (gratuita) → https://supabase.com

---

## PASSO 1 — Criar banco de dados no Supabase

1. Acesse https://supabase.com e faça login
2. Clique em **"New project"**
   - Nome: `carbank-sp` (ou qualquer nome)
   - Senha: escolha uma forte (guarde-a)
   - Região: **South America (São Paulo)**
3. Aguarde o projeto criar (~2 minutos)
4. No menu lateral, clique em **SQL Editor**
5. Clique em **"New query"**
6. Abra o arquivo `supabase_setup.sql` deste pacote, copie todo o conteúdo e cole no editor
7. Clique em **"Run"** (ou Ctrl+Enter)
8. Você deve ver a mensagem: *"Success. No rows returned"*

---

## PASSO 2 — Pegar as credenciais do Supabase

1. No menu lateral do Supabase, clique em ⚙️ **Settings** → **API**
2. Copie:
   - **Project URL** → algo como `https://xyzabc.supabase.co`
   - **anon public** key → uma chave longa começando com `eyJ...`
3. Abra o arquivo `config.js` e cole as credenciais:

```js
window.CARBANK_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

---

## PASSO 3 — Subir o site no GitHub Pages

### Opção A — Via interface web (mais fácil)

1. Acesse https://github.com/new
2. Nome do repositório: `carbank-sp`
3. Marque **Public**
4. Clique em **"Create repository"**
5. Na próxima tela, clique em **"uploading an existing file"**
6. Arraste TODOS os arquivos desta pasta para o browser:
   - `index.html`
   - `config.js`
   - `data_seed.json`
   - `supabase_setup.sql`
   - `seed.js`
   - pasta `css/` com `styles.css`
   - pasta `js/` com `app.js`
7. Clique em **"Commit changes"**

### Ativar o GitHub Pages
1. No repositório, clique em **Settings** (aba superior)
2. No menu lateral, clique em **Pages**
3. Em "Source", selecione **Deploy from a branch**
4. Branch: **main** | Folder: **/ (root)**
5. Clique em **Save**
6. Aguarde ~2 minutos
7. Seu site estará em: `https://SEU-USUARIO.github.io/carbank-sp/`

---

## PASSO 4 — Importar os dados iniciais

1. Abra seu site no browser
2. Clique no botão **"↑ Importar dados"** (canto superior direito)
3. Aguarde a mensagem *"274 lojas importadas ✓"*
4. O dashboard vai carregar automaticamente!

---

## Como usar o sistema

### Planilha
- Vá para a aba **Planilha**
- Use os filtros para navegar por Zona, Micro Região ou Colaboradora
- Digite o nome da colaboradora na coluna **Colaboradora ✏️**
  - Salva automaticamente após 0,8 segundo
- Clique em **✕** para desativar uma loja que não tem perfil
  - A loja sai do dashboard mas fica salva no banco
  - Clique em **↩** para reativar

### Dashboard
- Atualiza em tempo real conforme você edita a planilha
- Mostra totais por micro região e por colaboradora
- Comparativo de volume entre as 9 MRs

### Mapa
- Use os filtros para ver por MR ou por colaboradora
- Cada colaboradora aparece com sua cor
- Clique em qualquer ponto para ver detalhes da loja

---

## Atualizar dados no futuro

Para adicionar novas lojas:
1. Edite o arquivo `data_seed.json` adicionando as novas lojas
2. Suba o arquivo atualizado no GitHub
3. No site, clique em **"↑ Importar dados"** novamente
   - O sistema usa `upsert` pelo CNPJ, então não duplica

---

## Estrutura dos arquivos

```
carbank-sp/
├── index.html          ← Site principal (Dashboard + Planilha + Mapa)
├── config.js           ← Suas credenciais do Supabase ← EDITE ESTE
├── data_seed.json      ← Dados das 274 lojas
├── supabase_setup.sql  ← SQL para criar o banco ← rode no Supabase
├── seed.js             ← Script auxiliar (não precisa usar)
├── css/
│   └── styles.css      ← Estilos do site
└── js/
    └── app.js          ← Lógica da aplicação
```

---

## Dúvidas frequentes

**O site carregou mas não aparece nada?**
→ Verifique se preencheu corretamente o `config.js` com as credenciais do Supabase.
→ Abra o console do browser (F12) e veja se há mensagens de erro.

**Erro "permission denied" no Supabase?**
→ No Supabase, vá em SQL Editor e rode novamente as linhas das `policies` do `supabase_setup.sql`.

**Quero mudar o nome do projeto no site?**
→ Edite a linha `<title>` e o texto `Carbank · Carteira SP` no `index.html`.

**Como exportar os dados editados?**
→ No Supabase, vá em **Table Editor** → tabela `lojas` → clique em **Export** → CSV.
