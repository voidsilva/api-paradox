// API simples de frases (estilo "O Idiota") que não repete frases já entregues.
// Roda local (node server.js) e na Vercel (api/index.js).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { TEMAS, CONECTORES } = require("./frases");

const PORT = process.env.PORT || 3000;
// Na Vercel só /tmp é gravável
const ARQ = process.env.USADOS || (process.env.VERCEL ? "/tmp/usados.txt" : path.join(__dirname, "usados.txt"));
const NOMES = Object.keys(TEMAS);

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

let usados = new Set();
try {
  if (fs.existsSync(ARQ)) usados = new Set(fs.readFileSync(ARQ, "utf8").split("\n").filter(Boolean));
} catch (_) {}

const soma = (f) => NOMES.reduce((n, t) => n + f(TEMAS[t]), 0);
const TOTAL = soma((t) => t.pares.length) * soma((t) => t.verdades.length * t.fechos.length) * CONECTORES.length;

function montar(ta, tb) {
  const [a, b] = pick(TEMAS[ta].pares);
  return `Não ${a}, ${b}. ${pick(CONECTORES)} ${pick(TEMAS[tb].verdades)}. ${pick(TEMAS[tb].fechos)}`;
}

function gerar(tema) {
  for (let i = 0; i < 500; i++) {
    const msg = montar(tema || pick(NOMES), tema || pick(NOMES));
    const h = hash(msg);
    if (!usados.has(h)) {
      usados.add(h);
      try { fs.appendFileSync(ARQ, h + "\n"); } catch (_) {}
      return msg;
    }
  }
  return tema ? gerar(null) : null;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const tema = (url.searchParams.get("tema") || "").toLowerCase();
    const qtd = Math.min(Math.max(parseInt(url.searchParams.get("qtd")) || 1, 1), 20);
    const texto = url.searchParams.get("formato") === "texto";
    const rota = url.pathname.replace(/\/+$/, "") || "/";

    if (rota === "/" || rota === "/mensagem" || rota === "/api") {
      if (tema && !TEMAS[tema]) return send(res, 400, { status: 400, message: `tema inválido. Use: ${NOMES.join(", ")}` });
      const lista = [];
      for (let i = 0; i < qtd; i++) {
        const m = gerar(tema || null);
        if (!m) break;
        lista.push(m);
      }
      if (!lista.length) return send(res, 410, { status: 410, message: "banco esgotado" });
      if (texto) return send(res, 200, lista.join("\n\n"), "text/plain; charset=utf-8");
      return send(res, 200, qtd === 1 ? { status: 200, message: lista[0] } : { status: 200, messages: lista });
    }
    if (rota === "/temas") return send(res, 200, { status: 200, temas: NOMES });
    if (rota === "/status")
      return send(res, 200, { status: 200, entregues: usados.size, combinacoes_totais: TOTAL });
    send(res, 404, { status: 404, message: "rota não encontrada" });
  } catch (e) {
    send(res, 500, { status: 500, message: "erro interno" });
  }
}

module.exports = handler;

if (require.main === module)
  http.createServer(handler).listen(PORT, () => console.log(`API em http://localhost:${PORT}`));
