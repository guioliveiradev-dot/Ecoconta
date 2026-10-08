/* EcoConta — regras de negócio e cálculos (sem mexer na tela). */
const C = (function () {
  const S = () => Store.get();

  // ---------- datas e formatos ----------
  const pad = (n) => String(n).padStart(2, '0');
  const mkOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const curMK = () => mkOf(new Date());
  const shiftMK = (mk, n) => { const [y, m] = mk.split('-').map(Number); return mkOf(new Date(y, m - 1 + n, 1)); };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesNome = (mk) => MESES[Number(mk.split('-')[1]) - 1];
  const monthLabel = (mk) => mesNome(mk) + ' de ' + mk.split('-')[0];
  const isoDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayISO = () => isoDay(new Date());
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (v, d = 0) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = (v, d = 0) => num((v || 0) * 100, d) + '%';
  const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x), 0);

  // ---------- categorias do orçamento ----------
  const CATS = [
    { id: 'moradia', nome: 'Moradia', icon: '🏠', pct: 0.40 },
    { id: 'alimentacao', nome: 'Alimentação', icon: '🛒', pct: 0.24 },
    { id: 'contas', nome: 'Contas', icon: '⚡', pct: 0.14 },
    { id: 'transporte', nome: 'Transporte', icon: '🚌', pct: 0.10 },
    { id: 'saude', nome: 'Saúde', icon: '💊', pct: 0.04 },
    { id: 'reserva', nome: 'Reserva', icon: '💰', pct: 0.04 },
    { id: 'outros', nome: 'Outros', icon: '📦', pct: 0.04 }
  ];
  const catById = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

  const CONTA_PRESETS = [
    { nome: 'Aluguel', icon: '🏠', cat: 'moradia', ess: true },
    { nome: 'Condomínio', icon: '🏢', cat: 'moradia', ess: true },
    { nome: 'Água', icon: '💧', cat: 'contas', ess: true, tipo: 'agua' },
    { nome: 'Energia', icon: '⚡', cat: 'contas', ess: true, tipo: 'energia' },
    { nome: 'Gás', icon: '🔥', cat: 'contas', ess: true },
    { nome: 'Internet', icon: '📱', cat: 'contas', ess: true },
    { nome: 'Mercado', icon: '🛒', cat: 'alimentacao', ess: true },
    { nome: 'Alimentação', icon: '🍽️', cat: 'alimentacao', ess: true },
    { nome: 'Farmácia', icon: '💊', cat: 'saude', ess: true },
    { nome: 'Transporte', icon: '🚌', cat: 'transporte', ess: true },
    { nome: 'Produtos de limpeza', icon: '🧴', cat: 'alimentacao', ess: true },
    { nome: 'Cartão de crédito', icon: '💳', cat: 'outros', ess: false, fin: true },
    { nome: 'Empréstimo', icon: '🏦', cat: 'outros', ess: false, fin: true },
    { nome: 'Parcelamento', icon: '🧾', cat: 'outros', ess: false, fin: true },
    { nome: 'Outra dívida', icon: '📌', cat: 'outros', ess: false, fin: true },
    { nome: 'Outra conta', icon: '📦', cat: 'outros', ess: false }
  ];

  const APARELHO_PRESETS = [
    { nome: 'Chuveiro elétrico', watts: 5500, horas: 0.5, dias: 30, icon: '🚿' },
    { nome: 'Geladeira', watts: 150, horas: 10, dias: 30, icon: '🧊' },
    { nome: 'Televisão', watts: 100, horas: 5, dias: 30, icon: '📺' },
    { nome: 'Ar-condicionado', watts: 1000, horas: 6, dias: 30, icon: '❄️' },
    { nome: 'Ventilador', watts: 80, horas: 8, dias: 30, icon: '🌀' },
    { nome: 'Máquina de lavar', watts: 500, horas: 1, dias: 12, icon: '🧺' },
    { nome: 'Computador', watts: 150, horas: 4, dias: 30, icon: '💻' },
    { nome: 'Micro-ondas', watts: 1200, horas: 0.3, dias: 30, icon: '🍲' },
    { nome: 'Ferro de passar', watts: 1000, horas: 1, dias: 8, icon: '👔' },
    { nome: 'Lâmpada antiga (incandescente)', watts: 60, horas: 5, dias: 30, icon: '💡' },
    { nome: 'Lâmpada LED', watts: 9, horas: 5, dias: 30, icon: '💡' },
    { nome: 'Outro aparelho', watts: 100, horas: 1, dias: 30, icon: '🔌' }
  ];

  function iconAparelho(nome) {
    const n = (nome || '').toLowerCase();
    if (/chuveiro/.test(n)) return '🚿';
    if (/geladeira|freezer/.test(n)) return '🧊';
    if (/tv|televis/.test(n)) return '📺';
    if (/ar[ -]?cond|split/.test(n)) return '❄️';
    if (/ventilador/.test(n)) return '🌀';
    if (/lavar|lavadora/.test(n)) return '🧺';
    if (/computador|notebook|pc/.test(n)) return '💻';
    if (/micro/.test(n)) return '🍲';
    if (/ferro/.test(n)) return '👔';
    if (/l[aâ]mpada/.test(n)) return '💡';
    return '🔌';
  }

  // ---------- energia ----------
  function energiaCalc() {
    const tar = S().cfg.kwh;
    const itens = S().aparelhos.map((a) => ({ ...a, kwh: (a.watts * a.qtd * a.horas * a.dias) / 1000 }));
    const kwh = sum(itens, (i) => i.kwh);
    itens.forEach((i) => { i.custo = i.kwh * tar; i.pct = kwh ? i.kwh / kwh : 0; });
    itens.sort((a, b) => b.kwh - a.kwh);
    return { itens, kwh, custo: kwh * tar };
  }

  function oportEnergia() {
    const e = energiaCalc(), tar = S().cfg.kwh, A = S().agua, out = [];
    e.itens.forEach((i) => {
      const n = i.nome.toLowerCase();
      let frac = 0, icon = i.icon || iconAparelho(i.nome), titulo = i.nome, dica = '';
      if (/chuveiro/.test(n)) {
        icon = '🔌';
        if (A.banhoMin > 6) { const red = Math.min(5, A.banhoMin - 5); frac = red / A.banhoMin; dica = `Reduzir ${red} min do banho (de ${A.banhoMin} para ${A.banhoMin - red} min).`; }
        else { frac = 0.25; dica = 'Usar a posição "verão" (morna) na maior parte do ano.'; }
      } else if (/ar[ -]?cond|split/.test(n)) {
        frac = i.horas > 1 ? 1 / i.horas : 0; dica = 'Usar 1 hora a menos por dia e deixar em 23 °C.';
      } else if (/l[aâ]mpada/.test(n) && /(antiga|incandesc|fluoresc)/.test(n)) {
        frac = 0.8; titulo = 'Lâmpadas antigas'; dica = 'Trocar por lâmpadas LED (gastam cerca de 80% menos).';
      } else if (/ferro/.test(n)) {
        frac = 0.25; dica = 'Juntar a roupa e passar tudo de uma vez.';
      } else if (/lavar|lavadora/.test(n)) {
        frac = 0.2; dica = 'Usar só com a máquina cheia.';
      } else if (/geladeira|freezer/.test(n)) {
        frac = 0.1; dica = 'Conferir a borracha da porta e evitar abrir sem necessidade.';
      } else if (/tv|televis|computador|notebook/.test(n)) {
        frac = 0.1; dica = 'Desligar da tomada quando não estiver em uso.';
      }
      const saveKwh = i.kwh * frac;
      if (saveKwh * tar >= 1) out.push({ tipo: 'energia', icon, titulo, dica, rs: saveKwh * tar, kwh: saveKwh });
    });
    return out;
  }

  // ---------- água ----------
  function aguaCalc() {
    const A = S().agua, m3 = S().cfg.m3;
    const ativ = [
      { k: 'banho', nome: 'Banhos', icon: '🚿', L: A.moradores * A.banhosDia * A.banhoMin * A.vazao * 30 },
      { k: 'descarga', nome: 'Descargas', icon: '🚽', L: A.moradores * A.descargasDia * A.litrosDescarga * 30 },
      { k: 'torneira', nome: 'Torneiras (pia, dentes, louça)', icon: '🚰', L: A.moradores * A.torneiraMin * 6 * 30 },
      { k: 'roupa', nome: 'Máquina de lavar', icon: '🧺', L: A.lavagensSemana * 120 * 4.345 },
      { k: 'carro', nome: 'Lavagem de carro', icon: '🚗', L: A.carroMes * 150 },
      { k: 'limpeza', nome: 'Limpeza da casa', icon: '🧹', L: A.limpezaSemana * 40 * 4.345 },
      { k: 'vazamento', nome: 'Vazamentos', icon: '💦', L: (A.vazTorneiras * 45 + A.vazDescargas * 150) * 30 }
    ].filter((x) => x.L > 0);
    const mes = sum(ativ, (x) => x.L);
    ativ.forEach((x) => { x.pct = mes ? x.L / mes : 0; x.custo = (x.L / 1000) * m3; });
    ativ.sort((a, b) => b.L - a.L);
    return { ativ, mes, dia: mes / 30, custo: (mes / 1000) * m3 };
  }

  function oportAgua() {
    const A = S().agua, m3 = S().cfg.m3, out = [];
    if (!A.configurado) return out;
    const rs = (L) => (L / 1000) * m3;
    if (A.banhoMin > 5) {
      const red = Math.min(5, A.banhoMin - 5);
      const L = A.moradores * A.banhosDia * red * A.vazao * 30;
      out.push({ tipo: 'agua', icon: '🚿', titulo: 'Banhos longos', dica: `Tirar ${red} min de cada banho economiza ${num(L)} L por mês.`, rs: rs(L), L });
    }
    if (A.vazTorneiras + A.vazDescargas > 0) {
      const L = (A.vazTorneiras * 45 + A.vazDescargas * 150) * 30;
      out.push({ tipo: 'agua', icon: '💦', titulo: 'Vazamentos', dica: 'Consertar torneiras pingando e descarga vazando é a economia mais fácil.', rs: rs(L), L });
    }
    if (A.lavagensSemana >= 2) {
      const L = 120 * 4.345;
      out.push({ tipo: 'agua', icon: '🧺', titulo: 'Máquina de lavar com pouca roupa', dica: 'Juntar roupa e lavar uma vez a menos por semana, sempre com a máquina cheia.', rs: rs(L), L });
    }
    if (A.torneiraMin >= 5) {
      const L = A.moradores * A.torneiraMin * 6 * 30 * 0.3;
      out.push({ tipo: 'agua', icon: '🚰', titulo: 'Torneira aberta', dica: 'Fechar a torneira ao escovar os dentes e ao ensaboar a louça.', rs: rs(L), L });
    }
    if (A.carroMes > 0) {
      const L = A.carroMes * 150 * 0.6;
      out.push({ tipo: 'agua', icon: '🚗', titulo: 'Lavagem de carro', dica: 'Lavar com balde e pano em vez de mangueira.', rs: rs(L), L });
    }
    if (A.litrosDescarga >= 12) {
      const L = A.moradores * A.descargasDia * 3 * 30;
      out.push({ tipo: 'agua', icon: '🚽', titulo: 'Descarga antiga', dica: 'Regular a caixa ou trocar por caixa acoplada de 6 litros.', rs: rs(L), L });
    }
    return out.filter((o) => o.rs >= 1);
  }

  // ---------- contas e despesas ----------
  const contaTipo = (tipo) => S().contas.find((c) => c.tipo === tipo);

  function dueDate(c, mk) {
    const [y, m] = mk.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return new Date(y, m - 1, Math.min(c.dia || 1, last));
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function status(c, mk) {
    const paidAt = c.paid && c.paid[mk];
    if (paidAt) return { k: 'paga', texto: 'Paga', diff: null };
    const due = dueDate(c, mk);
    const diff = Math.round((startOfDay(due) - startOfDay(new Date())) / 864e5);
    if (mk !== curMK()) return { k: mk < curMK() ? 'atrasada' : 'aberta', texto: mk < curMK() ? 'Em aberto' : 'A pagar', diff };
    if (diff < 0) return { k: 'atrasada', texto: `Atrasada ${-diff} d`, diff };
    if (diff === 0) return { k: 'hoje', texto: 'Vence hoje', diff };
    if (diff === 1) return { k: 'breve', texto: 'Vence amanhã', diff };
    if (diff <= 3) return { k: 'breve', texto: `Vence em ${diff} dias`, diff };
    return { k: 'aberta', texto: `Vence em ${diff} dias`, diff };
  }

  function despesas(mk) {
    const contas = sum(S().contas, (c) => c.valor);
    const avulsos = sum(S().avulsos.filter((a) => a.data.slice(0, 7) === mk), (a) => a.valor);
    const porCat = {};
    CATS.forEach((c) => (porCat[c.id] = 0));
    S().contas.forEach((c) => { porCat[c.cat] = (porCat[c.cat] || 0) + c.valor; });
    S().avulsos.filter((a) => a.data.slice(0, 7) === mk).forEach((a) => { porCat[a.cat] = (porCat[a.cat] || 0) + a.valor; });
    // "Reserva" = dinheiro guardado nas metas no mês
    const dep = depositosMes(mk);
    porCat.reserva = (porCat.reserva || 0) + dep;
    return { contas, avulsos, total: contas + avulsos, porCat, depositos: dep };
  }
  function depositosMes(mk) {
    let t = 0;
    S().metas.forEach((m) => (m.dep || []).forEach((d) => { if (d.data.slice(0, 7) === mk) t += d.valor; }));
    return t;
  }

  // ---------- histórico / snapshot do mês ----------
  function energiaMes(mk) {
    const h = S().hist[mk];
    if (h && h.kwh != null) return { kwh: h.kwh, valor: h.energia, real: !!h.realE };
    return null;
  }
  function aguaMes(mk) {
    const h = S().hist[mk];
    if (h && h.aguaL != null) return { L: h.aguaL, valor: h.agua, real: !!h.realA };
    return null;
  }

  function snapshot() {
    const mk = curMK(), st = S();
    const h = st.hist[mk] || (st.hist[mk] = {});
    const e = energiaCalc(), a = aguaCalc(), ce = contaTipo('energia'), ca = contaTipo('agua');
    if (!h.realE) {
      const valor = ce && ce.valor > 0 ? ce.valor : e.custo;
      if (valor > 0) { h.kwh = e.kwh > 0 ? e.kwh : valor / st.cfg.kwh; h.energia = valor; }
      else { h.kwh = null; h.energia = null; }
    }
    if (!h.realA) {
      if (st.agua.configurado) { h.aguaL = a.mes; h.agua = ca && ca.valor > 0 ? ca.valor : a.custo; }
      else { h.aguaL = null; h.agua = null; }
    }
    h.renda = st.renda;
    h.gastos = despesas(mk).total;
  }

  const delta = (cur, prev) => (prev && prev > 0 && cur != null ? (cur - prev) / prev : null);

  // ---------- diagnóstico ----------
  function diagnostico() {
    const itens = [...oportEnergia(), ...oportAgua()].sort((a, b) => b.rs - a.rs);
    return { itens, total: sum(itens, (i) => i.rs), kwh: sum(itens, (i) => i.kwh || 0), L: sum(itens, (i) => i.L || 0) };
  }

  // ---------- alertas ----------
  function alertas() {
    const mk = curMK(), st = S(), out = [];
    // vencimentos
    st.contas.forEach((c) => {
      const s = status(c, mk);
      if (s.k === 'atrasada') out.push({ t: 'warn', icon: '⚠️', msg: `Sua conta de ${c.nome} (${brl(c.valor)}) está atrasada ${-s.diff} dia(s).`, rota: 'contas' });
      else if (s.k === 'hoje') out.push({ t: 'warn', icon: '🔔', msg: `Atenção! Sua conta de ${c.nome} de ${brl(c.valor)} vence hoje.`, rota: 'contas' });
      else if (s.k === 'breve') out.push({ t: 'info', icon: '🔔', msg: `Atenção! Sua conta de ${c.nome} de ${brl(c.valor)} ${s.texto.toLowerCase()}.`, rota: 'contas' });
    });
    // energia vs mês anterior
    const ec = energiaMes(mk), ep = energiaMes(shiftMK(mk, -1));
    const de = ec && ep ? delta(ec.kwh, ep.kwh) : null;
    if (de != null && de >= 0.1) {
      const top = energiaCalc().itens.slice(0, 2).map((i) => i.nome.toLowerCase());
      out.push({ t: 'warn', icon: '⚡', msg: `Seu consumo de energia aumentou ${pct(de)} este mês.` + (top.length ? ` O aumento pode estar relacionado ao maior uso de: ${top.join(' e ')}.` : ''), rota: 'energia' });
    }
    const ac = aguaMes(mk), ap = aguaMes(shiftMK(mk, -1));
    const da = ac && ap ? delta(ac.L, ap.L) : null;
    if (da != null && da >= 0.1) {
      out.push({ t: 'warn', icon: '💧', msg: `Seu consumo de água aumentou ${pct(da)} em relação ao mês passado. Você pode verificar se existe algum vazamento?`, rota: 'agua' });
    }
    if (st.agua.configurado && st.agua.vazTorneiras + st.agua.vazDescargas > 0) {
      out.push({ t: 'warn', icon: '💦', msg: 'Você marcou vazamentos em casa. Consertar é a economia mais rápida de água.', rota: 'agua' });
    }
    // orçamento
    const d = despesas(mk);
    if (st.renda > 0 && d.total > st.renda) {
      out.push({ t: 'warn', icon: '🆘', msg: `Seu orçamento está apertado: despesas de ${brl(d.total)} para renda de ${brl(st.renda)}.`, rota: 'mesdificil' });
    }
    CATS.forEach((c) => {
      const lim = st.orc[c.id];
      if (c.id !== 'reserva' && lim > 0 && d.porCat[c.id] > lim) {
        out.push({ t: 'info', icon: c.icon, msg: `${c.nome}: você passou do limite do mês em ${brl(d.porCat[c.id] - lim)}.`, rota: 'orcamento' });
      }
    });
    return out;
  }

  // ---------- metas ----------
  function metaInfo(m) {
    const falta = Math.max(0, m.alvo - m.guardado);
    const p = m.alvo > 0 ? Math.min(1, m.guardado / m.alvo) : 0;
    const meses = m.mensal > 0 ? Math.ceil(falta / m.mensal) : null;
    return { falta, p, meses, semanal: m.mensal / 4.345, feita: m.guardado >= m.alvo && m.alvo > 0 };
  }

  // ---------- pontos ----------
  const NIVEIS = [
    { min: 0, icon: '🌱', nome: 'Iniciante' },
    { min: 100, icon: '🌿', nome: 'Econômico' },
    { min: 300, icon: '🌳', nome: 'Consciente' },
    { min: 600, icon: '🌎', nome: 'EcoMaster' }
  ];
  const pontosTotal = () => sum(S().pontos, (p) => p.pts);
  function nivel() {
    const t = pontosTotal();
    let i = 0;
    NIVEIS.forEach((n, k) => { if (t >= n.min) i = k; });
    const atual = NIVEIS[i], prox = NIVEIS[i + 1] || null;
    return { atual, prox, total: t, falta: prox ? prox.min - t : 0, p: prox ? (t - atual.min) / (prox.min - atual.min) : 1 };
  }
  function award(key, pts, motivo) {
    if (S().pontos.some((p) => p.key === key)) return false;
    S().pontos.push({ key, pts, motivo, data: todayISO() });
    return true;
  }
  // Confere as regras e devolve os motivos de pontos novos.
  function checkPoints() {
    const st = S(), cur = curMK(), novos = [];
    const add = (k, p, m) => { if (award(k, p, m)) novos.push({ pts: p, motivo: m }); };
    Object.keys(st.hist).sort().forEach((mk) => {
      const h = st.hist[mk], pv = st.hist[shiftMK(mk, -1)];
      if (!pv) return;
      const nome = mesNome(mk);
      if (h.kwh != null && pv.kwh > 0 && h.kwh < pv.kwh && (mk !== cur || h.realE)) add('energia-' + mk, 20, `Reduziu o consumo de energia (${nome})`);
      if (h.aguaL != null && pv.aguaL > 0 && h.aguaL < pv.aguaL && (mk !== cur || h.realA)) add('agua-' + mk, 20, `Reduziu o consumo de água (${nome})`);
    });
    // contas em dia (mês atual e anteriores com contas pagas)
    const meses = new Set([cur]);
    st.contas.forEach((c) => Object.keys(c.paid || {}).forEach((m) => meses.add(m)));
    meses.forEach((mk) => {
      if (!st.contas.length) return;
      const todas = st.contas.every((c) => c.paid && c.paid[mk] && c.paid[mk] <= isoDay(dueDate(c, mk)));
      if (todas) add('contas-' + mk, 30, `Pagou todas as contas em dia (${mesNome(mk)})`);
    });
    st.metas.forEach((m) => { if (metaInfo(m).feita) add('meta-' + m.id, 30, `Cumpriu a meta "${m.nome}"`); });
    return novos;
  }

  // ---------- impacto ambiental ----------
  function impacto() {
    const st = S(), mk = curMK();
    const meses = Object.keys(st.hist).sort();
    let kwhTot = 0, lTot = 0, kwhMes = 0, lMes = 0;
    meses.forEach((m) => {
      const h = st.hist[m], p = st.hist[shiftMK(m, -1)];
      if (!p) return;
      if (h.kwh != null && p.kwh > h.kwh) { kwhTot += p.kwh - h.kwh; if (m === mk) kwhMes = p.kwh - h.kwh; }
      if (h.aguaL != null && p.aguaL > h.aguaL) { lTot += p.aguaL - h.aguaL; if (m === mk) lMes = p.aguaL - h.aguaL; }
    });
    return { kwhMes, lMes, kwhTot, lTot, pot: diagnostico() };
  }

  // ---------- relatório ----------
  function relatorio(mk) {
    const st = S(), h = st.hist[mk] || {}, p = st.hist[shiftMK(mk, -1)] || {};
    const live = mk === curMK() ? despesas(mk) : null;
    const gastos = live ? live.total : h.gastos != null ? h.gastos : null;
    const renda = mk === curMK() ? st.renda : h.renda != null ? h.renda : null;
    return {
      mk, gastos, renda,
      saldo: gastos != null && renda != null ? renda - gastos : null,
      energia: h.kwh != null ? { kwh: h.kwh, valor: h.energia, d: delta(h.energia, p.energia), real: !!h.realE } : null,
      agua: h.aguaL != null ? { L: h.aguaL, valor: h.agua, d: delta(h.agua, p.agua), real: !!h.realA } : null,
      economia: gastos != null && p.gastos != null ? p.gastos - gastos : null
    };
  }

  // ---------- dica do dia ----------
  const DICAS = [
    'Reduzir o banho em 5 minutos pode ajudar a diminuir seu consumo de água e energia.',
    'Lâmpadas LED gastam até 80% menos energia que as antigas.',
    'Lave roupa só com a máquina cheia: economiza água, energia e sabão.',
    'Feche a torneira enquanto escova os dentes: são vários litros poupados por dia.',
    'Tire da tomada aparelhos que não está usando. Muitos gastam energia mesmo em espera.',
    'Descongele a geladeira com regularidade e confira se a borracha da porta veda bem.',
    'Anote cada gasto, até os pequenos. O que a gente vê, a gente consegue controlar.',
    'Separe um valor para a reserva assim que o dinheiro entrar, antes de gastar.',
    'Torneira pingando pode desperdiçar mais de 1.000 litros por mês. Vale consertar.',
    'Antes de comprar por impulso, espere 24 horas. Muitas vezes a vontade passa.',
    'Passe o ferro em uma única vez, com bastante roupa junta.',
    'Aproveite a luz natural durante o dia e mantenha janelas e cortinas abertas.'
  ];
  const dicaDoDia = () => DICAS[Math.floor(Date.now() / 864e5) % DICAS.length];

  return {
    pad, mkOf, curMK, shiftMK, mesNome, monthLabel, isoDay, todayISO, brl, num, pct, sum,
    CATS, catById, CONTA_PRESETS, APARELHO_PRESETS, iconAparelho,
    energiaCalc, oportEnergia, aguaCalc, oportAgua, contaTipo, dueDate, status, despesas, depositosMes,
    energiaMes, aguaMes, snapshot, delta, diagnostico, alertas, metaInfo,
    NIVEIS, pontosTotal, nivel, award, checkPoints, impacto, relatorio, dicaDoDia
  };
})();
