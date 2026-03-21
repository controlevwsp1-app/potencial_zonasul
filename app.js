// ============================================================
// app.js — CARBANK · Carteira SP
// ============================================================

// ── CONFIG (preenchida pelo usuário no config.js) ──
const CFG = window.CARBANK_CONFIG || {};
const SUPA_URL = CFG.supabaseUrl || '';
const SUPA_KEY = CFG.supabaseKey || '';

// ── MR META ──
const MR_META = {
  'MR-C1': { nome:'Centro · Bela Vista · Higienópolis',              zona:'Centro',     cor:'#BA7517', bg:'#FAEEDA', txt:'#633806', lat:-23.553, lng:-46.645 },
  'MR-S1': { nome:'Vila Mariana · Saúde · Ipiranga',                 zona:'Zona Sul',   cor:'#1D9E75', bg:'#E1F5EE', txt:'#04342C', lat:-23.587, lng:-46.628 },
  'MR-S2': { nome:'Jabaquara · Cidade Ademar · Pedreira',            zona:'Zona Sul',   cor:'#0F6E56', bg:'#9FE1CB', txt:'#04342C', lat:-23.656, lng:-46.653 },
  'MR-S3': { nome:'Itaim Bibi · Campo Belo · Brooklin',              zona:'Zona Sul',   cor:'#5DCAA5', bg:'#C0EDD8', txt:'#04342C', lat:-23.610, lng:-46.685 },
  'MR-S4': { nome:'Santo Amaro · Interlagos · Chácara Sto. Antônio', zona:'Zona Sul',   cor:'#085041', bg:'#5DCAA5', txt:'#E1F5EE', lat:-23.660, lng:-46.710 },
  'MR-S5': { nome:'Cidade Dutra · Grajaú · Guarapiranga · Socorro',  zona:'Zona Sul',   cor:'#9FE1CB', bg:'#E1F5EE', txt:'#04342C', lat:-23.715, lng:-46.690 },
  'MR-O1': { nome:'Pinheiros · Vila Madalena · Lapa · Perdizes',     zona:'Zona Oeste', cor:'#378ADD', bg:'#E6F1FB', txt:'#042C53', lat:-23.544, lng:-46.705 },
  'MR-O2': { nome:'Butantã · Jaguaré · Vila Leopoldina',             zona:'Zona Oeste', cor:'#185FA5', bg:'#B5D4F4', txt:'#042C53', lat:-23.563, lng:-46.750 },
  'MR-O3': { nome:'Morumbi · Campo Limpo · Capão Redondo · Pirituba',zona:'Zona Oeste', cor:'#0C447C', bg:'#85B7EB', txt:'#E6F1FB', lat:-23.638, lng:-46.760 },
};

// ── STATE ──
let allLojas = [];
let filteredLojas = [];
let mapaInitialized = false;
let mapInstance = null;
let mapMarkers = [];

// ── SUPABASE CLIENT ──
let sb = null;
function initSupabase() {
  if (!SUPA_URL || !SUPA_KEY) {
    showToast('Configure o Supabase em config.js', 'error');
    return false;
  }
  sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  window.SUPABASE_CLIENT = sb;
  return true;
}

// ── FETCH DATA ──
async function loadLojas() {
  showLoading(true);
  try {
    const { data, error } = await sb.from('lojas').select('*').order('micro_regiao').order('razao_social');
    if (error) throw error;
    allLojas = data || [];
    filteredLojas = [...allLojas];
    renderAll();
  } catch(e) {
    showToast('Erro ao carregar dados: ' + e.message, 'error');
    // fallback: load seed
    await loadSeed();
  } finally {
    showLoading(false);
  }
}

async function loadSeed() {
  try {
    const r = await fetch('data_seed.json');
    const data = await r.json();
    allLojas = data.map((d,i) => ({...d, id: i+1}));
    filteredLojas = [...allLojas];
    renderAll();
    showToast('Modo offline — configure Supabase em config.js', 'error');
  } catch(e) {
    showToast('Erro ao carregar dados locais', 'error');
  }
}

// ── RENDER ALL ──
function renderAll() {
  const active = allLojas.filter(l => l.ativo !== false);
  document.getElementById('badge-total').textContent = active.length + ' lojas ativas';
  renderDashboard();
  applyTableFilters();
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const active = allLojas.filter(l => l.ativo !== false);
  const totalLojas     = active.length;
  const totalContratos = active.reduce((s,l) => s + (l.contratos_geral||0), 0);
  const totalVolume    = active.reduce((s,l) => s + (l.volume_geral||0), 0);
  const totalColabs    = new Set(active.map(l=>l.colaboradora).filter(Boolean)).size;

  document.getElementById('m-lojas').textContent     = totalLojas;
  document.getElementById('m-contratos').textContent = totalContratos.toLocaleString('pt-BR');
  document.getElementById('m-volume').textContent    = fmtBRL(totalVolume);
  document.getElementById('m-colabs').textContent    = totalColabs || '—';

  renderMRCards(active);
  renderColabCards(active);
  renderComparativoMR(active);
}

function renderMRCards(active) {
  const container = document.getElementById('mr-cards-dash');
  container.innerHTML = '';
  const maxLojas = Math.max(...Object.keys(MR_META).map(mr => active.filter(l=>l.micro_regiao===mr).length));

  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = active.filter(l => l.micro_regiao === mr);
    const colabs = [...new Set(lojas.map(l=>l.colaboradora).filter(Boolean))];
    const contratos = lojas.reduce((s,l)=>s+(l.contratos_geral||0),0);
    const volume = lojas.reduce((s,l)=>s+(l.volume_geral||0),0);
    const pct = maxLojas > 0 ? Math.round(lojas.length/maxLojas*100) : 0;

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${meta.cor};">
      <div class="card-header" style="background:${meta.bg};">
        <div>
          <span class="mr-pill" style="background:${meta.cor};">${mr}</span>
          <span class="badge" style="margin-left:6px;background:${meta.bg};color:${meta.txt};border:1px solid ${meta.cor}40;">${meta.zona}</span>
        </div>
        <span style="font-size:11px;color:${meta.txt};">${lojas.length} lojas</span>
      </div>
      <div class="card-body">
        <div style="font-size:12px;font-weight:500;color:var(--gray-800);margin-bottom:10px;">${meta.nome}</div>
        <div class="progress" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${pct}%;background:${meta.cor};"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Contratos</div>
            <div style="font-size:16px;font-weight:700;color:${meta.cor};">${contratos}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Volume</div>
            <div style="font-size:16px;font-weight:700;color:${meta.cor};">${fmtK(volume)}</div>
          </div>
        </div>
        ${colabs.length > 0 ? `
        <div style="border-top:1px solid var(--gray-100);padding-top:8px;">
          <div style="font-size:10px;color:var(--gray-600);margin-bottom:4px;">COLABORADORAS</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${colabs.map(c=>`<span style="background:${meta.cor}20;color:${meta.cor};font-size:11px;font-weight:500;padding:2px 7px;border-radius:10px;">${c}</span>`).join('')}
          </div>
        </div>` : `<div style="border-top:1px solid var(--gray-100);padding-top:8px;font-size:11px;color:var(--gray-400);">Sem colaboradora atribuída</div>`}
      </div>
    </div>`;
  });
}

function renderColabCards(active) {
  const container = document.getElementById('colab-cards');
  container.innerHTML = '';
  const colabMap = {};
  active.forEach(l => {
    const c = l.colaboradora || null;
    if (!c) return;
    if (!colabMap[c]) colabMap[c] = { lojas:[], contratos:0, volume:0, mrs:new Set() };
    colabMap[c].lojas.push(l);
    colabMap[c].contratos += (l.contratos_geral||0);
    colabMap[c].volume += (l.volume_geral||0);
    colabMap[c].mrs.add(l.micro_regiao);
  });

  const semColab = active.filter(l => !l.colaboradora).length;

  if (Object.keys(colabMap).length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:13px;">
      Nenhuma colaboradora atribuída ainda.<br>Vá para <strong>Planilha</strong> e preencha a coluna <em>Colaboradora</em>.
    </div>`;
    return;
  }

  const sorted = Object.entries(colabMap).sort((a,b) => b[1].volume - a[1].volume);
  const maxVol = sorted[0]?.[1].volume || 1;
  const colors = ['#1D9E75','#185FA5','#BA7517','#D85A30','#534AB7','#0F6E56','#0C447C'];

  sorted.forEach(([nome, d], i) => {
    const cor = colors[i % colors.length];
    const pct = Math.round(d.volume/maxVol*100);
    container.innerHTML += `
    <div class="colab-row">
      <div class="colab-avatar" style="background:${cor}20;color:${cor};">${nome.charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div class="colab-name">${nome}</div>
        <div class="colab-sub">${d.lojas.length} lojas · ${[...d.mrs].join(', ')}</div>
        <div class="progress" style="margin-top:5px;">
          <div class="progress-fill" style="width:${pct}%;background:${cor};"></div>
        </div>
      </div>
      <div style="text-align:right;min-width:80px;">
        <div style="font-size:14px;font-weight:700;color:${cor};">${d.contratos}</div>
        <div style="font-size:11px;color:var(--gray-600);">contratos</div>
        <div style="font-size:12px;font-weight:600;color:var(--gray-800);">${fmtK(d.volume)}</div>
      </div>
    </div>`;
  });

  if (semColab > 0) {
    container.innerHTML += `<div style="padding:10px 0;font-size:12px;color:var(--gray-400);">
      + ${semColab} lojas ainda sem colaboradora atribuída
    </div>`;
  }
}

function renderComparativoMR(active) {
  const container = document.getElementById('comparativo-mr');
  container.innerHTML = '';
  const data = Object.entries(MR_META).map(([mr, meta]) => {
    const lojas = active.filter(l => l.micro_regiao === mr);
    return { mr, meta, lojas: lojas.length, volume: lojas.reduce((s,l)=>s+(l.volume_geral||0),0) };
  }).sort((a,b) => b.volume - a.volume);

  const maxVol = data[0]?.volume || 1;
  data.forEach(d => {
    container.innerHTML += `
    <div class="bar-chart-row">
      <div class="bar-chart-label" title="${d.meta.nome}">
        <span class="mr-pill" style="background:${d.meta.cor};font-size:10px;">${d.mr}</span>
        <span style="margin-left:6px;font-size:11px;">${d.lojas} lojas</span>
      </div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(d.volume/maxVol*100)}%;background:${d.meta.cor};">
        </div>
      </div>
      <div class="bar-chart-val" style="color:${d.meta.cor};">${fmtK(d.volume)}</div>
    </div>`;
  });
}

// ══════════════════════════════════════════════════════════
// PLANILHA / TABELA
// ══════════════════════════════════════════════════════════
let currentPage = 1;
const PAGE_SIZE = 50;
let pendingSaves = {};
let saveTimer = null;

function applyTableFilters() {
  const search = document.getElementById('f-busca')?.value?.toLowerCase() || '';
  const zona   = document.getElementById('f-zona')?.value || '';
  const mr     = document.getElementById('f-mr')?.value || '';
  const colab  = document.getElementById('f-colab')?.value || '';
  const status = document.getElementById('f-status')?.value || '';

  filteredLojas = allLojas.filter(l => {
    if (status === 'ativo'   && l.ativo === false) return false;
    if (status === 'inativo' && l.ativo !== false) return false;
    if (zona  && l.zona !== zona) return false;
    if (mr    && l.micro_regiao !== mr) return false;
    if (colab === '__sem__' && l.colaboradora) return false;
    if (colab && colab !== '__sem__' && l.colaboradora !== colab) return false;
    if (search) {
      const haystack = [l.razao_social, l.bairro, l.cnpj, l.colaboradora].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  currentPage = 1;
  renderTable();
  document.getElementById('tbl-count').textContent = `${filteredLojas.length} registros`;
}

function renderTable() {
  const tbody = document.getElementById('lojas-tbody');
  const start = (currentPage-1)*PAGE_SIZE;
  const pageData = filteredLojas.slice(start, start+PAGE_SIZE);

  tbody.innerHTML = pageData.map(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const zonaBadge = l.zona === 'Zona Sul' ? 'badge-sul' : l.zona === 'Zona Oeste' ? 'badge-oeste' : 'badge-centro';
    const inativo = l.ativo === false;
    return `
    <tr class="${inativo ? 'inativo' : ''}" data-id="${l.id}">
      <td style="font-size:11px;color:var(--gray-400);">${l.cnpj}</td>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.razao_social}">${l.razao_social}</td>
      <td>${l.bairro}</td>
      <td><span class="badge ${zonaBadge}">${l.zona}</span></td>
      <td><span class="mr-pill" style="background:${meta.cor||'#888'};">${l.micro_regiao}</span></td>
      <td style="font-size:12px;">${l.porte}</td>
      <td style="text-align:center;font-weight:600;">${l.contratos_geral}</td>
      <td style="text-align:right;">${fmtBRL(l.volume_geral)}</td>
      <td>
        <input type="text" class="colaboradora-input ${l.colaboradora?'preenchido':''}"
          value="${l.colaboradora||''}"
          placeholder="Nome..."
          data-id="${l.id}"
          onchange="scheduleColabSave(this)"
          oninput="this.classList.toggle('preenchido', this.value.length>0)"
        />
      </td>
      <td>
        <button class="btn btn-icon btn-danger btn-sm" onclick="confirmarExclusao(${l.id})" title="${inativo?'Reativar':'Desativar'}">
          ${inativo ? '↩' : '✕'}
        </button>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = filteredLojas.length;
  const pages = Math.ceil(total/PAGE_SIZE);
  const container = document.getElementById('paginacao');
  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = `<span style="font-size:12px;color:var(--gray-600);">Pág. ${currentPage} de ${pages}</span>`;
  if (currentPage > 1)  html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage-1})">← Ant.</button>`;
  if (currentPage < pages) html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage+1})">Próx. →</button>`;
  container.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); window.scrollTo(0,0); }

// ── SAVE COLABORADORA ──
function scheduleColabSave(input) {
  const id = input.dataset.id;
  pendingSaves[id] = input.value.trim() || null;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, 800);
  document.getElementById('save-indicator').textContent = 'Salvando...';
  document.getElementById('save-indicator').style.color = 'var(--amber)';
}

async function flushSaves() {
  const entries = Object.entries(pendingSaves);
  pendingSaves = {};
  if (entries.length === 0) return;

  for (const [id, colaboradora] of entries) {
    const idx = allLojas.findIndex(l => String(l.id) === String(id));
    if (idx >= 0) allLojas[idx].colaboradora = colaboradora;

    if (sb) {
      const { error } = await sb.from('lojas').update({ colaboradora }).eq('id', id);
      if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
    }
  }

  document.getElementById('save-indicator').textContent = '✓ Salvo';
  document.getElementById('save-indicator').style.color = 'var(--verde)';
  setTimeout(() => { document.getElementById('save-indicator').textContent = ''; }, 2000);
  renderDashboard();
  if (mapaInitialized) refreshMapa();
}

// ── EXCLUIR / REATIVAR ──
let pendingToggleId = null;
function confirmarExclusao(id) {
  pendingToggleId = id;
  const loja = allLojas.find(l => l.id === id);
  const acao = loja?.ativo === false ? 'reativar' : 'desativar';
  document.getElementById('modal-msg').textContent = `Deseja ${acao} a loja "${loja?.razao_social}"?`;
  document.getElementById('modal-confirm-btn').textContent = acao === 'reativar' ? 'Sim, reativar' : 'Sim, desativar';
  document.getElementById('modal-confirm-btn').className = acao === 'reativar' ? 'btn btn-primary' : 'btn btn-danger';
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function executarToggle() {
  document.getElementById('confirm-modal').classList.add('hidden');
  const id = pendingToggleId;
  const idx = allLojas.findIndex(l => l.id === id);
  if (idx < 0) return;
  const novoAtivo = !(allLojas[idx].ativo !== false);
  allLojas[idx].ativo = novoAtivo;

  if (sb) {
    const { error } = await sb.from('lojas').update({ ativo: novoAtivo }).eq('id', id);
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  }

  showToast(novoAtivo ? 'Loja reativada ✓' : 'Loja desativada ✓', 'success');
  applyTableFilters();
  renderDashboard();
}

// ── BULK SAVE ──
async function salvarTudo() {
  await flushSaves();
  showToast('Tudo salvo ✓', 'success');
}

// ══════════════════════════════════════════════════════════
// MAPA
// ══════════════════════════════════════════════════════════
function initMapa() {
  if (mapaInitialized) return;
  mapaInitialized = true;

  mapInstance = L.map('mapa-container', { zoomControl:true, scrollWheelZoom:true })
    .setView([-23.600, -46.690], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:'&copy; OpenStreetMap &copy; CARTO', maxZoom:18
  }).addTo(mapInstance);

  refreshMapa();
}

function refreshMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  const active = allLojas.filter(l => l.ativo !== false);
  const colabColors = {};
  const allColabs = [...new Set(active.map(l=>l.colaboradora).filter(Boolean))];
  const palette = ['#1D9E75','#185FA5','#BA7517','#D85A30','#534AB7','#0F6E56','#0C447C','#B91C1C'];
  allColabs.forEach((c,i) => { colabColors[c] = palette[i % palette.length]; });

  const filterMR = document.getElementById('mapa-mr-filter')?.value || '';
  const filterColab = document.getElementById('mapa-colab-filter')?.value || '';

  const toPlot = active.filter(l => {
    if (filterMR && l.micro_regiao !== filterMR) return false;
    if (filterColab && l.colaboradora !== filterColab) return false;
    return true;
  });

  // Plot MR bubble circles
  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = toPlot.filter(l => l.micro_regiao === mr);
    if (lojas.length === 0) return;
    const maxL = Math.max(...Object.values(MR_META).map(m2 => active.filter(l=>l.micro_regiao===Object.keys(MR_META).find(k=>MR_META[k]===m2)).length));
    const radius = 20 + (lojas.length / Math.max(47,1)) * 30;

    const circle = L.circleMarker([meta.lat, meta.lng], {
      radius, fillColor: meta.cor, color:'#fff', weight:2.5, opacity:1, fillOpacity:0.18
    }).addTo(mapInstance);
    mapMarkers.push(circle);
  });

  // Plot individual stores as tiny dots
  toPlot.forEach(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const cor = l.colaboradora ? (colabColors[l.colaboradora]||meta.cor) : meta.cor;

    // Scatter dots around MR center
    const jLat = meta.lat + (Math.random()-.5)*0.06;
    const jLng = meta.lng + (Math.random()-.5)*0.07;

    const dot = L.circleMarker([jLat, jLng], {
      radius: 5,
      fillColor: cor,
      color: '#fff',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.85
    }).addTo(mapInstance);

    dot.bindPopup(`
      <div style="font-family:sans-serif;min-width:200px;max-width:260px;">
        <div style="background:${meta.bg};padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">
          <span style="background:${meta.cor};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">${l.micro_regiao}</span>
          <div style="font-size:11px;font-weight:600;color:${meta.txt};margin-top:4px;line-height:1.3;">${l.razao_social}</div>
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:4px;">${l.bairro} · ${l.cep}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">
          <div><span style="color:#888;">Contratos</span><br><strong>${l.contratos_geral}</strong></div>
          <div><span style="color:#888;">Volume</span><br><strong>${fmtBRL(l.volume_geral)}</strong></div>
        </div>
        ${l.colaboradora ? `<div style="background:${cor}20;color:${cor};font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">👤 ${l.colaboradora}</div>` : '<div style="font-size:11px;color:#aaa;">Sem colaboradora</div>'}
      </div>`, { offset:[0,-3] });

    dot.on('mouseover', function(){ this.setStyle({radius:7,weight:2}); });
    dot.on('mouseout',  function(){ this.setStyle({radius:5,weight:1}); });
    mapMarkers.push(dot);
  });

  // Legend
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    legEl.innerHTML = allColabs.length > 0
      ? allColabs.map(c => `<span style="display:inline-flex;align-items:center;gap:5px;background:${colabColors[c]}18;color:${colabColors[c]};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${colabColors[c]};"></span>${c}</span>`).join('')
      : Object.entries(MR_META).map(([mr,m])=>`<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};color:${m.txt};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${m.cor};"></span>${mr}</span>`).join('');
  }

  // Update mapa filter selects
  const mapColabSel = document.getElementById('mapa-colab-filter');
  if (mapColabSel) {
    const cur = mapColabSel.value;
    mapColabSel.innerHTML = '<option value="">Todas colaboradoras</option>' +
      allColabs.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════════════
function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  if (id === 'mapa') { setTimeout(initMapa, 100); }
}

// ══════════════════════════════════════════════════════════
// IMPORT (seed via UI)
// ══════════════════════════════════════════════════════════
async function importarSeed() {
  if (!sb) { showToast('Supabase não configurado', 'error'); return; }
  showLoading(true, 'Importando dados...');
  try {
    const r = await fetch('data_seed.json');
    const data = await r.json();
    const { error } = await sb.from('lojas').upsert(data, { onConflict: 'cnpj' });
    if (error) throw error;
    showToast(`${data.length} lojas importadas ✓`, 'success');
    await loadLojas();
  } catch(e) {
    showToast('Erro na importação: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ══════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════
function fmtBRL(n) {
  if (!n) return 'R$ 0';
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 });
}
function fmtK(n) {
  if (!n) return 'R$ 0';
  if (n >= 1e6) return 'R$ ' + (n/1e6).toFixed(1) + 'M';
  return 'R$ ' + (n/1e3).toFixed(0) + 'K';
}

function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function showLoading(show, msg='Carregando dados...') {
  const el = document.getElementById('loading-overlay');
  el.querySelector('span').textContent = msg;
  el.classList.toggle('hidden', !show);
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  if (initSupabase()) {
    await loadLojas();
  } else {
    await loadSeed();
  }

  // Filter events
  ['f-busca','f-zona','f-mr','f-colab','f-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyTableFilters);
    document.getElementById(id)?.addEventListener('change', applyTableFilters);
  });

  // Mapa filter events
  ['mapa-mr-filter','mapa-colab-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshMapa);
  });
});
