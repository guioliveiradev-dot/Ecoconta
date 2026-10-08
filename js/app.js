/* EcoConta — telas e interação. */
(function () {
  'use strict';
  Store.load();

  const S = () => Store.get();
  const { brl, num, pct, sum, CATS } = C;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s) => document.querySelector(s);
  const n = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; };

  // ---------- estado de tela ----------
  let route = 'home';
  let contasSeg = 'cal';
  let contasMK = C.curMK();
  let repMK = C.curMK();
  const chat = [];
  let simCut = new Set();

  // ---------- salvar ----------
  function commit() {
    C.snapshot();
    const novos = C.checkPoints();
    Store.save();
    if (novos.length) toast('🏆 +' + sum(novos, (x) => x.pts) + ' pontos! ' + novos[0].motivo);
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------- helpers de formulário ----------
  const F = (label, name, val = '', attrs = '', hint = '') =>
    `<label class="field"><span>${label}</span><input name="${name}" value="${esc(val)}" ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const NUM = (label, name, val, attrs = '', hint = '') =>
    F(label, name, val, `type="number" inputmode="decimal" step="any" min="0" ${attrs}`, hint);
  const SEL = (label, name, opts, val, attrs = '') =>
    `<label class="field"><span>${label}</span><select name="${name}" ${attrs}>${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

  function openSheet(title, body, onSubmit, opt = {}) {
    const root = $('#sheet-root');
    root.innerHTML = `<div class="overlay" data-act="overlay">
      <form class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        ${body}
        <div class="actions">
          <button type="button" class="btn line" data-act="closeSheet">Cancelar</button>
          <button type="submit" class="btn">${esc(opt.ok || 'Salvar')}</button>
        </div>
        ${opt.onDelete ? '<button type="button" class="btn danger block" style="margin-top:10px" data-act="sheetDelete">Excluir</button>' : ''}
      </form></div>`;
    const f = root.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f));
      if (onSubmit(data, f) !== false) closeSheet();
    });
    sheetDelete = opt.onDelete || null;
    const first = f.querySelector('input:not([type=hidden]),select');
    if (first && !opt.noFocus) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }
  let sheetDelete = null;
  function closeSheet() { $('#sheet-root').innerHTML = ''; sheetDelete = null; }

  function confirmSheet(msg, ok, onYes) {
    openSheet('Tem certeza?', `<p>${esc(msg)}</p>`, () => { onYes(); }, { ok });
  }

  // ---------- navegação ----------
  const TABS = [
    ['home', '🏡', 'Início'],
    ['energia', '⚡', 'Energia'],
    ['agua', '💧', 'Água'],
    ['contas', '📅', 'Contas'],
    ['metas', '🐷', 'Metas'],
    ['mais', '☰', 'Mais']
  ];
  const TITLES = {
    home: 'EcoConta', energia: 'Energia', agua: 'Água', contas: 'Contas', metas: 'Metas de economia', mais: 'Mais',
    orcamento: 'Orçamento mensal', relatorio: 'Relatório mensal', diagnostico: 'Diagnóstico de economia',
    pontos: 'Pontos e níveis', familia: 'Modo família', assistente: 'Assistente', impacto: 'Impacto ambiental',
    mesdificil: 'Mês difícil', config: 'Configurações'
  };

  function go(r) {
    route = r;
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const isTab = TABS.some((t) => t[0] === route);
    $('#top').innerHTML = (isTab ? '' : '<button class="back" data-act="back" aria-label="Voltar">←</button>') +
      (route === 'home' ? '<img class="brand-mark" src="icons/mark.png" alt="" width="34" height="34">' : '') +
      `<h1>${TITLES[route]}</h1>` +
      (route === 'home' ? '<button class="icon-btn" data-act="go" data-r="config" aria-label="Configurações">⚙️</button>' : '');
    const views = {
      home: vHome, energia: vEnergia, agua: vAgua, contas: vContas, metas: vMetas, mais: vMais,
      orcamento: vOrcamento, relatorio: vRelatorio, diagnostico: vDiagnostico, pontos: vPontos,
      familia: vFamilia, assistente: vAssistente, impacto: vImpacto, mesdificil: vMesDificil, config: vConfig
    };
    $('#main').innerHTML = views[route]();
    const tab = isTab ? route : 'mais';
    $('#nav').innerHTML = '<div class="in">' + TABS.map(([r, e, t]) =>
      `<button data-act="go" data-r="${r}" class="${r === tab ? 'on' : ''}" ${r === tab ? 'aria-current="page"' : ''}><span class="e">${e}</span>${t}</button>`).join('') + '</div>';
    if (route === 'assistente') scrollChat();
  }

  // ---------- pedaços reutilizáveis ----------
  function deltaChip(d, bomQuandoCai = true) {
    if (d == null) return '';
    if (Math.abs(d) < 0.005) return '<div class="delta flat">= igual ao mês anterior</div>';
    const down = d < 0;
    const good = bomQuandoCai ? down : !down;
    return `<div class="delta ${good ? 'down' : 'up'}">${down ? '↓' : '↑'} ${pct(Math.abs(d))}</div>`;
  }
  const empty = (e, t, btn = '') => `<div class="empty"><span class="e">${e}</span>${t}${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
  const bar = (p, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, Math.max(0, p * 100))}%"></i></div>`;

  // ---------- INÍCIO ----------
  function vHome() {
    const st = S(), mk = C.curMK(), d = C.despesas(mk);
    const nome = st.nome ? ', ' + esc(st.nome.split(' ')[0]) : '';
    const al = C.alertas();
    const ec = C.energiaMes(mk), ep = C.energiaMes(C.shiftMK(mk, -1));
    const ac = C.aguaMes(mk), ap = C.aguaMes(C.shiftMK(mk, -1));
    const ce = C.contaTipo('energia'), ca = C.contaTipo('agua');
    const outras = d.total - (ce ? ce.valor : 0) - (ca ? ca.valor : 0);
    const saldo = st.renda - d.total;
    const novo = !st.renda && !st.contas.length && !st.aparelhos.length;
    const meta = st.metas.find((m) => !C.metaInfo(m).feita && !m.pausada) || st.metas[0];

    let h = `<p class="muted">Olá${nome}! 👋<br>Seu resumo de ${C.mesNome(mk).toLowerCase()}:</p>`;
    if (novo) {
      h += `<div class="card"><h2>🌱 Comece por aqui</h2>
        <p class="muted small">Preencha o básico e o EcoConta mostra onde você pode economizar.</p>
        <div class="stack" style="margin-top:12px">
          <button class="btn block" data-act="go" data-r="orcamento">💰 Informar a renda do mês</button>
          <button class="btn ghost block" data-act="go" data-r="contas">📅 Cadastrar minhas contas</button>
          <button class="btn ghost block" data-act="go" data-r="energia">⚡ Cadastrar meus aparelhos</button>
          <button class="btn line block" data-act="exemplo">✨ Ver com dados de exemplo</button>
        </div></div>`;
    }
    h += `<div class="card hero"><div class="muted">💰 Saldo disponível</div>
      <div class="big num">${brl(saldo)}</div>
      <div class="small muted num">Renda ${brl(st.renda)} − gastos ${brl(d.total)}</div></div>`;
    h += `<div class="grid2">
      <button class="card stat energy tile-like" data-act="go" data-r="energia" style="text-align:left;border:0">
        <div class="lbl">⚡ Energia</div><div class="val num">${ec ? brl(ec.valor) : '—'}</div>${ec && ep ? deltaChip(C.delta(ec.valor, ep.valor)) : '<div class="delta flat">sem comparação</div>'}</button>
      <button class="card stat water tile-like" data-act="go" data-r="agua" style="text-align:left;border:0">
        <div class="lbl">💧 Água</div><div class="val num">${ac ? brl(ac.valor) : '—'}</div>${ac && ap ? deltaChip(C.delta(ac.valor, ap.valor)) : '<div class="delta flat">sem comparação</div>'}</button>
    </div>`;
    h += `<div class="card stat"><div class="lbl">🏠 Outras despesas</div><div class="val num">${brl(Math.max(0, outras))}</div></div>`;
    if (st.renda > 0 && d.total > st.renda) {
      h += `<button class="alert bad" data-act="go" data-r="mesdificil"><span class="i">🚨</span><span><b>Seu orçamento está apertado este mês.</b><br>Déficit de ${brl(d.total - st.renda)}. Toque para ver o que fazer.</span></button>`;
    }
    al.slice(0, 3).forEach((a) => {
      h += `<button class="alert ${a.t === 'info' ? 'info' : ''}" data-act="go" data-r="${a.rota}"><span class="i">${a.icon}</span><span>${esc(a.msg)}</span></button>`;
    });
    if (meta) {
      const mi = C.metaInfo(meta);
      h += `<button class="card" data-act="go" data-r="metas" style="width:100%;text-align:left">
        <div class="row between"><b>🎯 ${esc(meta.nome)}</b><span class="small muted num">${brl(meta.guardado)} / ${brl(meta.alvo)}</span></div>
        <div style="margin:10px 0 6px">${bar(mi.p)}</div><div class="small muted">${pct(mi.p)} da meta${mi.meses ? ` · faltam ~${mi.meses} mês(es)` : ''}</div></button>`;
    }
    h += `<div class="card"><h2>💡 Dica do dia</h2><p>${esc(C.dicaDoDia())}</p>
      <button class="btn block" style="margin-top:12px" data-act="go" data-r="diagnostico">Ver oportunidades de economia</button></div>`;
    return h;
  }

  // ---------- ENERGIA ----------
  function vEnergia() {
    const st = S(), e = C.energiaCalc(), tar = st.cfg.kwh, ops = C.oportEnergia();
    const mk = C.curMK(), real = C.energiaMes(mk);
    let h = '';
    if (!e.itens.length) {
      h += `<div class="card">${empty('🔌', 'Cadastre os aparelhos da casa para ver quanto cada um consome e custa.', '<button class="btn" data-act="addAp">+ Adicionar aparelho</button>')}</div>`;
    } else {
      h += `<div class="card stat energy"><div class="lbl">Consumo estimado no mês</div>
        <div class="big num">${num(e.kwh, 1)} kWh</div>
        <div class="muted num">≈ ${brl(e.custo)} <span class="xs">(tarifa ${brl(tar)}/kWh)</span></div></div>`;
      h += `<div class="sec-title">Seus aparelhos</div><div class="card list" style="padding:4px 16px">`;
      e.itens.forEach((i) => {
        h += `<div class="item"><button class="hit" data-act="editAp" data-id="${i.id}" aria-label="Editar ${esc(i.nome)}">
          <span class="ico" style="background:var(--energy-soft)">${esc(i.icon || C.iconAparelho(i.nome))}</span>
          <span class="grow"><span class="t">${esc(i.nome)}${i.qtd > 1 ? ' ×' + i.qtd : ''}</span>
          <span class="s" style="display:block">${num(i.watts)} W · ${num(i.horas, 1)} h/dia · ${num(i.dias)} dias</span>
          <span style="display:block;margin-top:6px">${bar(i.pct, 'energy')}</span></span>
          <span class="right num"><b>${pct(i.pct)}</b><br><span class="s">${num(i.kwh, 1)} kWh<br>${brl(i.custo)}</span></span></button></div>`;
      });
      h += '</div>';
      h += '<button class="btn block" data-act="addAp">+ Adicionar aparelho</button>';
      const top = e.itens[0];
      if (top && top.pct >= 0.2) {
        const eco = ops.find((o) => o.titulo === top.nome);
        h += `<div class="alert info"><span class="i">📊</span><span>Seu <b>${esc(top.nome.toLowerCase())}</b> representa aproximadamente <b>${pct(top.pct)}</b> do seu consumo estimado.${eco ? ` ${esc(eco.dica)} Você poderia economizar cerca de <b>${brl(eco.rs)}</b> por mês.` : ''}</span></div>`;
      }
      if (ops.length) {
        h += `<div class="sec-title">💡 Como reduzir</div><div class="card list" style="padding:4px 16px">`;
        ops.sort((a, b) => b.rs - a.rs).forEach((o) => {
          h += `<div class="item"><span class="ico">${o.icon}</span><span class="grow"><span class="t">${esc(o.titulo)}</span><span class="s" style="display:block">${esc(o.dica)}</span></span><span class="right num"><b style="color:var(--good)">${brl(o.rs)}</b><br><span class="s">por mês</span></span></div>`;
        });
        h += '</div>';
      }
    }
    h += `<div class="sec-title">Conta real</div><div class="card"><p class="small muted">Digite os números da sua fatura para o app comparar os meses e ficar mais preciso.</p>
      ${real && real.real ? `<div class="kv"><span>Registrado em ${C.mesNome(mk)}</span><b class="num">${num(real.kwh)} kWh · ${brl(real.valor)}</b></div>` : ''}
      <button class="btn ghost block" style="margin-top:10px" data-act="regReal" data-t="energia">🧾 Registrar conta de energia</button></div>`;
    return h;
  }

  function apForm(a) {
    return `${a.id ? '' : SEL('Aparelho comum', 'preset', [['', 'Escolher da lista...'], ...C.APARELHO_PRESETS.map((p, i) => [i, p.nome])], '', 'data-change="presetAp"')}
      <div class="form-grid" style="margin-top:12px">
        <div class="full">${F('Nome', 'nome', a.nome || '', 'required maxlength="40"')}</div>
        ${NUM('Potência (W)', 'watts', a.watts ?? '', 'required min="1"', 'Está na etiqueta do aparelho')}
        ${NUM('Quantidade', 'qtd', a.qtd ?? 1, 'required min="1" step="1"')}
        ${NUM('Horas de uso por dia', 'horas', a.horas ?? '', 'required max="24"')}
        ${NUM('Dias de uso no mês', 'dias', a.dias ?? 30, 'required min="1" max="31" step="1"')}
      </div><p class="xs muted" style="margin-top:8px">Consumo mensal = potência × horas × dias ÷ 1000.</p>`;
  }
  function saveAp(data, id) {
    const o = { nome: data.nome.trim(), watts: n(data.watts), qtd: Math.max(1, n(data.qtd)), horas: Math.min(24, n(data.horas)), dias: Math.min(31, Math.max(1, n(data.dias))) };
    o.icon = C.iconAparelho(o.nome);
    if (id) Object.assign(S().aparelhos.find((a) => a.id === id), o);
    else S().aparelhos.push({ id: Store.uid(), ...o });
    commit(); render();
  }

  // ---------- ÁGUA ----------
  function vAgua() {
    const A = S().agua;
    const num_ = (label, key, attrs = '', hint = '') => NUM(label, key, A[key], `data-agua="${key}" ${attrs}`, hint);
    let h = `<div class="card"><h2>Sua casa</h2><div class="form-grid">
      ${num_('Moradores', 'moradores', 'min="1" step="1"')}
      ${num_('Banhos por pessoa/dia', 'banhosDia', 'step="0.5"')}
      ${num_('Minutos de cada banho', 'banhoMin', 'step="1"')}
      ${SEL('Força do chuveiro', 'vazao', [[6, 'Fraco (6 L/min)'], [8, 'Médio (8 L/min)'], [12, 'Forte (12 L/min)']], A.vazao, 'data-agua="vazao"')}
      ${num_('Lavagens de roupa por semana', 'lavagensSemana', 'step="1"')}
      ${num_('Torneiras: min/dia por pessoa', 'torneiraMin', 'step="1"', 'Pia, dentes, louça')}
      ${num_('Descargas por pessoa/dia', 'descargasDia', 'step="1"')}
      ${SEL('Tipo de descarga', 'litrosDescarga', [[6, 'Caixa acoplada (6 L)'], [9, 'Média (9 L)'], [12, 'Antiga (12 L)']], A.litrosDescarga, 'data-agua="litrosDescarga"')}
      ${num_('Lavagens de carro por mês', 'carroMes', 'step="1"')}
      ${num_('Limpezas da casa por semana', 'limpezaSemana', 'step="1"')}
      ${num_('Torneiras pingando', 'vazTorneiras', 'step="1"', 'Quantas?')}
      ${num_('Descargas vazando', 'vazDescargas', 'step="1"', 'Quantas?')}
    </div></div>
    <div id="agua-res">${aguaRes()}</div>`;
    return h;
  }
  function aguaRes() {
    const A = S().agua, w = C.aguaCalc(), ops = C.oportAgua(), mk = C.curMK(), real = C.aguaMes(mk);
    let h = '';
    if (!A.configurado) h += `<div class="alert info"><span class="i">👆</span><span>Ajuste os números acima para começar. Valores iniciais são só um exemplo.</span></div>`;
    h += `<div class="card stat water"><div class="lbl">Consumo estimado</div>
      <div class="big num">${num(w.dia)} L/dia</div>
      <div class="muted num">${num(w.mes)} litros/mês · ≈ ${brl(w.custo)} <span class="xs">(${brl(S().cfg.m3)} por m³)</span></div></div>`;
    h += `<div class="sec-title">Onde a água é usada</div><div class="card stack">`;
    w.ativ.forEach((a) => {
      h += `<div><div class="row between small"><span>${a.icon} ${esc(a.nome)}</span><span class="num"><b>${pct(a.pct)}</b> · ${num(a.L)} L</span></div>${bar(a.pct, a.k === 'vazamento' ? 'over' : 'water')}</div>`;
    });
    h += '</div>';
    if (ops.length) {
      h += `<div class="sec-title">💡 Como reduzir</div><div class="card list" style="padding:4px 16px">`;
      ops.sort((a, b) => b.rs - a.rs).forEach((o) => {
        h += `<div class="item"><span class="ico" style="background:var(--water-soft)">${o.icon}</span><span class="grow"><span class="t">${esc(o.titulo)}</span><span class="s" style="display:block">${esc(o.dica)}</span></span><span class="right num"><b style="color:var(--good)">${brl(o.rs)}</b><br><span class="s">por mês</span></span></div>`;
      });
      h += '</div>';
    }
    const prev = C.aguaMes(C.shiftMK(mk, -1)), cur = real;
    if (cur && prev && cur.L > 0) {
      const d = C.delta(cur.L, prev.L);
      if (d != null) h += `<div class="alert ${d > 0.1 ? '' : 'ok'}"><span class="i">${d > 0 ? '🚿' : '🌱'}</span><span>Seu consumo de água neste mês está aproximadamente <b>${pct(Math.abs(d))} ${d > 0 ? 'acima' : 'abaixo'}</b> do mês anterior.</span></div>`;
    }
    h += `<div class="sec-title">Conta real</div><div class="card"><p class="small muted">Digite os números da sua conta de água para o app comparar os meses.</p>
      ${real && real.real ? `<div class="kv"><span>Registrado em ${C.mesNome(mk)}</span><b class="num">${num(real.L)} L · ${brl(real.valor)}</b></div>` : ''}
      <button class="btn ghost block" style="margin-top:10px" data-act="regReal" data-t="agua">🧾 Registrar conta de água</button></div>`;
    return h;
  }

  function regRealSheet(tipo) {
    const mk = C.curMK();
    const meses = [0, 1, 2, 3, 4, 5].map((i) => { const m = C.shiftMK(mk, -i); return [m, C.monthLabel(m)]; });
    const isE = tipo === 'energia';
    openSheet(isE ? 'Conta de energia' : 'Conta de água',
      `<div class="stack">${SEL('Mês', 'mk', meses, mk)}
       ${isE ? NUM('Consumo (kWh)', 'q', '', 'required', 'Está na sua fatura') : NUM('Consumo (m³)', 'q', '', 'required', 'Está na sua conta. 1 m³ = 1.000 litros')}
       ${NUM('Valor pago (R$)', 'valor', '', 'required')}</div>`,
      (d) => {
        const h = S().hist[d.mk] || (S().hist[d.mk] = {});
        if (isE) { h.kwh = n(d.q); h.energia = n(d.valor); h.realE = true; }
        else { h.aguaL = n(d.q) * 1000; h.agua = n(d.valor); h.realA = true; }
        if (d.mk === C.curMK()) {
          const c = C.contaTipo(tipo);
          if (c) c.valor = n(d.valor);
        }
        // calibra a tarifa com a conta real
        if (isE && n(d.q) > 0 && n(d.valor) > 0) S().cfg.kwh = Math.round((n(d.valor) / n(d.q)) * 100) / 100;
        if (!isE && n(d.q) > 0 && n(d.valor) > 0) S().cfg.m3 = Math.round((n(d.valor) / n(d.q)) * 100) / 100;
        commit(); render();
        toast('Conta registrada. Tarifa ajustada pela sua fatura.');
      });
  }

  // ---------- CONTAS ----------
  function vContas() {
    const st = S(), mk = contasMK, cur = mk === C.curMK();
    let h = `<div class="month-nav"><button class="icon-btn" data-act="cmk" data-d="-1" aria-label="Mês anterior">‹</button><b>${C.monthLabel(mk)}</b><button class="icon-btn" data-act="cmk" data-d="1" aria-label="Próximo mês">›</button></div>
      <div class="seg" role="tablist"><button class="${contasSeg === 'cal' ? 'on' : ''}" data-act="seg" data-v="cal">📅 Calendário</button><button class="${contasSeg === 'avulso' ? 'on' : ''}" data-act="seg" data-v="avulso">🛒 Gastos avulsos</button></div>`;
    if (contasSeg === 'cal') {
      const contas = [...st.contas].sort((a, b) => C.dueDate(a, mk) - C.dueDate(b, mk));
      const total = sum(contas, (c) => c.valor), pago = sum(contas.filter((c) => c.paid && c.paid[mk]), (c) => c.valor);
      h += `<div class="card"><div class="grid2"><div class="stat"><div class="lbl">Total do mês</div><div class="val num">${brl(total)}</div></div>
        <div class="stat"><div class="lbl">Falta pagar</div><div class="val num" style="color:${total - pago > 0 ? 'var(--energy-ink)' : 'var(--good)'}">${brl(total - pago)}</div></div></div>
        ${total ? `<div style="margin-top:12px">${bar(total ? pago / total : 0)}</div>` : ''}</div>`;
      if (!contas.length) h += `<div class="card">${empty('📅', 'Cadastre suas contas e o EcoConta avisa quando estiverem perto de vencer.')}</div>`;
      else {
        h += '<div class="card list" style="padding:4px 16px">';
        contas.forEach((c) => {
          const s = C.status(c, mk), due = C.dueDate(c, mk), on = !!(c.paid && c.paid[mk]);
          h += `<div class="item"><button class="pay ${on ? 'on' : ''}" data-act="pay" data-id="${c.id}" aria-label="${on ? 'Desmarcar' : 'Marcar'} ${esc(c.nome)} como paga" aria-pressed="${on}">${on ? '✓' : ''}</button>
            <button class="hit" data-act="editConta" data-id="${c.id}"><span class="ico">${c.icon || '📦'}</span>
            <span class="grow"><span class="t">${esc(c.nome)}</span><span class="s" style="display:block">dia ${due.getDate()}/${C.pad(due.getMonth() + 1)} · ${C.catById(c.cat).nome}</span></span>
            <span class="right"><b class="num">${brl(c.valor)}</b><br><span class="badge ${s.k}">${s.texto}</span></span></button></div>`;
        });
        h += '</div>';
      }
      h += '<button class="btn block" data-act="addConta">+ Nova conta</button>';
      if (cur) h += `<p class="xs muted center">As contas se repetem todo mês. Toque no círculo para marcar como paga.</p>`;
    } else {
      const av = st.avulsos.filter((a) => a.data.slice(0, 7) === mk).sort((a, b) => b.data.localeCompare(a.data));
      h += `<div class="card stat"><div class="lbl">Gastos avulsos do mês</div><div class="val num">${brl(sum(av, (a) => a.valor))}</div><div class="small muted">Mercado, farmácia, transporte e outros gastos do dia a dia.</div></div>`;
      if (!av.length) h += `<div class="card">${empty('🛒', 'Nenhum gasto avulso neste mês.')}</div>`;
      else {
        h += '<div class="card list" style="padding:4px 16px">';
        av.forEach((a) => {
          const c = C.catById(a.cat), dt = a.data.split('-');
          h += `<div class="item"><button class="hit" data-act="editAv" data-id="${a.id}"><span class="ico">${c.icon}</span><span class="grow"><span class="t">${esc(a.desc || c.nome)}</span><span class="s" style="display:block">${dt[2]}/${dt[1]} · ${c.nome}</span></span><b class="num right">${brl(a.valor)}</b></button></div>`;
        });
        h += '</div>';
      }
      h += '<button class="btn block" data-act="addAv">+ Novo gasto</button>';
    }
    return h;
  }

  function contaForm(c) {
    const cats = CATS.map((x) => [x.id, x.icon + ' ' + x.nome]);
    return `${c.id ? '' : SEL('Tipo de conta', 'preset', [['', 'Escolher da lista...'], ...C.CONTA_PRESETS.map((p, i) => [i, p.icon + ' ' + p.nome])], '', 'data-change="presetConta"')}
      <div class="form-grid" style="margin-top:12px">
        <div class="full">${F('Nome', 'nome', c.nome || '', 'required maxlength="40"')}</div>
        ${NUM('Valor (R$)', 'valor', c.valor ?? '', 'required')}
        ${NUM('Dia do vencimento', 'dia', c.dia ?? '', 'required min="1" max="31" step="1"')}
        <div class="full">${SEL('Categoria', 'cat', cats, c.cat || 'outros')}</div>
        <div class="full"><label class="check"><input type="checkbox" name="ess" ${c.ess !== false ? 'checked' : ''}> <span>Gasto essencial (não dá para cortar)</span></label></div>
      </div><input type="hidden" name="tipo" value="${esc(c.tipo || '')}"><input type="hidden" name="icon" value="${esc(c.icon || '📦')}">`;
  }
  function saveConta(d, id) {
    const o = { nome: d.nome.trim(), valor: n(d.valor), dia: Math.min(31, Math.max(1, Math.round(n(d.dia)))), cat: d.cat, ess: !!d.ess, tipo: d.tipo || '', icon: d.icon || '📦' };
    if (id) Object.assign(S().contas.find((c) => c.id === id), o);
    else S().contas.push({ id: Store.uid(), paid: {}, ...o });
    commit(); render();
  }

  function avForm(a) {
    return `<div class="form-grid">
      <div class="full">${F('Descrição', 'desc', a.desc || '', 'maxlength="50" placeholder="Ex.: feira, remédio"')}</div>
      ${NUM('Valor (R$)', 'valor', a.valor ?? '', 'required')}
      ${F('Data', 'data', a.data || C.todayISO(), 'type="date" required')}
      <div class="full">${SEL('Categoria', 'cat', CATS.map((x) => [x.id, x.icon + ' ' + x.nome]), a.cat || 'alimentacao')}</div></div>`;
  }
  function saveAv(d, id) {
    const o = { desc: d.desc.trim(), valor: n(d.valor), data: d.data, cat: d.cat };
    if (id) Object.assign(S().avulsos.find((a) => a.id === id), o);
    else S().avulsos.push({ id: Store.uid(), ...o });
    commit(); render();
  }

  // ---------- METAS ----------
  const META_PRESETS = [['Comprar uma geladeira nova', 1500, 100], ['Criar uma reserva de emergência', 1000, 50], ['Pagar uma dívida', 800, 80], ['Comprar material escolar', 500, 50]];
  function vMetas() {
    const st = S();
    let h = '';
    if (!st.metas.length) h += `<div class="card">${empty('🐷', 'Crie uma meta e veja quanto precisa guardar por semana ou por mês.')}</div>`;
    st.metas.forEach((m) => {
      const mi = C.metaInfo(m);
      h += `<div class="card"><div class="row between"><b>🎯 ${esc(m.nome)}</b>${m.pausada ? '<span class="badge aberta">Pausada</span>' : mi.feita ? '<span class="badge paga">Concluída 🎉</span>' : ''}</div>
        <div class="row between small muted num" style="margin-top:6px"><span>${brl(m.guardado)} guardados</span><span>meta ${brl(m.alvo)}</span></div>
        <div style="margin:8px 0">${bar(mi.p)}</div>
        <p class="small">${mi.feita ? 'Meta alcançada! Parabéns!' : m.pausada ? 'Meta pausada. Quando puder, retome.' :
          m.mensal > 0 ? `💰 Guardando <b>${brl(m.mensal)}</b> por mês (≈ ${brl(mi.semanal)} por semana), você alcançará sua meta em <b>${mi.meses} ${mi.meses === 1 ? 'mês' : 'meses'}</b>.` : 'Defina quanto pode guardar por mês para ver o prazo.'}</p>
        <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="dep" data-id="${m.id}">+ Guardar</button>
        <button class="btn sm ghost" data-act="pausar" data-id="${m.id}">${m.pausada ? '▶ Retomar' : '⏸ Pausar'}</button>
        <button class="btn sm line" data-act="editMeta" data-id="${m.id}">Editar</button></div></div>`;
    });
    h += '<button class="btn block" data-act="addMeta">+ Nova meta</button>';
    return h;
  }
  function metaForm(m, novo) {
    return `${novo ? `<div class="chips" style="margin-bottom:12px">${META_PRESETS.map((p, i) => `<button type="button" class="chip" data-act="metaPreset" data-i="${i}">${esc(p[0])}</button>`).join('')}</div>` : ''}
      <div class="form-grid"><div class="full">${F('Nome da meta', 'nome', m.nome || '', 'required maxlength="50"')}</div>
      ${NUM('Valor da meta (R$)', 'alvo', m.alvo ?? '', 'required min="1"')}
      ${NUM('Guardar por mês (R$)', 'mensal', m.mensal ?? '')}
      ${NUM('Já guardado (R$)', 'guardado', m.guardado ?? 0)}</div>`;
  }

  // ---------- MAIS ----------
  function vMais() {
    const lv = C.nivel();
    const tiles = [
      ['orcamento', '💰', 'Orçamento', 'Para onde vai o dinheiro'],
      ['relatorio', '📈', 'Relatório', 'Resumo do mês'],
      ['diagnostico', '💡', 'Diagnóstico', 'Onde economizar'],
      ['assistente', '🤖', 'Assistente', 'Pergunte como economizar'],
      ['pontos', '🏆', 'Pontos', `${lv.atual.icon} ${lv.atual.nome} · ${lv.total} pts`],
      ['impacto', '🌱', 'Impacto', 'Energia e água poupadas'],
      ['familia', '👨‍👩‍👧', 'Família', 'Desafios em grupo'],
      ['mesdificil', '🆘', 'Mês difícil', 'Quando o dinheiro aperta'],
      ['config', '⚙️', 'Ajustes', 'Tarifas, backup, avisos']
    ];
    return `<div class="tiles">${tiles.map((t) => `<button class="tile" data-act="go" data-r="${t[0]}"><span class="e">${t[1]}</span><b>${t[2]}</b><span class="d">${t[3]}</span></button>`).join('')}</div>`;
  }

  // ---------- ORÇAMENTO ----------
  function vOrcamento() {
    const st = S();
    let h = `<div class="card"><h2>Quanto entra por mês?</h2>
      ${NUM('Renda familiar (R$)', 'renda', st.renda || '', 'data-renda="1"')}
      <button class="btn ghost block" style="margin-top:12px" data-act="distrib">✨ Sugerir divisão automática</button></div>
      <div class="card"><h2>Limite por categoria</h2><div class="form-grid">
      ${CATS.map((c) => NUM(c.icon + ' ' + c.nome, c.id, st.orc[c.id] || '', `data-orc="${c.id}"`)).join('')}
      </div><div id="orc-sum" class="small" style="margin-top:12px">${orcSum()}</div></div>
      <div id="orc-res">${orcRes()}</div>`;
    return h;
  }
  function orcSum() {
    const st = S(), t = sum(CATS, (c) => st.orc[c.id] || 0), r = st.renda;
    if (!t) return '<span class="muted">Defina quanto quer gastar em cada categoria.</span>';
    const diff = r - t;
    return `<span class="num">Total dividido: <b>${brl(t)}</b></span> · ` + (!r ? '' : Math.abs(diff) < 0.5 ? '<span style="color:var(--good)">✓ Fecha com a renda</span>' : diff > 0 ? `<span class="muted">sobram ${brl(diff)} para dividir</span>` : `<span style="color:var(--bad)">passa ${brl(-diff)} da renda</span>`);
  }
  function orcRes() {
    const st = S(), d = C.despesas(C.curMK());
    let h = `<div class="sec-title">Para onde o dinheiro está indo (${C.mesNome(C.curMK())})</div><div class="card stack">`;
    CATS.forEach((c) => {
      const gasto = d.porCat[c.id] || 0, lim = st.orc[c.id] || 0, p = lim ? gasto / lim : 0;
      h += `<div><div class="row between small"><span>${c.icon} ${c.nome}</span><span class="num"><b>${brl(gasto)}</b>${lim ? ' de ' + brl(lim) : ''}</span></div>${bar(lim ? p : (gasto ? 1 : 0), p > 1 && c.id !== 'reserva' ? 'over' : '')}</div>`;
    });
    h += `</div><p class="xs muted">Reserva = dinheiro guardado nas metas neste mês. As demais categorias somam suas contas e gastos avulsos.</p>`;
    return h;
  }

  // ---------- RELATÓRIO ----------
  function vRelatorio() {
    const r = C.relatorio(repMK), keys = Object.keys(S().hist).sort();
    const prevOk = keys.some((k) => k < repMK), nextOk = repMK < C.curMK();
    const dl = (d) => (d == null ? '' : Math.abs(d) < 0.005 ? '= igual ao mês anterior' : (d < 0 ? '⬇️ ' : '⬆️ ') + pct(Math.abs(d)) + ' em relação ao mês anterior');
    let h = `<div class="month-nav"><button class="icon-btn" data-act="rmk" data-d="-1" ${prevOk ? '' : 'disabled style="opacity:.35"'} aria-label="Mês anterior">‹</button><b>${C.monthLabel(repMK)}</b><button class="icon-btn" data-act="rmk" data-d="1" ${nextOk ? '' : 'disabled style="opacity:.35"'} aria-label="Próximo mês">›</button></div>`;
    h += `<div class="card"><h2>📊 Resumo de ${C.mesNome(repMK)}</h2>
      <div class="kv"><span>Gastos</span><b class="num">${r.gastos != null ? brl(r.gastos) : '—'}</b></div>
      <div class="kv"><span>Renda</span><b class="num">${r.renda != null ? brl(r.renda) : '—'}</b></div>
      <div class="kv"><span>Saldo</span><b class="num" style="color:${r.saldo != null && r.saldo < 0 ? 'var(--bad)' : 'var(--good)'}">${r.saldo != null ? brl(r.saldo) : '—'}</b></div></div>`;
    h += `<div class="card stat energy"><h2>⚡ Energia</h2>${r.energia ? `<div class="kv"><span>Consumo</span><b class="num">${num(r.energia.kwh)} kWh</b></div><div class="kv"><span>Valor</span><b class="num">${brl(r.energia.valor)}</b></div><div class="small muted">${dl(r.energia.d)}</div>${r.energia.real ? '' : '<div class="xs muted">Valores estimados. Registre a conta real na tela Energia.</div>'}` : '<p class="muted small">Sem dados de energia neste mês.</p>'}</div>`;
    h += `<div class="card stat water"><h2>💧 Água</h2>${r.agua ? `<div class="kv"><span>Consumo</span><b class="num">${num(r.agua.L)} litros</b></div><div class="kv"><span>Valor</span><b class="num">${brl(r.agua.valor)}</b></div><div class="small muted">${dl(r.agua.d)}</div>${r.agua.real ? '' : '<div class="xs muted">Valores estimados. Registre a conta real na tela Água.</div>'}` : '<p class="muted small">Sem dados de água neste mês.</p>'}</div>`;
    h += `<div class="card"><h2>🏆 Destaque do mês</h2><p>${r.economia == null ? 'Continue registrando seus gastos. No próximo mês você poderá comparar com este.' : r.economia > 0 ? `<b>Parabéns! Você economizou ${brl(r.economia)} em relação ao mês passado.</b>` : r.economia < 0 ? `Seus gastos subiram ${brl(-r.economia)} em relação ao mês passado. Veja o Diagnóstico para achar onde ajustar.` : 'Seus gastos ficaram iguais aos do mês passado.'}</p></div>`;
    h += '<button class="btn ghost block" data-act="share">📤 Compartilhar resumo</button>';
    return h;
  }
  function relatorioTexto() {
    const r = C.relatorio(repMK);
    let t = `📊 EcoConta · ${C.monthLabel(repMK)}\n`;
    if (r.gastos != null) t += `Gastos: ${brl(r.gastos)} | Renda: ${r.renda != null ? brl(r.renda) : '—'} | Saldo: ${r.saldo != null ? brl(r.saldo) : '—'}\n`;
    if (r.energia) t += `⚡ Energia: ${num(r.energia.kwh)} kWh, ${brl(r.energia.valor)}\n`;
    if (r.agua) t += `💧 Água: ${num(r.agua.L)} L, ${brl(r.agua.valor)}\n`;
    if (r.economia > 0) t += `🏆 Economizei ${brl(r.economia)} em relação ao mês passado!`;
    return t;
  }

  // ---------- DIAGNÓSTICO ----------
  function vDiagnostico() {
    const dg = C.diagnostico(), al = C.alertas();
    let h = '';
    if (al.length) {
      h += '<div class="sec-title">🚨 Alertas</div>';
      al.forEach((a) => { h += `<button class="alert ${a.t === 'info' ? 'info' : ''}" data-act="go" data-r="${a.rota}"><span class="i">${a.icon}</span><span>${esc(a.msg)}</span></button>`; });
    }
    h += '<div class="sec-title">🔎 Seu diagnóstico</div>';
    if (!dg.itens.length) {
      h += `<div class="card">${empty('🔎', 'Cadastre seus aparelhos e o uso de água para descobrir pontos de economia.', '<div class="row wrap" style="justify-content:center"><button class="btn sm" data-act="go" data-r="energia">⚡ Energia</button><button class="btn sm" data-act="go" data-r="agua">💧 Água</button></div>')}</div>`;
    } else {
      h += `<div class="card hero"><div class="muted">💰 Economia potencial</div><div class="big num">Até ${brl(dg.total)} por mês</div>
        <div class="small muted num">${dg.kwh ? '≈ ' + num(dg.kwh) + ' kWh' : ''}${dg.kwh && dg.L ? ' e ' : ''}${dg.L ? num(dg.L) + ' litros' : ''} a menos por mês</div></div>
        <div class="card list" style="padding:4px 16px"><p class="small muted" style="padding-top:10px">Possíveis pontos de economia:</p>`;
      dg.itens.forEach((o) => {
        h += `<div class="item"><span class="ico">${o.icon}</span><span class="grow"><span class="t">${esc(o.titulo)}</span><span class="s" style="display:block">${esc(o.dica)}</span></span><span class="right num"><b style="color:var(--good)">${brl(o.rs)}</b><br><span class="s">por mês</span></span></div>`;
      });
      h += `</div><p class="xs muted">São estimativas baseadas nos dados que você cadastrou. O valor real depende dos seus hábitos e das tarifas da sua cidade.</p>`;
    }
    return h;
  }

  // ---------- PONTOS ----------
  function vPontos() {
    const lv = C.nivel(), pts = [...S().pontos].reverse();
    let h = `<div class="card center"><div class="level">${lv.atual.icon}</div><div class="big">${lv.atual.nome}</div><div class="muted num">${lv.total} pontos</div>
      <div style="margin:12px 0 6px">${bar(lv.p)}</div>
      <div class="small muted">${lv.prox ? `Faltam ${lv.falta} pontos para ${lv.prox.icon} ${lv.prox.nome}` : 'Você chegou ao nível máximo! 🎉'}</div></div>
      <div class="card"><div class="chips" style="justify-content:space-between">${C.NIVEIS.map((x) => `<span class="chip ${x.nome === lv.atual.nome ? 'on' : ''}">${x.icon} ${x.nome}</span>`).join('')}</div></div>
      <div class="card"><h2>Como ganhar pontos</h2>
      <div class="kv"><span>💧 Reduziu a água</span><b>+20</b></div><div class="kv"><span>⚡ Reduziu a energia</span><b>+20</b></div>
      <div class="kv"><span>💰 Cumpriu uma meta</span><b>+30</b></div><div class="kv"><span>📅 Pagou todas as contas em dia</span><b>+30</b></div>
      <div class="kv"><span>🐷 Guardou dinheiro no mês</span><b>+20</b></div>
      <p class="xs muted" style="margin-top:8px">Redução de consumo conta quando você registra a conta real e ela é menor que a do mês anterior.</p></div>`;
    h += '<div class="sec-title">Histórico</div>';
    h += pts.length ? `<div class="card list" style="padding:4px 16px">${pts.map((p) => `<div class="item"><span class="grow"><span class="t">${esc(p.motivo)}</span><span class="s" style="display:block">${p.data.split('-').reverse().join('/')}</span></span><b style="color:var(--good)">+${p.pts}</b></div>`).join('')}</div>` : `<div class="card">${empty('🏆', 'Seus pontos aparecem aqui.')}</div>`;
    return h;
  }

  // ---------- FAMÍLIA ----------
  const EMOJIS = ['👨', '👩', '👧', '👦', '👴', '👵', '🧑'];
  function vFamilia() {
    const f = S().familia, mk = C.curMK(), ec = C.energiaMes(mk);
    let h = `<div class="alert info"><span class="i">ℹ️</span><span>Nesta versão, os dados ficam só neste celular. Use para organizar a família em torno dos desafios.</span></div>
      <div class="card"><h2>👨‍👩‍👧 ${esc(S().nome ? 'Família ' + S().nome.split(' ').slice(-1)[0] : 'Minha família')}</h2>`;
    h += f.membros.length ? `<div class="list">${f.membros.map((m) => `<div class="item"><span class="ico">${m.emoji}</span><span class="grow t">${esc(m.nome)}</span><button class="icon-btn" data-act="delMembro" data-id="${m.id}" aria-label="Remover ${esc(m.nome)}">✕</button></div>`).join('')}</div>` : '<p class="muted small">Adicione quem ajuda a controlar a casa.</p>';
    h += '<button class="btn ghost block" style="margin-top:12px" data-act="addMembro">+ Adicionar pessoa</button></div>';
    h += '<div class="sec-title">🏆 Desafio da família</div>';
    const d = f.desafio;
    if (!d) {
      h += `<div class="card">${empty('🏆', 'Crie um desafio, como reduzir a energia em 10% neste mês.', '<button class="btn" data-act="addDesafio">Criar desafio</button>')}</div>`;
    } else {
      const red = ec && d.base > 0 ? (d.base - ec.kwh) / d.base : 0, p = Math.max(0, red / d.meta);
      h += `<div class="card"><b>${esc(d.nome)}</b>
        <div class="small muted" style="margin:4px 0 10px">Ponto de partida: ${num(d.base)} kWh/mês · meta: −${pct(d.meta)}</div>${bar(Math.min(1, p))}
        <p class="small" style="margin-top:8px">${!ec ? 'Registre ou cadastre seus aparelhos para acompanhar.' : red >= d.meta ? `🎉 Desafio cumprido! Redução de ${pct(red, 1)}.` : red > 0 ? `Já reduziram ${pct(red, 1)}. Falta pouco!` : 'Ainda sem redução. Bora juntos!'}</p>
        <div class="row" style="margin-top:10px"><button class="btn sm line" data-act="addDesafio">Novo desafio</button><button class="btn sm danger" data-act="delDesafio">Encerrar</button></div></div>`;
    }
    return h;
  }

  // ---------- ASSISTENTE ----------
  const SUGESTOES = ['Como posso economizar R$ 100 esse mês?', 'Como reduzir a conta de energia?', 'Como economizar água?', 'Estou endividado, o que faço?'];
  function vAssistente() {
    return `<div class="alert info"><span class="i">🤖</span><span>Eu analiso os dados que você cadastrou e sugiro cortes. Não uso internet nem envio nada para fora.</span></div>
      <div class="chips">${SUGESTOES.map((s) => `<button class="chip" data-act="ask" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="chat" id="chat">${chatHTML()}</div>
      <form class="chatbar" id="chatform"><input name="q" placeholder="Pergunte algo..." autocomplete="off" aria-label="Sua pergunta"><button class="btn" type="submit" aria-label="Enviar">➤</button></form>`;
  }
  const chatHTML = () => chat.length ? chat.map((m) => `<div class="msg ${m.r}">${m.html}</div>`).join('') : '<div class="empty muted">Faça uma pergunta ou escolha uma sugestão acima.</div>';
  function scrollChat() { const f = $('#chatform'); if (f && chat.length) f.scrollIntoView({ block: 'end' }); }

  function respond(q) {
    const t = q.toLowerCase(), st = S(), m = q.match(/(\d+(?:[.,]\d+)?)/), alvo = m ? n(m[1]) : null;
    const lista = (arr) => '<ul>' + arr.map((x) => `<li>${x}</li>`).join('') + '</ul>';
    const mk = C.curMK(), d = C.despesas(mk);
    if (/vazament/.test(t)) {
      return 'Para achar vazamento: feche todas as torneiras, não use água e olhe o hidrômetro. Se ele continuar girando, há vazamento. Na descarga, pingue corante na caixa: se a cor aparecer na bacia sem acionar, está vazando. Marque na tela Água quantos você encontrou para eu calcular o desperdício.';
    }
    if (/(d[ií]vida|endivid|cart[aã]o|empr[eé]stimo|juros|devendo)/.test(t)) {
      const dividas = st.contas.filter((c) => /cart|emprést|empres|parcel|dívida|divida/i.test(c.nome));
      return 'Sem julgamento: acontece com muita gente. Um caminho possível:' + lista([
        'Liste tudo o que deve e o valor dos juros de cada dívida.',
        'Priorize as de juros mais altos (cartão rotativo, cheque especial).',
        'Evite pagar só o mínimo do cartão: os juros crescem rápido.',
        'Procure o credor para renegociar prazo e juros antes de atrasar.',
        'Garanta primeiro o essencial: moradia, comida, água, luz.'
      ]) + (dividas.length ? `Você cadastrou ${dividas.length} conta(s) assim, somando ${brl(sum(dividas, (x) => x.valor))} por mês.` : 'Cadastre suas dívidas em Contas para eu acompanhar.');
    }
    if (/(meta|guardar|reserva|poupar)/.test(t)) {
      const ativa = st.metas.find((x) => !C.metaInfo(x).feita);
      return 'Guardar funciona melhor quando é automático: separe o valor logo que o dinheiro entrar, antes de gastar. ' + (ativa ? `Sua meta "${esc(ativa.nome)}" está em ${pct(C.metaInfo(ativa).p)}.` : 'Crie uma meta na aba Metas para eu calcular o prazo.');
    }
    if (/(difícil|dificil|apertad|déficit|deficit|falta dinheiro|n[aã]o d[aá])/.test(t)) {
      return st.renda > 0 && d.total > st.renda
        ? `Suas despesas previstas (${brl(d.total)}) passam da renda (${brl(st.renda)}) em ${brl(d.total - st.renda)}. Abra a tela <b>Mês difícil</b> para ver o que é essencial e o que pode esperar.`
        : 'Pelos dados cadastrados, suas despesas cabem na renda. Se algo mudar, a tela Mês difícil ajuda a decidir.';
    }
    const opE = C.oportEnergia(), opA = C.oportAgua();
    if (/(energia|luz|kwh|chuveiro)/.test(t) && !alvo) {
      return opE.length ? 'Pelos seus aparelhos:' + lista(opE.sort((a, b) => b.rs - a.rs).map((o) => `${esc(o.titulo)}: ${esc(o.dica)} → <b>${brl(o.rs)}/mês</b>`)) : 'Cadastre seus aparelhos na tela Energia para eu apontar onde dá para reduzir.';
    }
    if (/([aá]gua|litro|banho)/.test(t) && !alvo) {
      return opA.length ? 'Pelo uso de água cadastrado:' + lista(opA.sort((a, b) => b.rs - a.rs).map((o) => `${esc(o.titulo)}: ${esc(o.dica)} → <b>${brl(o.rs)}/mês</b>`)) : 'Preencha a tela Água para eu calcular onde dá para economizar.';
    }
    // plano para atingir um valor
    const meta = alvo && alvo > 0 ? alvo : 100;
    const opts = [...opE, ...opA];
    const avul = sum(st.avulsos.filter((a) => a.data.slice(0, 7) === mk), (a) => a.valor);
    if (avul >= 50) opts.push({ titulo: 'Reduzir compras por impulso', dica: 'cortar cerca de 10% dos gastos avulsos', rs: avul * 0.1 });
    opts.sort((a, b) => b.rs - a.rs);
    if (!opts.length) return 'Ainda não tenho dados para sugerir cortes. Cadastre seus aparelhos (Energia), o uso de água (Água) e seus gastos avulsos (Contas) e pergunte de novo.';
    const pick = []; let tot = 0;
    for (const o of opts) { if (tot >= meta) break; pick.push(o); tot += o.rs; }
    let r = `Para economizar ${brl(meta)}, você pode tentar:` + lista(pick.map((o) => `${esc(o.titulo)}: ${esc(o.dica)} → <b>${brl(o.rs)}</b>`));
    r += `<b>Economia potencial: ${brl(tot)}/mês.</b>`;
    if (tot < meta) r += `<br>Só com o que você cadastrou chego a ${brl(tot)}. Faltam ${brl(meta - tot)}: veja os limites na tela Orçamento.`;
    return r;
  }
  function ask(q) {
    q = q.trim();
    if (!q) return;
    chat.push({ r: 'user', html: esc(q) });
    chat.push({ r: 'bot', html: respond(q) });
    if (route !== 'assistente') go('assistente');
    else { $('#chat').innerHTML = chatHTML(); scrollChat(); }
  }

  // ---------- IMPACTO ----------
  function vImpacto() {
    const i = C.impacto();
    return `<div class="card"><h2>Este mês</h2>
      <div class="kv"><span>⚡ Energia economizada</span><b class="num">${num(i.kwhMes, 1)} kWh</b></div>
      <div class="kv"><span>💧 Água economizada</span><b class="num">${num(i.lMes)} litros</b></div>
      <p class="xs muted" style="margin-top:8px">Comparado com o mês anterior. Precisa de dois meses de dados.</p></div>
      <div class="card"><h2>Total desde que começou</h2>
      <div class="kv"><span>⚡ Energia</span><b class="num">${num(i.kwhTot, 1)} kWh</b></div>
      <div class="kv"><span>💧 Água</span><b class="num">${num(i.lTot)} litros</b></div></div>
      <div class="card"><h2>🌳 Seu potencial</h2><p class="small">${i.pot.itens.length ? `Seguindo as dicas do Diagnóstico, você pode poupar até <b>${num(i.pot.kwh)} kWh</b> e <b>${num(i.pot.L)} litros</b> por mês, além de ${brl(i.pot.total)} no bolso.` : 'Cadastre seus aparelhos e o uso de água para ver o potencial.'}</p>
      <p class="small muted" style="margin-top:8px">Cada kWh e cada litro que você deixa de gastar é menos pressão sobre os rios e a rede de energia. 🌎</p></div>`;
  }

  // ---------- MÊS DIFÍCIL ----------
  function vMesDificil() {
    const st = S(), mk = C.curMK(), d = C.despesas(mk), def = d.total - st.renda;
    if (!st.renda) return `<div class="card">${empty('💰', 'Informe sua renda para eu comparar com as despesas.', '<button class="btn" data-act="go" data-r="orcamento">Informar renda</button>')}</div>`;
    const ess = st.contas.filter((c) => c.ess), esp = st.contas.filter((c) => !c.ess).sort((a, b) => b.valor - a.valor);
    const corte = sum(esp.filter((c) => simCut.has(c.id)), (c) => c.valor);
    const novoDef = def - corte;
    let h = def > 0
      ? `<div class="card" style="background:var(--bad-soft);border-color:transparent"><h2>🚨 Seu orçamento está apertado este mês</h2>
         <div class="kv"><span>Renda</span><b class="num">${brl(st.renda)}</b></div><div class="kv"><span>Despesas previstas</span><b class="num">${brl(d.total)}</b></div>
         <div class="kv"><span>Déficit</span><b class="num" style="color:var(--bad)">-${brl(def)}</b></div>
         <p class="small muted" style="margin-top:8px">Aqui não tem julgamento: a ideia é ajudar você a decidir com calma.</p></div>`
      : `<div class="card" style="background:var(--brand-soft);border-color:transparent"><h2>✅ Suas contas cabem na renda</h2><p class="small">Sobram ${brl(-def)} no mês. Se o aperto vier, volte aqui.</p></div>`;
    h += `<div class="card"><h2>🧱 Gastos essenciais</h2><p class="small muted">Moradia, comida, água, luz e o que não dá para cortar.</p><div class="kv"><span>${ess.length} conta(s)</span><b class="num">${brl(sum(ess, (c) => c.valor))}</b></div></div>`;
    h += `<div class="card"><h2>⏳ Gastos que podem esperar</h2><p class="small muted">Marque o que dá para adiar, renegociar ou cortar e veja o efeito.</p>`;
    h += esp.length ? esp.map((c) => `<label class="check" style="justify-content:space-between"><span class="row"><input type="checkbox" data-sim="${c.id}" ${simCut.has(c.id) ? 'checked' : ''}> ${c.icon || ''} ${esc(c.nome)}</span><b class="num">${brl(c.valor)}</b></label>`).join('') : '<p class="small muted" style="margin-top:8px">Todas as suas contas estão marcadas como essenciais. Você pode mudar isso editando cada conta.</p>';
    if (esp.length) h += `<hr class="sep"><div class="kv"><span>Novo ${novoDef > 0 ? 'déficit' : 'saldo'}</span><b class="num" style="color:${novoDef > 0 ? 'var(--bad)' : 'var(--good)'}">${brl(Math.abs(novoDef))}</b></div>`;
    h += '</div>';
    const prox = st.contas.filter((c) => { const s = C.status(c, mk); return s.k !== 'paga' && s.diff != null && s.diff <= 7; }).sort((a, b) => C.dueDate(a, mk) - C.dueDate(b, mk));
    h += `<div class="card"><h2>📅 Contas perto do vencimento</h2>` + (prox.length ? prox.map((c) => `<div class="kv"><span>${c.icon || ''} ${esc(c.nome)} <span class="badge ${C.status(c, mk).k}">${C.status(c, mk).texto}</span></span><b class="num">${brl(c.valor)}</b></div>`).join('') : '<p class="small muted">Nenhuma nos próximos 7 dias.</p>') + '</div>';
    const dg = C.diagnostico();
    h += `<div class="card"><h2>✂️ Possíveis cortes</h2>
      ${dg.itens.length ? `<p class="small">O Diagnóstico aponta até <b>${brl(dg.total)}</b> de economia em água e energia.</p><button class="btn ghost sm" data-act="go" data-r="diagnostico" style="margin-top:8px">Ver diagnóstico</button>` : '<p class="small muted">Cadastre aparelhos e uso de água para ver cortes possíveis.</p>'}
      ${d.avulsos > 0 ? `<p class="small" style="margin-top:8px">Você já registrou ${brl(d.avulsos)} em gastos avulsos este mês.</p>` : ''}</div>`;
    const mp = st.metas.filter((m) => !C.metaInfo(m).feita && m.mensal > 0);
    h += `<div class="card"><h2>🐷 Metas que podem pausar</h2>` + (mp.length ? mp.map((m) => `<div class="item"><span class="grow"><span class="t">${esc(m.nome)}</span><span class="s" style="display:block">${m.pausada ? 'Pausada' : 'Guardando ' + brl(m.mensal) + '/mês'}</span></span><button class="btn sm ${m.pausada ? 'ghost' : 'line'}" data-act="pausar" data-id="${m.id}">${m.pausada ? 'Retomar' : 'Pausar'}</button></div>`).join('') : '<p class="small muted">Nenhuma meta com valor mensal.</p>') + '</div>';
    return h;
  }

  // ---------- AJUSTES ----------
  function vConfig() {
    const st = S();
    const notifOk = 'Notification' in window;
    return `<div class="card"><h2>Seu perfil</h2><div class="stack">${F('Seu nome', 'nome', st.nome, 'data-cfg="nome" maxlength="40"')}</div></div>
      <div class="card"><h2>Tarifas</h2><div class="form-grid">
      ${NUM('Energia (R$ por kWh)', 'kwh', st.cfg.kwh, 'data-cfg="kwh"', 'Valor da conta ÷ kWh')}
      ${NUM('Água+esgoto (R$ por m³)', 'm3', st.cfg.m3, 'data-cfg="m3"', 'Valor da conta ÷ m³')}</div>
      <p class="xs muted" style="margin-top:8px">Registrar a conta real nas telas Energia e Água ajusta isso sozinho.</p></div>
      <div class="card"><h2>🔔 Avisos de vencimento</h2>
      <p class="small muted">Ao abrir o app, avisa das contas que vencem hoje, amanhã ou atrasaram. ${notifOk ? '' : 'Seu navegador não permite avisos.'}</p>
      <p class="xs muted" style="margin-top:6px">Importante: sem servidor, o aviso só aparece quando o app é aberto. Os alertas dentro do app funcionam sempre.</p>
      ${notifOk ? `<button class="btn ${st.cfg.notif ? 'line' : 'ghost'} block" style="margin-top:10px" data-act="notif">${st.cfg.notif ? 'Desativar avisos' : 'Ativar avisos'}</button>` : ''}</div>
      <div class="card"><h2>💾 Seus dados</h2><p class="small muted">Tudo fica salvo só neste aparelho. Faça backup de vez em quando, principalmente antes de trocar de celular ou limpar o navegador.</p>
      <div class="stack" style="margin-top:10px"><button class="btn ghost block" data-act="export">⬇️ Exportar backup</button>
      <button class="btn ghost block" data-act="import">⬆️ Restaurar backup</button>
      <input type="file" id="impfile" accept="application/json,.json" hidden>
      <button class="btn danger block" data-act="wipe">🗑️ Apagar todos os dados</button></div></div>
      <div class="card"><h2>📲 Instalar no celular</h2><p class="small muted"><b>Android (Chrome):</b> menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".<br><b>iPhone (Safari):</b> botão Compartilhar → "Adicionar à Tela de Início".</p></div>
      <p class="xs muted center">EcoConta · as estimativas são aproximações para ajudar na decisão.</p>`;
  }

  // ---------- exemplo ----------
  function carregarExemplo() {
    const st = S();
    st.nome = st.nome || 'Silva';
    st.renda = 2500;
    CATS.forEach((c) => (st.orc[c.id] = Math.round(2500 * c.pct)));
    st.aparelhos = [
      ['Chuveiro elétrico', 5500, 1, 0.5, 30], ['Geladeira', 150, 1, 10, 30], ['Televisão', 100, 1, 5, 30],
      ['Ventilador', 80, 2, 8, 30], ['Máquina de lavar', 500, 1, 1, 12], ['Ferro de passar', 1000, 1, 1, 8],
      ['Lâmpada antiga (incandescente)', 60, 5, 5, 30]
    ].map(([nome, watts, qtd, horas, dias]) => ({ id: Store.uid(), nome, watts, qtd, horas, dias, icon: C.iconAparelho(nome) }));
    Object.assign(st.agua, { configurado: true, moradores: 4, banhoMin: 15, banhosDia: 1, lavagensSemana: 3, torneiraMin: 10, descargasDia: 5, litrosDescarga: 9, carroMes: 0, limpezaSemana: 2, vazTorneiras: 1, vazDescargas: 0 });
    const P = (nome) => C.CONTA_PRESETS.find((p) => p.nome === nome);
    st.contas = [['Aluguel', 900, 5], ['Água', 85, 10], ['Energia', 180, 15], ['Internet', 100, 20], ['Mercado', 600, 8], ['Transporte', 250, 1], ['Cartão de crédito', 250, 12]].map(([nome, valor, dia]) => {
      const p = P(nome);
      const c = { id: Store.uid(), nome, valor, dia, cat: p.cat, ess: p.ess, tipo: p.tipo || '', icon: p.icon, paid: {} };
      const due = C.dueDate(c, C.curMK());
      if (C.isoDay(due) < C.todayISO()) c.paid[C.curMK()] = C.isoDay(due); // no exemplo, o que já venceu aparece como pago
      return c;
    });
    st.metas = [{ id: Store.uid(), nome: 'Reserva de emergência', alvo: 1000, guardado: 350, mensal: 50, dep: [], pausada: false }];
    st.avulsos = [{ id: Store.uid(), desc: 'Farmácia', valor: 45, data: C.todayISO(), cat: 'saude' }];
    st.onboarded = true;
    commit(); render();
    toast('Dados de exemplo carregados. Você pode apagar em Ajustes.');
  }

  // ---------- vencimentos: aviso do sistema ----------
  function checkDue() {
    const st = S();
    if (!st.cfg.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    const mk = C.curMK(), hoje = C.todayISO();
    st.contas.forEach((c) => {
      const s = C.status(c, mk), key = c.id + mk;
      if (['atrasada', 'hoje'].includes(s.k) || (s.k === 'breve' && s.diff === 1)) {
        if (st.notified[key] === hoje) return;
        st.notified[key] = hoje;
        const body = `${c.nome}: ${brl(c.valor)} · ${s.texto.toLowerCase()}`;
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((r) => r.showNotification('🔔 EcoConta', { body, icon: 'icons/icon-192.png', tag: key })).catch(() => {});
        } else { try { new Notification('🔔 EcoConta', { body }); } catch (e) { /* ignorar */ } }
      }
    });
    Store.save();
  }

  // ---------- AÇÕES (cliques) ----------
  const findBy = (arr, id) => arr.find((x) => x.id === id);
  const ACT = {
    go: (el) => go(el.dataset.r),
    back: () => go('mais'),
    overlay: (el, e) => { if (e.target === el) closeSheet(); },
    closeSheet,
    sheetDelete: () => { if (sheetDelete) { const f = sheetDelete; closeSheet(); f(); } },
    exemplo: carregarExemplo,

    // energia
    addAp: () => openSheet('Novo aparelho', apForm({}), (d) => saveAp(d)),
    editAp: (el) => {
      const a = findBy(S().aparelhos, el.dataset.id);
      openSheet('Editar aparelho', apForm(a), (d) => saveAp(d, a.id), { onDelete: () => { S().aparelhos = S().aparelhos.filter((x) => x.id !== a.id); commit(); render(); } });
    },
    regReal: (el) => regRealSheet(el.dataset.t),

    // contas
    cmk: (el) => { contasMK = C.shiftMK(contasMK, Number(el.dataset.d)); render(); },
    seg: (el) => { contasSeg = el.dataset.v; render(); },
    pay: (el) => {
      const c = findBy(S().contas, el.dataset.id);
      c.paid = c.paid || {};
      if (c.paid[contasMK]) delete c.paid[contasMK]; else c.paid[contasMK] = C.todayISO();
      commit(); render();
    },
    addConta: () => openSheet('Nova conta', contaForm({}), (d) => saveConta(d)),
    editConta: (el) => {
      const c = findBy(S().contas, el.dataset.id);
      openSheet('Editar conta', contaForm(c), (d) => saveConta(d, c.id), { onDelete: () => { S().contas = S().contas.filter((x) => x.id !== c.id); commit(); render(); } });
    },
    addAv: () => openSheet('Novo gasto avulso', avForm({}), (d) => saveAv(d)),
    editAv: (el) => {
      const a = findBy(S().avulsos, el.dataset.id);
      openSheet('Editar gasto', avForm(a), (d) => saveAv(d, a.id), { onDelete: () => { S().avulsos = S().avulsos.filter((x) => x.id !== a.id); commit(); render(); } });
    },

    // metas
    addMeta: () => openSheet('Nova meta', metaForm({}, true), (d) => {
      S().metas.push({ id: Store.uid(), nome: d.nome.trim(), alvo: n(d.alvo), mensal: n(d.mensal), guardado: n(d.guardado), dep: [], pausada: false });
      commit(); render();
    }),
    metaPreset: (el) => {
      const p = META_PRESETS[Number(el.dataset.i)], f = el.closest('form');
      f.nome.value = p[0]; f.alvo.value = p[1]; f.mensal.value = p[2];
    },
    editMeta: (el) => {
      const m = findBy(S().metas, el.dataset.id);
      openSheet('Editar meta', metaForm(m), (d) => { Object.assign(m, { nome: d.nome.trim(), alvo: n(d.alvo), mensal: n(d.mensal), guardado: n(d.guardado) }); commit(); render(); },
        { onDelete: () => { S().metas = S().metas.filter((x) => x.id !== m.id); commit(); render(); } });
    },
    dep: (el) => {
      const m = findBy(S().metas, el.dataset.id);
      openSheet('Guardar dinheiro', `<div class="stack"><p class="muted small">${esc(m.nome)}</p>${NUM('Quanto você guardou? (R$)', 'valor', m.mensal || '', 'required min="0.01"')}${F('Data', 'data', C.todayISO(), 'type="date" required')}</div>`, (d) => {
        const v = n(d.valor);
        if (v <= 0) return false;
        m.dep = m.dep || [];
        m.dep.push({ data: d.data, valor: v });
        m.guardado += v;
        if (C.award('dep-' + d.data.slice(0, 7), 20, `Guardou dinheiro (${C.mesNome(d.data.slice(0, 7))})`)) toast('🏆 +20 pontos por guardar dinheiro!');
        commit(); render();
      }, { ok: 'Guardar' });
    },
    pausar: (el) => { const m = findBy(S().metas, el.dataset.id); m.pausada = !m.pausada; commit(); render(); },

    // orçamento
    distrib: () => {
      const st = S();
      if (!st.renda) { toast('Informe a renda primeiro.'); return; }
      CATS.forEach((c) => (st.orc[c.id] = Math.round(st.renda * c.pct)));
      commit(); render();
      toast('Divisão sugerida aplicada. Ajuste como preferir.');
    },

    // relatório
    rmk: (el) => { repMK = C.shiftMK(repMK, Number(el.dataset.d)); render(); },
    share: async () => {
      const t = relatorioTexto();
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast('Resumo copiado.'); } } catch (e) { /* cancelado */ }
    },

    // família
    addMembro: () => openSheet('Adicionar pessoa', `<div class="stack">${F('Nome', 'nome', '', 'required maxlength="30"')}${SEL('Ícone', 'emoji', EMOJIS.map((e) => [e, e]), '👩')}</div>`, (d) => { S().familia.membros.push({ id: Store.uid(), nome: d.nome.trim(), emoji: d.emoji }); commit(); render(); }),
    delMembro: (el) => { S().familia.membros = S().familia.membros.filter((m) => m.id !== el.dataset.id); commit(); render(); },
    addDesafio: () => {
      const ec = C.energiaMes(C.curMK());
      if (!ec) { toast('Cadastre seus aparelhos ou registre a conta de energia primeiro.'); return; }
      openSheet('Desafio da família', `<div class="stack">${SEL('Reduzir o consumo de energia em', 'meta', [[0.05, '5%'], [0.1, '10%'], [0.15, '15%'], [0.2, '20%']], 0.1)}<p class="small muted">Ponto de partida: ${num(ec.kwh)} kWh por mês.</p></div>`, (d) => {
        S().familia.desafio = { nome: `Reduzir a energia em ${pct(n(d.meta))} neste mês`, meta: n(d.meta), base: ec.kwh, mk: C.curMK() };
        commit(); render();
      });
    },
    delDesafio: () => { S().familia.desafio = null; commit(); render(); },

    // assistente
    ask: (el) => ask(el.dataset.q),

    // ajustes
    notif: async () => {
      const st = S();
      if (st.cfg.notif) { st.cfg.notif = false; commit(); render(); return; }
      try {
        const p = await Notification.requestPermission();
        if (p === 'granted') { st.cfg.notif = true; commit(); render(); checkDue(); toast('Avisos ativados.'); }
        else toast('Permissão negada. Ative nas configurações do navegador.');
      } catch (e) { toast('Não foi possível ativar os avisos.'); }
    },
    export: () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ecoconta-backup-' + C.todayISO() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    import: () => $('#impfile').click(),
    wipe: () => confirmSheet('Isso apaga contas, aparelhos, metas e pontos deste aparelho. Não dá para desfazer.', 'Apagar tudo', () => { Store.reset(); simCut = new Set(); toast('Dados apagados.'); go('home'); })
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, e);
  });

  // mudança em selects de preset
  document.addEventListener('change', (e) => {
    const t = e.target, f = t.form;
    if (t.dataset.change === 'presetAp' && t.value !== '') {
      const p = C.APARELHO_PRESETS[Number(t.value)];
      f.nome.value = p.nome; f.watts.value = p.watts; f.horas.value = p.horas; f.dias.value = p.dias;
    }
    if (t.dataset.change === 'presetConta' && t.value !== '') {
      const p = C.CONTA_PRESETS[Number(t.value)];
      f.nome.value = p.nome; f.cat.value = p.cat; f.ess.checked = !!p.ess; f.tipo.value = p.tipo || ''; f.icon.value = p.icon;
    }
    if (t.dataset.sim) {
      if (t.checked) simCut.add(t.dataset.sim); else simCut.delete(t.dataset.sim);
      render();
    }
    if (t.id === 'impfile' && t.files[0]) {
      const rd = new FileReader();
      rd.onload = () => {
        try { Store.importJSON(String(rd.result)); commit(); toast('Backup restaurado.'); go('home'); }
        catch (err) { toast('Arquivo de backup inválido.'); }
      };
      rd.readAsText(t.files[0]);
    }
  });

  // campos que salvam enquanto digita (sem redesenhar a tela inteira)
  document.addEventListener('input', (e) => {
    const t = e.target, st = S();
    if (t.dataset.agua) {
      st.agua[t.dataset.agua] = n(t.value);
      st.agua.configurado = true;
      commit();
      $('#agua-res').innerHTML = aguaRes();
    } else if (t.dataset.orc) {
      st.orc[t.dataset.orc] = n(t.value);
      Store.save();
      $('#orc-sum').innerHTML = orcSum(); $('#orc-res').innerHTML = orcRes();
    } else if (t.dataset.renda) {
      st.renda = n(t.value);
      commit();
      $('#orc-sum').innerHTML = orcSum();
    } else if (t.dataset.cfg) {
      const k = t.dataset.cfg;
      if (k === 'nome') st.nome = t.value;
      else st.cfg[k] = n(t.value) || st.cfg[k];
      commit();
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'chatform') {
      e.preventDefault();
      const i = e.target.q;
      const q = i.value;
      i.value = '';
      ask(q);
      const ni = $('#chatform input');
      if (ni) ni.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });


  // ---------- início ----------
  function boasVindas() {
    openSheet('Bem-vindo ao EcoConta', `<img src="icons/logo.png" alt="EcoConta" style="display:block;margin:-8px auto 8px;width:150px;height:auto;border-radius:12px"><p class="muted small" style="margin-bottom:12px">Vou te ajudar a entender e reduzir os gastos de água, energia e do orçamento da casa. Seus dados ficam só neste celular.</p>
      <div class="stack">${F('Como posso te chamar?', 'nome', '', 'maxlength="40" autocomplete="given-name"')}${NUM('Renda familiar por mês (R$)', 'renda', '', '')}
      <button type="button" class="btn line block" data-act="exemploBoas">✨ Prefiro ver com dados de exemplo</button></div>`,
      (d) => { const st = S(); st.nome = d.nome.trim(); st.renda = n(d.renda); st.onboarded = true; commit(); render(); }, { ok: 'Começar', noFocus: false });
  }
  ACT.exemploBoas = () => { closeSheet(); carregarExemplo(); };

  C.snapshot();
  Store.save();
  render();
  if (!S().onboarded) boasVindas();
  checkDue();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  window.__eco = { go, ask, commit }; // útil para testes
})();
