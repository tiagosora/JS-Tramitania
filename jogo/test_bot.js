// Testes do motor: um "jogador-robô" que conhece o grafo inteiro joga partidas
// completas com as regras reais. Uso: node test_bot.js [nPartidas]
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function load() {
  const ctx = { setup: {}, Math, Object, Array, String, JSON, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/story.js", "utf8"), ctx);
  return ctx.setup;
}
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const PLAYER = { nome: "Ana Silva", idade: "29", altura: "168", civil: "Solteiro(a)" };

/* ---------- testes unitários ---------- */
function unit() {
  const S = load(); S.rng = seeded(1);
  const V = S.initState({}); V.player = PLAYER;
  const originais = ["logo", ...Object.values(S.PLACES).map(p => `icones/${p.icone}`)];
  assert.deepStrictEqual(originais.filter(f => !fs.readFileSync(`${__dirname}/${f}.svg`, "utf8").includes(`d="${S.ICONES[path.basename(f)]}"`)), [], "há ícones diferentes dos originais");
  const sons = Object.fromEntries([...fs.readFileSync(`${__dirname}/passagens.twee`, "utf8").matchAll(/^:: (\S+) \[Twine\.audio\].*\n(.*)$/gm)].map(m => [m[1], m[2]]));
  assert.deepStrictEqual(Object.keys(sons).sort(), Object.keys(S.SOM.faixas).map(S.somPassagem).sort(), "faixas e passagens Twine.audio não coincidem");
  assert.deepStrictEqual(Object.keys(sons).filter(f => sons[f] !== "data:audio/mpeg;base64," + fs.readFileSync(`${__dirname}/${f}`, "base64")), [], "há sons diferentes dos originais");
  assert.deepStrictEqual(Object.values(S.PLACES).filter(p => p.ambiente && !S.SOM.faixas[p.ambiente]), [], "há ambientes sem faixa");
  assert.strictEqual(S.dayLabel(V), "Dia 1 · segunda");
  assert.strictEqual(S.clock(V.t), "08:00");
  assert.strictEqual(S.daysLeft(V), 45);
  assert(V.known.autorizacao && S.hasValid(V, "passaporte") && S.hasValid(V, "visto"));

  // formulário: dados diferentes são recusados, ignorando maiúsculas e espaços
  let r = S.submitForm(V, "nif", { ...PLAYER, altura: "170" });
  assert.strictEqual(r.kind, "dados"); assert.strictEqual(r.campo, "Altura (cm)");
  r = S.submitForm(V, "nif", { ...PLAYER, nome: "  ana   SILVA " });
  assert.strictEqual(r.kind, "obteve"); assert(S.hasValid(V, "nif"));

  // requisito em falta revela um de cada vez; alternativa escondida não é mencionada
  S.rng = () => 0.99; // sem azar
  r = S.request(V, "iban");
  assert.strictEqual(r.kind, "falta"); assert.strictEqual(r.falta, "atestado");
  assert(V.flags.presoBanco && !V.known.alojamento);
  assert(S.hintFatima(V) && V.known.alojamento && V.rev.iban.alojamento);

  // fase 3 bloqueada antes da residência
  r = S.request(V, "cmd"); assert.strictEqual(r.kind, "cedo");

  // validade: documento expira e deixa de contar
  S.give(V, "alojamento");
  assert(S.hasValid(V, "alojamento"));
  S.advance(V, 11 * 1440);
  assert(!S.hasValid(V, "alojamento"));
  assert(V.log.some(l => l.text.includes("expirou")));

  // segunda-feira traz a remessa; dormir na pensão custa 20 €
  const V2 = S.initState({}); V2.player = PLAYER;
  V2.t = 6 * 1440 + 22 * 60; V2.here = "pensao"; // domingo 22:00
  const m0 = V2.money; S.sleep(V2);
  assert.strictEqual(S.weekday(V2.t), 0); assert.strictEqual(S.clock(V2.t), "08:00");
  assert.strictEqual(V2.money, m0 - 20 + 60);

  // marcação só é gasta pela Agência de Migração, não pelo banco
  const V3 = S.initState({}); V3.player = PLAYER; ["nif", "iban", "marcacao"].forEach(id => S.give(V3, id));
  S.finalize(V3, "taxa_ar"); assert(S.hasValid(V3, "marcacao"));

  // falha no balcão sobe com o stress e desce com a língua, com teto
  const V4 = S.initState({}); V4.stress = 50;
  assert.strictEqual(S.failChance(V4, "financas"), 10 + 10 + 20);
  V4.lang = 3; assert.strictEqual(S.failChance(V4, "financas"), 20);
  V4.stress = 100; V4.lang = 0; assert.strictEqual(S.failChance(V4, "financas"), 45);
  assert.strictEqual(S.failChance(V4, "senhorio"), 0);

  // stress 100 termina o jogo; prazo também
  V4.player = PLAYER; assert.strictEqual(S.checkEnd(V4), "Fim_esgotamento");
  V4.stress = 20; V4.t = V4.deadline; assert.strictEqual(S.checkEnd(V4), "Fim_deportacao");

  // interlúdio: mantém permanentes, apaga os com validade, mantém o dia da semana
  const V5 = S.initState({}); ["nif", "niss", "atestado", "decl_fin"].forEach(id => S.give(V5, id));
  const wd = S.weekday(V5.t); S.interlude(V5);
  assert(S.hasValid(V5, "nif") && S.hasValid(V5, "niss") && !V5.inv.atestado && !V5.inv.decl_fin);
  assert.strictEqual(S.weekday(V5.t), wd); assert.strictEqual(S.dayLabel(V5), "Dia 1 · " + ["segunda","terça","quarta","quinta","sexta","sábado","domingo"][wd]);
  assert(!S.hasValid(V5, "fotos")); assert.strictEqual(S.daysLeft(V5), 40);
  console.log("testes unitários: OK");
}

/* ---------- robô ---------- */
function play(seed, careful, realista) {
  const S = load(); S.rng = seeded(seed);
  const V = S.initState({}); V.player = { ...PLAYER };
  const out = { fim: null, dias12: null, dias3: null, minMoney: V.money, maxStress: 0, acoes: 0, pedidos: 0 };
  const done = (e) => { out.fim = e; out.maxStress = V.stats.maxStress; out.acoes = V.stats.acoes; return out; };
  const hidden = id => S.DOCS[id].hidden;

  // próximo documento a tratar (o robô conhece o grafo e prefere as alternativas escondidas)
  function next(id, seen = new Set()) {
    if (S.hasValid(V, id)) return null;
    if (seen.has(id)) return null; seen.add(id);
    if (V.pending[id]) return V.pending[id].ready <= V.t ? id : "WAIT";
    const d = S.DOCS[id];
    let waiting = false;
    const groups = realista ? d.req.map(g => g.filter(r => V.rev[id] && V.rev[id][r])).filter(g => g.length) : d.req;
    for (const g of groups) {
      if (g.some(r => S.hasValid(V, r))) continue;
      const order = [...g].sort((a, b) => (hidden(b) ? 1 : 0) - (hidden(a) ? 1 : 0));
      let found = null;
      for (const m of order) { const n = next(m, seen); if (n === "WAIT") { waiting = true; break; } if (n) { found = n; break; } }
      if (found) return found;
      if (!waiting) return "WAIT";
    }
    if (waiting) return "WAIT";
    if (d.cond === "carimbos" && V.carimbos < 10) return "CAFE";
    if (d.cond === "recibos" && V.recibos < 3) return "WAIT";
    return id;
  }
  function goHomeSleep() { S.travel(V, V.home); S.sleep(V); }
  function passTime() {
    const m = S.minuteOfDay(V.t);
    if (m >= 20 * 60 || m < 6 * 60) goHomeSleep();
    else if (S.canBiscate(V)) { S.travel(V, "empregador"); S.biscate(V); }
    else { S.travel(V, "jardim"); S.walk(V); }
  }

  for (let step = 0; step < 20000; step++) {
    let e = S.checkEnd(V); if (e) return done(e);
    out.minMoney = Math.min(out.minMoney, V.money);
    V.log.length = 0;
    const m = S.minuteOfDay(V.t);
    if (m >= 21 * 60 || m < 7 * 60) { goHomeSleep(); continue; }
    if (careful && V.stress >= 55) {
      if (S.canBreathe(V)) { S.breathe(V); continue; }
      if (S.canConsult(V) && S.isOpen(V, "centro_saude")) { S.travel(V, "centro_saude"); S.consult(V); continue; }
      if (V.here === V.home && S.canCall(V)) { S.call(V); continue; }
      if (V.stress >= 70) { S.travel(V, "jardim"); S.walk(V); continue; }
    }
    if (V.lang < 2 && V.money > 300 && S.isOpen(V, "escola")) { S.travel(V, "escola"); S.lesson(V); continue; }
    if (realista && V.flags.presoBanco && !V.known.alojamento) { S.travel(V, "pensao"); S.advance(V, 15); S.hintFatima(V); continue; }
    if (realista && V.flags.presoNiss && !V.known.promessa && S.isOpen(V, "empregador")) { S.travel(V, "empregador"); S.advance(V, 15); S.hintBento(V); continue; }
    const goal = V.phase < 3 ? "autorizacao" : (S.hasValid(V, "requerimento") || V.pending.cidadania ? "cidadania" : "requerimento");
    let target = next(goal);
    if (goal === "cidadania" && !target && S.hasValid(V, "cidadania")) return done("Fim_cidadania");
    if (target === "CAFE") { S.travel(V, "cafe"); if (!S.coffee(V)) passTime(); continue; }
    if (!target || target === "WAIT") { passTime(); continue; }
    const d = S.DOCS[target], p = S.PLACES[d.at];
    if (p.tipo === "site") { if (!S.hasInternet(V)) S.travel(V, V.home); }
    else {
      if (!S.isOpen(V, d.at, V.t + (V.here === d.at ? 0 : 30))) { passTime(); continue; }
      S.travel(V, d.at);
    }
    if (p.tipo === "balcao") {
      const tk = S.takeTicket(V); if (tk.kind !== "fila") { passTime(); continue; }
      if (careful && S.canBreathe(V) && V.stress > 30) { V.lastBreath = V.t; S.addStress(V, S.CFG.respirar); V.stats.pausas++; }
      if (S.waitQueue(V).kind !== "chamado") continue;
    } else S.advance(V, p.tipo === "site" ? 20 : 10);
    out.pedidos++;
    let r = S.request(V, target);
    if (r.kind === "formulario") r = S.submitForm(V, target, V.player);
    if (r.kind === "exame") r = S.examResult(V, S.rng() < 0.75 ? 3 : 1);
    if (r.kind === "dinheiro") { passTime(); continue; }
    if (r.kind === "obteve" && target === "autorizacao") { out.dias12 = S.day(V.t) + 1; S.interlude(V); continue; }
    if ((r.kind === "obteve" || r.kind === "levantou") && target === "cidadania") { out.dias3 = S.day(V.t) - V.dayBase + 1; return done("Fim_cidadania"); }
  }
  return done("SEM_FIM");
}

function sim(n, careful, realista) {
  const res = [];
  for (let i = 0; i < n; i++) res.push(play(1000 + i, careful, realista));
  const by = {}; res.forEach(r => by[r.fim] = (by[r.fim] || 0) + 1);
  const wins = res.filter(r => r.fim === "Fim_cidadania");
  const avg = (a, k) => a.length ? Math.round(a.reduce((s, r) => s + (r[k] || 0), 0) / a.length) : "-";
  const all12 = res.filter(r => r.dias12);
  console.log(`\n${realista ? "[realista] " : "[conhece o grafo] "}${careful ? "Robô cuidadoso (gere o stress)" : "Robô apressado (nunca faz pausas)"} — ${n} partidas`);
  console.log("  desfechos:", JSON.stringify(by));
  console.log("  dias até à Autorização (de 45):", avg(all12, "dias12"), " máx:", all12.length ? Math.max(...all12.map(r => r.dias12)) : "-");
  console.log("  dias na fase 3 (de 40):", avg(wins, "dias3"), " máx:", wins.length ? Math.max(...wins.map(r => r.dias3)) : "-");
  console.log("  pedidos ao balcão (média):", avg(res, "pedidos"), " ações:", avg(res, "acoes"));
  console.log("  dinheiro mínimo (média):", avg(res, "minMoney"), " pior:", Math.min(...res.map(r => r.minMoney)));
  console.log("  stress máximo (média):", avg(res, "maxStress"));
  return { by, res };
}

unit();
const n = +process.argv[2] || 300;
const c = sim(n, true, false);
sim(n, false, false);
const cr = sim(n, true, true);
const hr = sim(n, false, true);
assert(!c.by.SEM_FIM && !cr.by.SEM_FIM, "há partidas sem fim (bloqueio)");
assert((c.by.Fim_cidadania || 0) / n >= 0.95, "quem conhece o grafo e gere o stress devia ganhar sempre");
assert((cr.by.Fim_cidadania || 0) / n >= 0.75, "o jogador realista cuidadoso devia ganhar na maioria das vezes");
assert((hr.by.Fim_cidadania || 0) < (cr.by.Fim_cidadania || 0), "gerir o stress devia ajudar a ganhar");
console.log("\nverificações de equilíbrio: OK");
