/* =====================================================================
   TRAMITÂNIA — motor do jogo (Story JavaScript do SugarCube 2.37)
   Todas as regras vivem aqui como funções puras sobre o estado V
   (State.variables). As passagens só chamam setup.do("acao", ...).
   ===================================================================== */
(function () {
"use strict";
var S = (typeof setup !== "undefined") ? setup : (globalThis.setup = {});

/* ---------- Constantes de tempo ---------- */
var H = 60, DAY = 1440;
var DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
var UTEIS = [0, 1, 2, 3, 4];
var TODOS = [0, 1, 2, 3, 4, 5, 6];

/* ---------- Locais ---------- */
// tipo: balcao | pessoa | site | casa | lazer | inicio
S.PLACES = {
  mala:          { n: "Mala de viagem", tipo: "inicio" },
  pensao:        { n: "Pensão Estrela", tipo: "pessoa", npc: "Dona Fátima", dias: TODOS, abre: 0, fecha: 24 * H, casa: true, wifi: true },
  casa:          { n: "A tua casa", tipo: "casa", dias: TODOS, abre: 0, fecha: 24 * H, casa: true, wifi: true },
  cafe:          { n: "Café do Bairro", tipo: "pessoa", npc: "Sr. Joaquim e D. Rosa", dias: TODOS, abre: 7 * H, fecha: 22 * H, wifi: true },
  jardim:        { n: "Jardim da Estrela", tipo: "lazer", dias: TODOS, abre: 7 * H, fecha: 21 * H },
  financas:      { n: "Repartição de Finanças", tipo: "balcao", npc: "Sr. Arnaldo", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  banco:         { n: "Banco", tipo: "balcao", npc: "a gestora de conta", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  junta:         { n: "Junta de Freguesia", tipo: "balcao", npc: "a funcionária da Junta", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  seg_social:    { n: "Segurança Social", tipo: "balcao", npc: "o técnico de atendimento", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  centro_saude:  { n: "Centro de Saúde", tipo: "balcao", npc: "a administrativa", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  migracao:      { n: "Agência de Migração", tipo: "balcao", npc: "a Dra. Celeste Vaz", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  conservatoria: { n: "Conservatória do Registo Civil", tipo: "balcao", npc: "o conservador", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  notario:       { n: "Notário e Tradutor", tipo: "balcao", npc: "a tradutora certificada", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  consulado:     { n: "Consulado do teu país", tipo: "balcao", npc: "o cônsul-adjunto", dias: UTEIS, abre: 9 * H, fecha: 16 * H },
  escola:        { n: "Escola de Línguas", tipo: "balcao", npc: "a secretaria da escola", dias: UTEIS, abre: 9 * H, fecha: 20 * H },
  loja_foto:     { n: "Loja de Fotografia", tipo: "balcao", npc: "o fotógrafo", dias: [0, 1, 2, 3, 4, 5], abre: 9 * H, fecha: 19 * H, semFila: true },
  senhorio:      { n: "Casa da D. Amélia (senhoria)", tipo: "pessoa", npc: "D. Amélia", dias: TODOS, abre: 10 * H, fecha: 20 * H },
  empregador:    { n: "Padaria do Sr. Bento", tipo: "pessoa", npc: "Sr. Bento", dias: [0, 1, 2, 3, 4, 5], abre: 7 * H, fecha: 19 * H },
  portal_fin:    { n: "Portal das Finanças", tipo: "site" },
  portal_cid:    { n: "Portal do Cidadão", tipo: "site" },
  portal_marc:   { n: "Portal de Marcações", tipo: "site" },
  portal_exame:  { n: "Portal de Exames de Língua", tipo: "site" }
};

/* ---------- Documentos ----------
   req: lista de grupos; cada grupo exige UM dos membros.
   fee €, val = validade em dias, wait = dias de espera,
   hidden = alternativa que nenhum balcão menciona,
   consumeBy = documentos que o gastam ao ser usado, uses = número de usos,
   cond = condição especial, absurd = documento absurdo.          */
S.DOCS = {
  passaporte:      { n: "Passaporte", at: "mala", f: 0, req: [] },
  cert_nasc:       { n: "Certidão de Nascimento (original)", at: "mala", f: 0, req: [] },
  visto:           { n: "Visto de Entrada", at: "mala", f: 0, req: [] },

  fotos:           { n: "Fotografias tipo passe", at: "loja_foto", f: 1, req: [], fee: 8, uses: 6 },
  alojamento:      { n: "Declaração de Alojamento Provisório", at: "pensao", f: 1, req: [["passaporte"]], val: 10, hidden: true },
  nif:             { n: "Número de Identificação Fiscal (NIF)", at: "financas", f: 1, req: [["passaporte"], ["visto"]] },
  iban:            { n: "Comprovativo de Conta Bancária (IBAN)", at: "banco", f: 1, req: [["passaporte"], ["nif"], ["atestado", "alojamento"]] },
  contrato_arr:    { n: "Contrato de Arrendamento", at: "senhorio", f: 1, req: [["nif"], ["iban"], ["contrato_trab", "promessa"]], fee: 240 },
  cartao_cafe:     { n: "Cartão de Cliente do Café (10 carimbos)", at: "cafe", f: 1, req: [], cond: "carimbos", absurd: true },
  testemunhas:     { n: "Declaração de Duas Testemunhas", at: "cafe", f: 1, req: [["cartao_cafe"], ["contrato_arr"]] },
  atestado:        { n: "Atestado de Residência", at: "junta", f: 1, req: [["passaporte"], ["contrato_arr"], ["testemunhas"]], fee: 5, val: 10 },
  morada_fiscal:   { n: "Comprovativo de Alteração de Morada Fiscal", at: "financas", f: 1, req: [["nif"], ["atestado"]] },
  senha_fin:       { n: "Senha do Portal das Finanças", at: "portal_fin", f: 1, req: [["morada_fiscal"]], wait: 2, carta: true },
  promessa:        { n: "Promessa de Contrato de Trabalho", at: "empregador", f: 1, req: [["passaporte"], ["nif"]], val: 14, hidden: true },
  niss:            { n: "Número de Segurança Social (NISS)", at: "seg_social", f: 1, req: [["passaporte"], ["nif"], ["contrato_trab", "promessa"]] },
  contrato_trab:   { n: "Contrato de Trabalho", at: "empregador", f: 1, req: [["niss"], ["iban"]] },
  utente:          { n: "Número de Utente de Saúde", at: "centro_saude", f: 1, req: [["passaporte"], ["atestado"], ["niss"]] },
  cartao_unico:    { n: "Cartão Único", at: "junta", f: 1, req: [["nif"], ["niss"], ["atestado"], ["fotos"]], fee: 15 },

  recibos:         { n: "Recibos de Vencimento (3 semanas)", at: "empregador", f: 2, req: [["contrato_trab"]], cond: "recibos" },
  atestado_medico: { n: "Atestado Médico", at: "centro_saude", f: 2, req: [["utente"]], fee: 25, val: 7 },
  cor_cabelo:      { n: "Declaração de Cor Natural do Cabelo", at: "centro_saude", f: 2, req: [["fotos"], ["utente"]], fee: 10, absurd: true },
  seguro:          { n: "Apólice de Seguro de Saúde", at: "banco", f: 2, req: [["iban"], ["atestado_medico"]], fee: 45 },
  decl_fin:        { n: "Declaração de Situação Tributária Regularizada", at: "portal_fin", f: 2, req: [["senha_fin"]], val: 5 },
  reg_crim_orig:   { n: "Registo Criminal do País de Origem", at: "consulado", f: 2, req: [["passaporte"], ["cert_nasc"]], fee: 20, wait: 3, val: 10 },
  marcacao:        { n: "Comprovativo de Marcação", at: "portal_marc", f: 2, req: [["passaporte"], ["nif"]], val: 5, consumeBy: ["autorizacao", "residencia_legal"] },
  taxa_ar:         { n: "Comprovativo de Pagamento da Taxa", at: "banco", f: 2, req: [["iban"], ["marcacao"]], fee: 160, val: 7, consumeBy: ["autorizacao"] },
  autorizacao:     { n: "Autorização de Residência", at: "migracao", f: 2,
                     req: [["passaporte"], ["visto"], ["fotos"], ["taxa_ar"], ["atestado"], ["contrato_trab"], ["recibos"], ["niss"], ["seguro"], ["decl_fin"], ["reg_crim_orig"], ["cor_cabelo"], ["marcacao"]] },

  cmd:             { n: "Chave Móvel Digital", at: "portal_cid", f: 3, req: [["autorizacao"], ["nif"]] },
  reg_crim_local:  { n: "Registo Criminal Local", at: "portal_cid", f: 3, req: [["cmd"]], fee: 5, val: 7 },
  cert_apost:      { n: "Certidão de Nascimento Apostilada", at: "consulado", f: 3, req: [["cert_nasc"], ["passaporte"]], fee: 40, wait: 5, val: 15 },
  cert_trad:       { n: "Certidão de Nascimento Traduzida e Certificada", at: "notario", f: 3, req: [["cert_apost"]], fee: 60, wait: 2 },
  reg_crim_trad:   { n: "Registo Criminal de Origem Traduzido", at: "notario", f: 3, req: [["reg_crim_orig"]], fee: 45, wait: 2 },
  inscricao_exame: { n: "Inscrição no Exame de Língua", at: "portal_exame", f: 3, req: [["passaporte"], ["iban"], ["fotos"]], fee: 70 },
  exame:           { n: "Certificado de Língua (nível A2)", at: "escola", f: 3, req: [["inscricao_exame"], ["passaporte"]], cond: "exame" },
  residencia_legal:{ n: "Certidão de Residência Legal", at: "migracao", f: 3, req: [["autorizacao"], ["decl_fin"], ["marcacao"]], fee: 15 },
  sanidade:        { n: "Declaração de Sanidade Burocrática", at: "centro_saude", f: 3, req: [["utente"], ["atestado_medico"]], absurd: true },
  requerimento:    { n: "Requerimento de Naturalização", at: "conservatoria", f: 3,
                     req: [["passaporte"], ["fotos"], ["cert_trad"], ["reg_crim_trad"], ["reg_crim_local"], ["exame"], ["residencia_legal"], ["decl_fin"], ["sanidade"]], fee: 250 },
  cidadania:       { n: "Certidão de Cidadania", at: "conservatoria", f: 3, req: [["requerimento"]], wait: 5, final: true }
};

/* ---------- Equilíbrio (afinar aqui) ---------- */
S.CFG = {
  visto: 45, prazoFase3: 40,
  dinheiro: 600, stress: 10,
  viagem: 30, viagemStress: 3,
  filaMin: 30, filaMax: 120, filaStressHora: 6,
  formStress: 3, recusaStress: 10, azarStress: 12, ganhoStress: -5,
  pensaoNoite: 20, renda: 120, remessa: 60, salario: 300,
  biscateGanho: 35, biscateStress: 8,
  acordadoHoras: 18, acordadoStressHora: 5,
  humorBase: 10, humorPorStress: 0.2, lingua: [20, 12, 6, 0], siteFalha: 10, tetoFalha: 45,
  dormir: -35, dormirMal: -18, dormirLimite: 70, dormirRua: -5, respirar: -6, passear: -12, ligar: -10, cafe: -5, consulta: -25,
  cafePreco: 1.2, aulaPreco: 15
};
var C = S.CFG;

S.rng = Math.random;
function rand(a, b) { return a + Math.floor(S.rng() * (b - a + 1)); }

/* ---------- Estado inicial ---------- */
S.initState = function (V) {
  V.player = null;
  V.t = 8 * H;                 // dia 1, segunda, 08:00
  V.dayBase = 0;               // primeiro dia da fase atual (para o relógio)
  V.wokeAt = V.t;
  V.stress = C.stress;
  V.money = C.dinheiro;
  V.phase = 1;
  V.deadline = V.t + C.visto * DAY;
  V.here = "pensao";
  V.home = "pensao";
  V.inv = {};
  V.pending = {};
  V.known = {};
  V.rev = {};                  // rev[doc][req] = true : requisito revelado
  V.hasNotebook = false;
  V.lang = 0;
  V.carimbos = 0;
  V.recibos = 0;
  V.lastBreath = -999;
  V.lastCall = -1;
  V.lastConsulta = -99999;
  V.lastBiscate = -1;
  V.flags = {};
  V.log = [];
  V.res = null;
  V.ticket = 0;
  V.stats = { filaMin: 0, recusas: 0, azar: 0, maxStress: V.stress, pausas: 0, expirados: 0, stressSoma: 0, amostras: 0, formularios: 0, acoes: 0 };
  ["passaporte", "cert_nasc", "visto"].forEach(function (id) { S.give(V, id, true); });
  V.inv.visto.exp = V.deadline;
  S.know(V, "autorizacao");
  return V;
};

/* ---------- Tempo ---------- */
S.day = function (t) { return Math.floor(t / DAY); };
S.weekday = function (t) { return S.day(t) % 7; };
S.minuteOfDay = function (t) { return t % DAY; };
S.clock = function (t) {
  var m = S.minuteOfDay(t), h = Math.floor(m / H), mm = m % H;
  return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
};
S.dayLabel = function (V, t) {
  t = (t === undefined) ? V.t : t;
  return "Dia " + (S.day(t) - V.dayBase + 1) + " · " + DIAS[S.weekday(t)];
};
S.daysLeft = function (V) { return Math.max(0, Math.ceil((V.deadline - V.t) / DAY)); };
S.dateOf = function (V, t) { return S.dayLabel(V, t) + ", " + S.clock(t); };

function note(V, type, text) { V.log.push({ type: type, text: text }); }

S.addStress = function (V, d) {
  V.stress = Math.max(0, Math.min(100, Math.round((V.stress + d) * 10) / 10));
  if (V.stress > V.stats.maxStress) V.stats.maxStress = V.stress;
};

/* Avança o relógio, aplica eventos diários, cansaço, expirações e cartas. */
S.advance = function (V, min, stressPerHour) {
  var t0 = V.t, t1 = t0 + min;
  // eventos de cada dia novo (à meia-noite)
  for (var d = S.day(t0) + 1; d <= S.day(t1); d++) S.dailyEvents(V, d);
  // cansaço: mais de 18 h acordado
  var lim = C.acordadoHoras * H;
  var over = Math.max(0, t1 - V.wokeAt - lim) - Math.max(0, t0 - V.wokeAt - lim);
  if (over > 0 && !V.sleeping) S.addStress(V, C.acordadoStressHora * over / H);
  if (stressPerHour) S.addStress(V, stressPerHour * min / H);
  V.t = t1;
  // expirações
  Object.keys(V.inv).forEach(function (id) {
    var it = V.inv[id];
    if (it.exp !== null && it.exp > t0 && it.exp <= t1 && id !== "visto" && !(id === "autorizacao" && V.phase === 3)) {
      note(V, "mau", "O teu documento «" + S.DOCS[id].n + "» expirou.");
      V.stats.expirados++;
    }
  });
  // cartas e documentos prontos
  Object.keys(V.pending).forEach(function (id) {
    var p = V.pending[id];
    if (p.ready > t0 && p.ready <= t1) {
      if (S.DOCS[id].carta) {
        delete V.pending[id];
        S.give(V, id);
        note(V, "bom", "Chegou uma carta: «" + S.DOCS[id].n + "». Está na tua pasta.");
      } else {
        note(V, "info", "«" + S.DOCS[id].n + "» já está pronto para levantar: " + S.PLACES[S.DOCS[id].at].n + ".");
      }
    }
  });
  V.stats.stressSoma += V.stress; V.stats.amostras++; V.stats.acoes++;
};

S.dailyEvents = function (V, d) {
  var wd = d % 7;
  if (wd === 0) {
    if (V.phase < 3) { V.money += C.remessa; note(V, "bom", "Segunda-feira: a tua família enviou " + C.remessa + " €."); }
    if (V.home === "casa") {
      if (V.money >= C.renda) { V.money -= C.renda; note(V, "info", "Pagaste a renda da semana: " + C.renda + " €."); }
      else { S.addStress(V, 15); note(V, "mau", "Não tiveste dinheiro para a renda. A D. Amélia deixou um bilhete seco debaixo da porta."); }
    }
  }
  if (wd === 4 && S.hasValid(V, "contrato_trab")) {
    V.money += C.salario; V.recibos++;
    note(V, "bom", "Sexta-feira: recebeste o salário (" + C.salario + " €) e mais um recibo de vencimento (" + Math.min(V.recibos, 3) + "/3).");
  }
};

/* ---------- Inventário e conhecimento ---------- */
S.know = function (V, id) {
  if (!V.known[id]) { V.known[id] = true; return true; }
  return false;
};
S.reveal = function (V, doc, req) {
  V.rev[doc] = V.rev[doc] || {};
  V.rev[doc][req] = true;
  S.know(V, req);
};
S.hasValid = function (V, id) {
  var it = V.inv[id];
  return !!it && (it.exp === null || it.exp > V.t) && (it.uses === null || it.uses > 0);
};
S.give = function (V, id, silent) {
  var d = S.DOCS[id];
  V.inv[id] = { got: V.t, exp: d.val ? V.t + d.val * DAY : null, uses: d.uses || null };
  S.know(V, id);
  if (id === "contrato_arr") { V.home = "casa"; if (!silent) note(V, "bom", "Tens casa! A partir de agora vives na tua casa e pagas " + C.renda + " € de renda à segunda-feira."); }
  if (id === "contrato_trab" && !silent) note(V, "bom", "Contrato assinado. O salário cai à sexta-feira.");
};

S.isOpen = function (V, id, t) {
  var p = S.PLACES[id]; t = (t === undefined) ? V.t : t;
  if (!p.dias) return true;
  var m = S.minuteOfDay(t);
  return p.dias.indexOf(S.weekday(t)) >= 0 && m >= p.abre && m < p.fecha;
};
/* Minutos até o local abrir hoje (null se hoje já não abre). */
S.opensLater = function (V, id) {
  var p = S.PLACES[id];
  if (!p.dias || p.dias.indexOf(S.weekday(V.t)) < 0) return null;
  var m = S.minuteOfDay(V.t);
  return m < p.abre ? p.abre - m : null;
};
S.waitOpen = function (V) {
  var w = S.opensLater(V, V.here);
  if (w) S.advance(V, w, 2);
};
S.hoursLabel = function (id) {
  var p = S.PLACES[id];
  if (!p.dias) return "sempre disponível";
  if (p.abre === 0 && p.fecha === 24 * H) return "aberto sempre";
  var dias = p.dias.length === 7 ? "todos os dias" : p.dias.length === 5 ? "dias úteis" : "segunda a sábado";
  return dias + ", " + S.clock(p.abre) + "–" + S.clock(p.fecha);
};
S.docsAt = function (V, place, onlyKnown) {
  return Object.keys(S.DOCS).filter(function (id) {
    var d = S.DOCS[id];
    return d.at === place && (!onlyKnown || V.known[id]);
  });
};
S.hasInternet = function (V) { return !!S.PLACES[V.here].wifi && (V.here !== "casa" || V.home === "casa"); };

/* ---------- Ações de deslocação e pausa ---------- */
S.travel = function (V, id) {
  if (V.here === id) return;
  V.here = id;
  S.addStress(V, C.viagemStress);
  S.advance(V, C.viagem);
};

S.canBreathe = function (V) { return V.t - V.lastBreath >= H; };
S.breathe = function (V) {
  if (!S.canBreathe(V)) return false;
  V.lastBreath = V.t; V.stats.pausas++;
  S.addStress(V, C.respirar);
  S.advance(V, 15);
  return true;
};
S.walk = function (V) { V.stats.pausas++; S.addStress(V, C.passear); S.advance(V, 90); };
S.canCall = function (V) { return V.lastCall !== S.day(V.t); };
S.call = function (V) {
  if (!S.canCall(V)) return false;
  V.lastCall = S.day(V.t); V.stats.pausas++;
  S.addStress(V, C.ligar); S.advance(V, 45);
  return true;
};
S.coffee = function (V) {
  if (V.money < C.cafePreco) return false;
  V.money = Math.round((V.money - C.cafePreco) * 100) / 100;
  V.carimbos++; V.stats.pausas++;
  S.addStress(V, C.cafe); S.advance(V, 30);
  return true;
};
S.canConsult = function (V) { return S.hasValid(V, "utente") && V.t - V.lastConsulta >= 7 * DAY; };
S.consult = function (V) {
  if (!S.canConsult(V)) return false;
  V.lastConsulta = V.t; V.stats.pausas++;
  S.addStress(V, C.consulta); S.advance(V, 60);
  return true;
};
S.lesson = function (V) {
  if (V.lang >= 3 || V.money < C.aulaPreco) return false;
  V.money -= C.aulaPreco; V.lang++;
  S.addStress(V, 3); S.advance(V, 120);
  return true;
};
S.canBiscate = function (V) {
  var m = S.minuteOfDay(V.t);
  return !S.hasValid(V, "contrato_trab") && V.lastBiscate !== S.day(V.t) && S.weekday(V.t) < 6 && m >= 7 * H && m <= 15 * H;
};
S.biscate = function (V) {
  if (!S.canBiscate(V)) return false;
  V.lastBiscate = S.day(V.t);
  V.money += C.biscateGanho;
  S.addStress(V, C.biscateStress); S.advance(V, 240);
  return true;
};
S.canSleep = function (V) {
  var m = S.minuteOfDay(V.t);
  return S.PLACES[V.here].casa && (V.here === V.home || V.here === "pensao" && V.home === "pensao") && (m >= 20 * H || m < 6 * H || V.stress >= 80);
};
/* Dorme até às 08:00 seguintes. Na pensão paga a noite; sem dinheiro, dorme mal. */
S.sleep = function (V) {
  var res = { pago: 0, mal: false };
  if (V.home === "pensao") {
    if (V.money >= C.pensaoNoite) { V.money -= C.pensaoNoite; res.pago = C.pensaoNoite; }
    else res.mal = true;
  }
  var m = S.minuteOfDay(V.t);
  var target = (m < 8 * H ? S.day(V.t) : S.day(V.t) + 1) * DAY + 8 * H;
  V.sleeping = true;
  S.advance(V, target - V.t);
  V.sleeping = false;
  V.wokeAt = V.t;
  var antes = V.stress;
  res.agitado = !res.mal && antes >= C.dormirLimite;
  S.addStress(V, res.mal ? C.dormirRua : res.agitado ? C.dormirMal : C.dormir);
  V.stats.pausas++;
  return res;
};

/* ---------- Balcões ---------- */
S.takeTicket = function (V) {
  var p = S.PLACES[V.here];
  if (!S.isOpen(V, V.here)) return { kind: "fechado" };
  V.ticket = rand(20, 99);
  var min = p.semFila ? 5 : Math.round(rand(C.filaMin, C.filaMax) / 5) * 5;
  V.queueMin = min;
  return { kind: "fila", min: min };
};
/* Espera na fila. Se a espera passar a hora de fecho, perde-se a vez. */
S.waitQueue = function (V) {
  var min = V.queueMin || 30;
  V.stats.filaMin += min;
  S.advance(V, min, C.filaStressHora);
  var p = S.PLACES[V.here];
  if (S.minuteOfDay(V.t) >= p.fecha) { S.addStress(V, 5); return { kind: "fechou" }; }
  return { kind: "chamado" };
};

S.failChance = function (V, place) {
  var p = S.PLACES[place];
  if (p.tipo === "site") return C.siteFalha;
  if (p.tipo !== "balcao" || p.semFila) return 0;
  return Math.min(C.tetoFalha, C.humorBase + V.stress * C.humorPorStress + C.lingua[V.lang]);
};

/* Que requisito falta? Devolve null se estão todos cumpridos. */
/* Um requisito "em andamento" (à espera de levantar, ou recibos a acumular)
   é saltado: o funcionário diz o próximo que falta. */
S.inProgress = function (V, r) {
  return !!V.pending[r] || (r === "recibos" && S.hasValid(V, "contrato_trab"));
};
S.firstMissing = function (V, id) {
  var d = S.DOCS[id], adiado = null;
  for (var i = 0; i < d.req.length; i++) {
    var g = d.req[i];
    if (g.some(function (r) { return S.hasValid(V, r); })) continue;
    var visible = g.filter(function (r) { return !S.DOCS[r].hidden; });
    var pick = (visible.length ? visible : g)[0];
    var miss = { doc: pick, expirado: !!V.inv[pick] && !V.pending[pick] };
    if (g.some(function (r) { return S.inProgress(V, r); })) { adiado = adiado || miss; continue; }
    return miss;
  }
  return adiado;
};

S.needsForm = function (id) {
  var t = S.PLACES[S.DOCS[id].at].tipo;
  return t === "balcao" || t === "site";
};

/* Pedido de um documento. Devolve um resultado {kind, ...} para a passagem "Resposta". */
S.request = function (V, id) {
  var d = S.DOCS[id], place = S.PLACES[d.at];
  var r = { doc: id };
  V.ticket = 0;
  if (S.hasValid(V, id)) return (V.res = Object.assign(r, { kind: "tem" }));
  if (V.pending[id]) {
    if (V.pending[id].ready <= V.t) { delete V.pending[id]; S.give(V, id); S.addStress(V, C.ganhoStress); return (V.res = Object.assign(r, { kind: "levantou" })); }
    return (V.res = Object.assign(r, { kind: "espera", ready: V.pending[id].ready }));
  }
  var p = S.failChance(V, d.at);
  if (p > 0 && S.rng() * 100 < p) {
    S.addStress(V, C.azarStress); V.stats.azar++;
    var kind = place.tipo === "site" ? "manutencao" : (S.rng() * (C.humorBase + V.stress * C.humorPorStress + C.lingua[V.lang]) < C.lingua[V.lang] ? "lingua" : "humor");
    return (V.res = Object.assign(r, { kind: kind }));
  }
  if (d.f === 3 && V.phase < 3) { S.addStress(V, 4); return (V.res = Object.assign(r, { kind: "cedo" })); }
  var m = S.firstMissing(V, id);
  if (m) {
    S.reveal(V, id, m.doc);
    S.addStress(V, C.recusaStress); V.stats.recusas++;
    if (id === "iban" && m.doc === "atestado") V.flags.presoBanco = true;
    if ((id === "niss" || id === "contrato_arr") && m.doc === "contrato_trab") V.flags.presoNiss = true;
    return (V.res = Object.assign(r, { kind: "falta", falta: m.doc, expirado: m.expirado }));
  }
  if (d.cond === "carimbos" && V.carimbos < 10) { S.addStress(V, 2); return (V.res = Object.assign(r, { kind: "carimbos" })); }
  if (d.cond === "recibos" && V.recibos < 3) { S.addStress(V, 4); return (V.res = Object.assign(r, { kind: "recibos" })); }
  if ((d.fee || 0) > V.money) { S.addStress(V, 6); V.stats.recusas++; return (V.res = Object.assign(r, { kind: "dinheiro" })); }
  if (d.cond === "exame") return (V.res = Object.assign(r, { kind: "exame" }));
  if (S.needsForm(id)) return (V.res = Object.assign(r, { kind: "formulario" }));
  return S.finalize(V, id);
};

S.norm = function (s) { return String(s === undefined || s === null ? "" : s).trim().toLowerCase().replace(/\s+/g, " "); };
S.FIELDS = [
  { k: "nome", label: "Nome completo" },
  { k: "idade", label: "Idade" },
  { k: "altura", label: "Altura (cm)" },
  { k: "civil", label: "Estado civil" }
];
S.ESTADOS = ["Solteiro(a)", "Casado(a)", "Unido(a) de facto", "Divorciado(a)", "Viúvo(a)"];

/* Entrega o formulário. Compara com os dados do início do jogo. */
S.submitForm = function (V, id, form) {
  V.stats.formularios++;
  var auto = S.hasValid(V, "cartao_unico");
  if (!auto) {
    S.addStress(V, C.formStress);
    for (var i = 0; i < S.FIELDS.length; i++) {
      var k = S.FIELDS[i].k;
      if (S.norm(form[k]) !== S.norm(V.player[k])) {
        S.addStress(V, C.recusaStress); V.stats.recusas++;
        return (V.res = { kind: "dados", doc: id, campo: S.FIELDS[i].label });
      }
    }
  }
  return S.finalize(V, id);
};

/* Paga, gasta consumíveis e entrega (ou põe em espera). */
S.finalize = function (V, id) {
  var d = S.DOCS[id];
  V.money -= (d.fee || 0);
  d.req.forEach(function (g) {
    var used = g.filter(function (r) { return S.hasValid(V, r); })[0];
    if (!used) return;
    var u = S.DOCS[used];
    if (u.consumeBy && u.consumeBy.indexOf(id) >= 0) delete V.inv[used];
    else if (u.uses) V.inv[used].uses--;
  });
  S.addStress(V, C.ganhoStress);
  if (d.wait) {
    V.pending[id] = { ready: (S.day(V.t) + d.wait) * DAY + 9 * H };
    S.know(V, id);
    return (V.res = { kind: d.carta ? "carta" : "pedido", doc: id, ready: V.pending[id].ready });
  }
  S.give(V, id);
  return (V.res = { kind: "obteve", doc: id });
};

/* ---------- Exame de língua ---------- */
S.EXAM = [
  { q: "O que é o NIF?", a: ["O número fiscal, para as Finanças", "Um número de telefone de emergência", "O nome do teu senhorio"], c: 0 },
  { q: "Onde se pede um Atestado de Residência?", a: ["No banco", "Na Junta de Freguesia", "No café"], c: 1 },
  { q: "O que quer dizer «volte amanhã com o comprovativo»?", a: ["Está tudo resolvido", "Falta um documento", "O funcionário vai de férias"], c: 1 },
  { q: "«Senha» num serviço público é…", a: ["Uma palavra secreta", "O número da tua vez na fila", "Uma taxa a pagar"], c: 1 },
  { q: "Um documento «caducado» está…", a: ["Fora do prazo de validade", "Rasgado", "Traduzido"], c: 0 },
  { q: "O que é uma apostila?", a: ["Um carimbo que certifica um documento estrangeiro", "Um caderno de exercícios", "Um tipo de selo de correio"], c: 0 }
];
S.examQuestions = function () {
  var idx = [0, 1, 2, 3, 4, 5];
  for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(S.rng() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx.slice(0, 3);
};
S.examResult = function (V, correct) {
  delete V.inv.inscricao_exame;
  S.advance(V, 90, 6);
  if (correct >= 2) { S.give(V, "exame"); S.addStress(V, C.ganhoStress); return (V.res = { kind: "obteve", doc: "exame" }); }
  S.addStress(V, 10);
  return (V.res = { kind: "chumbou", doc: "exame", certas: correct });
};

/* ---------- Pistas das personagens ---------- */
S.hintFatima = function (V) {
  if (V.flags.presoBanco && !V.known.alojamento) { S.reveal(V, "iban", "alojamento"); return true; }
  return false;
};
S.hintBento = function (V) {
  if (V.flags.presoNiss && !V.known.promessa) { S.reveal(V, "niss", "promessa"); S.reveal(V, "contrato_arr", "promessa"); return true; }
  return false;
};
S.askDocs = function (V, place) {
  var novos = [];
  S.docsAt(V, place || V.here).forEach(function (id) {
    var d = S.DOCS[id];
    if (d.hidden || d.f === 0) return;
    if (d.f === 3 && V.phase < 3) return;
    if (S.know(V, id)) novos.push(id);
  });
  S.advance(V, 10);
  return novos;
};

/* ---------- Interlúdio: cinco anos depois ---------- */
S.interlude = function (V) {
  V.stats.dias12 = S.day(V.t) + 1;
  var keep = {};
  Object.keys(V.inv).forEach(function (id) { if (!S.DOCS[id].val && id !== "visto") keep[id] = V.inv[id]; });
  V.inv = keep;
  V.pending = {};
  V.t = (S.day(V.t) + 1820) * DAY + 8 * H;   // 260 semanas: mantém o dia da semana
  V.dayBase = S.day(V.t);
  V.wokeAt = V.t;
  V.phase = 3;
  V.deadline = V.t + C.prazoFase3 * DAY;
  V.inv.autorizacao = { got: V.t, exp: V.deadline, uses: null };
  V.inv.passaporte = { got: V.t, exp: null, uses: null };
  V.inv.fotos = { got: V.t, exp: null, uses: 0 };
  V.money += 2000;
  V.stress = Math.max(10, V.stress - 30);
  V.here = "casa";
  V.home = "casa";
  V.recibos = 3;
  S.know(V, "cidadania");
};

/* ---------- Fim de jogo ---------- */
S.checkEnd = function (V) {
  if (!V.player) return null;
  if (V.stress >= 100) return "Fim_esgotamento";
  // um pedido de cidadania já entregue protege do prazo (o processo está em análise)
  if (V.t >= V.deadline && !(V.phase === 3 && (S.hasValid(V, "cidadania") || V.pending.cidadania))) return "Fim_deportacao";
  return null;
};
S.avgStress = function (V) { return V.stats.amostras ? Math.round(V.stats.stressSoma / V.stats.amostras) : V.stress; };

/* Respirar na fila: não gasta tempo extra, já estás à espera. */
S.breatheInQueue = function (V) {
  if (!S.canBreathe(V)) return false;
  V.lastBreath = V.t; V.stats.pausas++;
  S.addStress(V, C.respirar);
  return true;
};

/* ---------- Texto ---------- */
S.eur = function (v) { return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") + " €"; };
S.pick = function (arr) { return arr[Math.floor(S.rng() * arr.length)]; };
S.DESC = {
  pensao: "Um prédio estreito com uma estrela de néon a que falta uma ponta. Cheira a café e a lixívia. Na receção, a Dona Fátima resolve palavras cruzadas.",
  casa: "Um T0 com uma janela para as traseiras. É pequeno, mas a chave é tua.",
  cafe: "Seis mesas, uma televisão sempre ligada e a mesma conversa sobre futebol desde 1987. O Sr. Joaquim e a D. Rosa têm mesa cativa.",
  jardim: "Bancos de ferro, pombos e um lago com patos. Ninguém aqui te pede documentos.",
  financas: "Paredes cor de pêssego e um ecrã de senhas que salta números sem razão aparente.",
  banco: "Ar condicionado no máximo e cadeiras demasiado baixas. Uma planta de plástico observa-te.",
  junta: "Uma sala pequena com um calendário de 2019 e um aviso: «Atestados só com testemunhas.»",
  seg_social: "Três guichés, um a funcionar. Um cartaz promete «Simplificar é connosco».",
  centro_saude: "Uma sala de espera cheia de tosse. Num canto, a porta do gabinete do Dr. Tomé, psicólogo.",
  migracao: "Filas que dobram o corredor em várias línguas. Por cima do guiché 3, a Dra. Celeste Vaz e uma placa: «Processos incompletos não serão aceites.»",
  conservatoria: "Livros de registo encadernados a couro e um silêncio de igreja.",
  notario: "Um escritório de alcatifa verde. A tradutora tem quatro dicionários abertos ao mesmo tempo.",
  consulado: "A bandeira do teu país, um retrato desbotado e uma máquina de café avariada. Sentes-te em casa e longe dela.",
  escola: "Cartazes com conjugações verbais e um aviso de exames.",
  loja_foto: "Um fundo cinzento-claro, um banco giratório e um fotógrafo que já viu tudo.",
  senhorio: "A D. Amélia recebe-te à porta, com o gato ao colo.",
  empregador: "Cheira a pão quente. O Sr. Bento tem farinha até aos cotovelos."
};
S.HUMOR = [
  "{npc} suspira e olha para o relógio. «Hoje já não dá. O sistema foi abaixo.»",
  "{npc} está ao telefone com alguém e faz-te sinal para esperar. Quarenta minutos depois: «Volte noutro dia.»",
  "«Isso não é aqui… quer dizer, é, mas hoje não.» {npc} fecha o guiché para almoço.",
  "{npc} lê o teu pedido, franze a testa e devolve-o sem explicar porquê. «Volte amanhã.»"
];
S.LINGUA = [
  "{npc} fala depressa, cheio de siglas. Percebes metade. Quando tentas perguntar, já está a chamar a senha seguinte.",
  "Pedes para repetir. {npc} repete exatamente igual, mais alto. Não percebes. Sais sem nada.",
  "Usas a palavra errada e {npc} pensa que queres outra coisa. Quando dás pelo engano, a senha já passou."
];
S.MANUTENCAO = [
  "«Serviço temporariamente indisponível. Tente mais tarde.»",
  "A página fica a carregar. Ao fim de vinte minutos: «Sessão expirada.»",
  "«O seu navegador não é compatível. Recomendamos o Internet Explorer 6.»"
];
S.line = function (arr, npc) { var t = S.pick(arr).replace("{npc}", npc); return t.charAt(0).toUpperCase() + t.slice(1); };

/* ---------- Ponte para as passagens ---------- */
S.do = function (name) {
  var args = [State.variables].concat([].slice.call(arguments, 1));
  return S[name].apply(null, args);
};
S.doc = function (id) { return S.DOCS[id]; };
S.place = function (id) { return S.PLACES[id]; };

/* Estado de um documento, para o bloco de notas. */
S.status = function (V, id) {
  var it = V.inv[id];
  if (V.pending[id]) return { k: "espera", txt: V.pending[id].ready <= V.t ? "pronto para levantar" : "pronto a " + S.dateOf(V, V.pending[id].ready) };
  if (!it) return { k: "falta", txt: "ainda não tens" };
  if (it.uses !== null && it.uses <= 0) return { k: "expirado", txt: "acabaram" };
  if (it.exp !== null && it.exp <= V.t) return { k: "expirado", txt: "expirou" };
  if (it.exp !== null) return { k: "tem", txt: "válido até " + S.dayLabel(V, it.exp) };
  if (it.uses !== null) return { k: "tem", txt: it.uses + " restantes" };
  return { k: "tem", txt: "tens" };
};

/* ---------- Integração com o SugarCube ---------- */
if (typeof Config !== "undefined") {
  Config.history.maxStates = 1;          // na burocracia não há «voltar atrás»
  Config.history.controls = false;
  Config.saves.isAllowed = function () { return !!State.variables.player; };
  Config.navigation.override = function (dest) {
    var fim = S.checkEnd(State.variables);
    if (fim && Story.get(dest).tags.indexOf("fim") < 0) return fim;
    return false;
  };
  $(document).on(":passagedisplay", function () {
    var st = State.variables.stress || 0;
    $("html").toggleClass("stress-70", st >= 70).toggleClass("stress-85", st >= 85);
  });
  S.openDialog = function (title, passage) {
    if (Dialog.create) Dialog.create(title, "caderno"); else Dialog.setup(title, "caderno");
    if (Dialog.wikiPassage) Dialog.wikiPassage(passage); else Dialog.wiki(Story.get(passage).processText());
    Dialog.open();
  };
}

})();
