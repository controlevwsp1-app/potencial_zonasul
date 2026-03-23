// ============================================================
// app.js — CARBANK · Carteira SP
// ============================================================

window.CARBANK_CONFIG = {
  supabaseUrl: 'https://yydctmbavkttcvahntco.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZGN0bWJhdmt0dGN2YWhudGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTQ5NjcsImV4cCI6MjA4OTYzMDk2N30.BBmlIOvhC8gN01bMcAmfyMqhkqYWRDeG18aYBacM6kM',
};
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
  populateColabFilter();
}

function populateColabFilter() {
  const sel = document.getElementById('f-colab');
  if (!sel) return;
  const colabs = [...new Set(allLojas.map(l=>l.colaboradora).filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas colaboradoras</option><option value="__sem__">Sem colaboradora</option>' +
    colabs.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
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

  const colors = ['#1D9E75','#185FA5','#BA7517','#D85A30','#534AB7','#0F6E56','#0C447C'];
  const sorted = Object.entries(colabMap).sort((a,b) => b[1].volume - a[1].volume);
  const maxVol = sorted[0]?.[1].volume || 1;

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
      <td>${porteBadge(l.porte)}</td>
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

  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = toPlot.filter(l => l.micro_regiao === mr);
    if (lojas.length === 0) return;
    const radius = 20 + (lojas.length / Math.max(47,1)) * 30;

    const circle = L.circleMarker([meta.lat, meta.lng], {
      radius, fillColor: meta.cor, color:'#fff', weight:2.5, opacity:1, fillOpacity:0.18
    }).addTo(mapInstance);
    mapMarkers.push(circle);
  });

  toPlot.forEach(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const cor = l.colaboradora ? (colabColors[l.colaboradora]||meta.cor) : meta.cor;

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

  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    legEl.innerHTML = allColabs.length > 0
      ? allColabs.map(c => `<span style="display:inline-flex;align-items:center;gap:5px;background:${colabColors[c]}18;color:${colabColors[c]};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${colabColors[c]};"></span>${c}</span>`).join('')
      : Object.entries(MR_META).map(([mr,m])=>`<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};color:${m.txt};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${m.cor};"></span>${mr}</span>`).join('');
  }

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
// IMPORT SEED (data_seed.json legado)
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
// IMPORTAR CSV / XLSX — MODAL COMPLETO
// ══════════════════════════════════════════════════════════

// Mapeamento inteligente: nome da coluna no arquivo → campo no banco
const COLUMN_MAP = {
  // CNPJ
  'cnpj': 'cnpj',
  // Razão Social
  'razao social': 'razao_social', 'razão social': 'razao_social',
  'razao_social': 'razao_social', 'nome': 'razao_social', 'empresa': 'razao_social',
  // Bairro
  'bairro': 'bairro', 'distrito': 'bairro',
  // CEP
  'cep': 'cep',
  // Zona
  'zona': 'zona',
  // Micro Região
  'micro regiao': 'micro_regiao', 'micro_regiao': 'micro_regiao',
  'micro região': 'micro_regiao', 'mr': 'micro_regiao', 'regiao': 'micro_regiao',
  'região': 'micro_regiao',
  // Micro Região Nome
  'micro regiao nome': 'micro_regiao_nome', 'micro_regiao_nome': 'micro_regiao_nome',
  'nome micro regiao': 'micro_regiao_nome',
  // Porte
  'porte': 'porte', 'classificacao': 'porte', 'classificação': 'porte',
  // Contratos Geral
  'contratos geral': 'contratos_geral', 'contratos_geral': 'contratos_geral',
  'contratos': 'contratos_geral', 'qtd contratos': 'contratos_geral',
  'quantidade contratos': 'contratos_geral',
  // Volume Geral
  'volume geral': 'volume_geral', 'volume_geral': 'volume_geral',
  'volume': 'volume_geral', 'valor': 'volume_geral', 'valor total': 'volume_geral',
  // Contratos Carbank
  'contratos carbank': 'contratos_carbank', 'contratos_carbank': 'contratos_carbank',
  // Volume Carbank
  'volume carbank': 'volume_carbank', 'volume_carbank': 'volume_carbank',
  // Status
  'status': 'status',
  // Colaboradora
  'colaboradora': 'colaboradora', 'consultor': 'colaboradora',
  'consultora': 'colaboradora', 'responsavel': 'colaboradora',
  'responsável': 'colaboradora', 'vendedor': 'colaboradora',
  // Ativo
  'ativo': 'ativo', 'ativa': 'ativo', 'ativo?': 'ativo',
  // Endereço (extra — mapeia para bairro se bairro vazio)
  'endereco': 'bairro', 'endereço': 'bairro', 'logradouro': 'bairro',
};

let importPreviewData = [];
let importParsedRows = [];

function abrirImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
  resetImportModal();
}

function fecharImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  resetImportModal();
}

function resetImportModal() {
  importPreviewData = [];
  importParsedRows = [];
  document.getElementById('import-drop-zone').classList.remove('drag-over', 'hidden');
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-preview-section').classList.add('hidden');
  document.getElementById('import-progress-section').classList.add('hidden');
  document.getElementById('import-btn-confirmar').classList.add('hidden');
  document.getElementById('import-status-msg').textContent = '';
  document.getElementById('import-file-name').textContent = '';
}

// ── Drag & Drop ──
function setupImportDrop() {
  const zone = document.getElementById('import-drop-zone');

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });
  zone.addEventListener('click', () => document.getElementById('import-file-input').click());

  document.getElementById('import-file-input').addEventListener('change', e => {
    if (e.target.files[0]) processImportFile(e.target.files[0]);
  });
}

// ── Processar arquivo ──
async function processImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  document.getElementById('import-file-name').textContent = `📄 ${file.name}`;

  if (ext === 'csv') {
    const text = await readFileAsText(file);
    parseCSV(text);
  } else if (ext === 'xlsx' || ext === 'xls') {
    await parseXLSX(file);
  } else {
    showImportError('Formato não suportado. Use CSV ou XLSX.');
    return;
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Parser CSV ──
function parseCSV(text) {
  // Detectar separador (vírgula, ponto-e-vírgula ou tab)
  const firstLine = text.split('\n')[0];
  let sep = ',';
  if ((firstLine.match(/;/g)||[]).length > (firstLine.match(/,/g)||[]).length) sep = ';';
  else if ((firstLine.match(/\t/g)||[]).length > (firstLine.match(/,/g)||[]).length) sep = '\t';

  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) { showImportError('Arquivo CSV vazio ou inválido.'); return; }

  const headers = parseCsvLine(lines[0], sep).map(h => h.trim().replace(/^"|"$/g,''));
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line, sep);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  }).filter(row => Object.values(row).some(v => v));

  processRawRows(headers, rows);
}

function parseCsvLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Parser XLSX (usa SheetJS via CDN) ──
async function parseXLSX(file) {
  if (!window.XLSX) {
    showImportError('Carregando biblioteca XLSX...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }
  try {
    const buf = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(buf, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    if (raw.length < 2) { showImportError('Planilha vazia ou sem dados.'); return; }

    const headers = raw[0].map(h => String(h).trim());
    const rows = raw.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(row[i]||'').trim(); });
      return obj;
    }).filter(row => Object.values(row).some(v => v));

    processRawRows(headers, rows);
  } catch(e) {
    showImportError('Erro ao ler XLSX: ' + e.message);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Mapear colunas e gerar preview ──
function processRawRows(headers, rows) {
  // Mapear cada header para campo do banco
  const fieldMap = {}; // header original → campo banco
  const unmapped = [];

  headers.forEach(h => {
    const key = h.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove acentos para comparação
      .replace(/[^a-z0-9 _]/g, '');
    const mapped = COLUMN_MAP[key] || COLUMN_MAP[h.toLowerCase().trim()];
    if (mapped) fieldMap[h] = mapped;
    else unmapped.push(h);
  });

  // Converter rows para formato do banco
  importParsedRows = rows.map(row => {
    const obj = { ativo: true };
    Object.entries(fieldMap).forEach(([orig, field]) => {
      let val = row[orig];
      if (field === 'contratos_geral' || field === 'contratos_carbank') {
        val = parseInt(String(val).replace(/\D/g,'')) || 0;
      } else if (field === 'volume_geral' || field === 'volume_carbank') {
        val = parseFloat(String(val).replace(/[^\d,.-]/g,'').replace(',','.')) || 0;
      } else if (field === 'ativo') {
        val = !['false','0','inativo','não','nao','n'].includes(String(val).toLowerCase());
      }
      if (val !== '' && val !== undefined) obj[field] = val;
    });
    return obj;
  }).filter(r => r.cnpj); // só linhas com CNPJ

  if (importParsedRows.length === 0) {
    showImportError('Nenhuma linha válida encontrada. Verifique se a planilha possui coluna CNPJ.');
    return;
  }

  showImportPreview(headers, fieldMap, unmapped, rows);
}

// ── Exibir preview ──
function showImportPreview(headers, fieldMap, unmapped, rawRows) {
  const section = document.getElementById('import-preview-section');
  section.classList.remove('hidden');
  document.getElementById('import-drop-zone').classList.add('hidden');

  // Stats
  document.getElementById('import-stat-total').textContent  = importParsedRows.length;
  document.getElementById('import-stat-mapped').textContent = Object.keys(fieldMap).length;
  document.getElementById('import-stat-skip').textContent   = unmapped.length;

  // Colunas mapeadas
  const mapList = document.getElementById('import-col-map');
  mapList.innerHTML = Object.entries(fieldMap).map(([orig, field]) =>
    `<div class="import-col-row">
      <span class="import-col-orig">${orig}</span>
      <span class="import-col-arrow">→</span>
      <span class="import-col-dest">${field}</span>
    </div>`
  ).join('') + (unmapped.length > 0 ? unmapped.map(u =>
    `<div class="import-col-row">
      <span class="import-col-orig">${u}</span>
      <span class="import-col-arrow">→</span>
      <span class="import-col-skip">ignorado</span>
    </div>`
  ).join('') : '');

  // Preview tabela (primeiras 5 linhas)
  const preview5 = importParsedRows.slice(0, 5);
  const previewFields = ['cnpj','razao_social','bairro','zona','micro_regiao','contratos_geral','volume_geral'];
  const previewThead = document.getElementById('import-preview-thead');
  const previewTbody = document.getElementById('import-preview-tbody');

  previewThead.innerHTML = '<tr>' + previewFields.map(f=>`<th>${f}</th>`).join('') + '</tr>';
  previewTbody.innerHTML = preview5.map(r =>
    '<tr>' + previewFields.map(f=>`<td>${r[f]??''}</td>`).join('') + '</tr>'
  ).join('');

  document.getElementById('import-btn-confirmar').classList.remove('hidden');
  document.getElementById('import-status-msg').textContent = '';
}

// ── Executar importação ──
async function executarImport() {
  if (!sb) { showImportError('Supabase não configurado.'); return; }
  if (!importParsedRows.length) return;

  document.getElementById('import-btn-confirmar').classList.add('hidden');
  document.getElementById('import-preview-section').classList.add('hidden');
  document.getElementById('import-progress-section').classList.remove('hidden');

  const total = importParsedRows.length;
  const BATCH = 50;
  let done = 0;
  let erros = 0;

  for (let i = 0; i < total; i += BATCH) {
    const batch = importParsedRows.slice(i, i + BATCH);
    const { error } = await sb.from('lojas').upsert(batch, { onConflict: 'cnpj' });
    if (error) {
      erros++;
      console.error('Batch error:', error);
    }
    done = Math.min(i + BATCH, total);

    const pct = Math.round(done / total * 100);
    document.getElementById('import-progress-bar').style.width = pct + '%';
    document.getElementById('import-progress-label').textContent = `${done} / ${total} registros...`;
  }

  if (erros === 0) {
    document.getElementById('import-progress-label').textContent = `✓ ${total} registros importados com sucesso!`;
    document.getElementById('import-progress-bar').style.background = 'var(--verde)';
    showToast(`${total} lojas importadas ✓`, 'success');
  } else {
    document.getElementById('import-progress-label').textContent = `Concluído com ${erros} erros. Verifique o console.`;
  }

  setTimeout(async () => {
    fecharImportModal();
    await loadLojas();
  }, 1800);
}

function showImportError(msg) {
  document.getElementById('import-status-msg').textContent = '⚠ ' + msg;
  document.getElementById('import-status-msg').style.color = '#B91C1C';
}

// ══════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════
function porteBadge(porte) {
  if (!porte) return '<span style="color:#aaa;font-size:11px;">—</span>';
  const p = porte.trim().toUpperCase();
  let bg, color, label;
  if (p.startsWith('F'))      { bg = '#1565C0'; color = '#fff'; label = porte; }
  else if (p.startsWith('E')) { bg = '#6cd1f0'; color = '#fff'; label = porte; }
  else if (p.startsWith('D')) { bg = '#26A69A'; color = '#fff'; label = porte; }
  else if (p.startsWith('C')) { bg = '#66BB6A'; color = '#fff'; label = porte; }
  else if (p.startsWith('B')) { bg = '#FFA726'; color = '#fff'; label = porte; }
  else if (p.startsWith('A')) { bg = '#EF5350'; color = '#fff'; label = porte; }
  else                         { bg = '#E0E0E0'; color = '#555'; label = porte; }
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="${porte}">${label}</span>`;
}

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

  setupImportDrop();

  ['f-busca','f-zona','f-mr','f-colab','f-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyTableFilters);
    document.getElementById(id)?.addEventListener('change', applyTableFilters);
  });

  ['mapa-mr-filter','mapa-colab-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshMapa);
  });
});
