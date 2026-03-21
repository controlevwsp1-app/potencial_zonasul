// ============================================================
// seed.js — Rode UMA VEZ no console do browser para popular o banco
// 1. Abra index.html no browser
// 2. Abra o Console (F12)
// 3. Cole este script inteiro e pressione Enter
// ============================================================

const SEED_DATA = [
  // Gerado automaticamente a partir da planilha ANALISE_-_REGIAO_-_ZONA_SUL__OESTE_E_CENTRO.xlsm
  // Cole aqui o conteúdo de data_seed.json (ou use o botão "Importar Dados" na página de admin)
];

async function seedDatabase() {
  if (!window.SUPABASE_CLIENT) {
    console.error('❌ Abra o index.html primeiro para inicializar o Supabase');
    return;
  }
  console.log('🌱 Iniciando seed...');
  const { error } = await window.SUPABASE_CLIENT.from('lojas').insert(SEED_DATA);
  if (error) console.error('❌ Erro:', error);
  else console.log('✅ Seed concluído! Recarregue a página.');
}

seedDatabase();
