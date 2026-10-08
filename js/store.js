/* EcoConta — armazenamento local (localStorage). Nada sai do aparelho. */
(function () {
  const KEY = 'ecoconta.v1';

  function defaults() {
    return {
      v: 1,
      nome: '',
      onboarded: false,
      cfg: { kwh: 0.95, m3: 10, notif: false },
      renda: 0,
      orc: { moradia: 0, alimentacao: 0, contas: 0, transporte: 0, saude: 0, reserva: 0, outros: 0 },
      aparelhos: [],
      agua: {
        configurado: false,
        moradores: 3, banhoMin: 10, banhosDia: 1, vazao: 8,
        lavagensSemana: 3, torneiraMin: 10, descargasDia: 5, litrosDescarga: 6,
        carroMes: 0, limpezaSemana: 2, vazTorneiras: 0, vazDescargas: 0
      },
      contas: [],
      avulsos: [],
      metas: [],
      hist: {},
      pontos: [],
      familia: { membros: [], desafio: null },
      notified: {}
    };
  }

  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function merge(d, s) {
    for (const k in s) {
      if (isObj(s[k]) && isObj(d[k])) merge(d[k], s[k]);
      else d[k] = s[k];
    }
    return d;
  }

  let S = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      S = merge(defaults(), raw ? JSON.parse(raw) : {});
    } catch (e) {
      S = defaults();
    }
    return S;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* armazenamento bloqueado */ }
  }
  function reset() {
    S = defaults();
    save();
  }
  function exportJSON() { return JSON.stringify(S, null, 2); }
  function importJSON(txt) {
    const obj = JSON.parse(txt);
    if (!isObj(obj) || obj.v !== 1) throw new Error('Arquivo inválido');
    S = merge(defaults(), obj);
    save();
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  window.Store = { get: () => S, load, save, reset, exportJSON, importJSON, uid, defaults };
})();
