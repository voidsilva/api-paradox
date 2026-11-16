// API simples de frases (estilo "O Idiota") que NUNCA repete uma frase já entregue.
// Frases entregues ficam gravadas em usados.txt (hash por linha) e sobrevivem a reinícios.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { TEMAS, CONECTORES } = require("./frases");

const PORT = process.env.PORT || 3000;
const ARQ = process.env.USADOS || path.join(__dirname, "usados.txt");
const NOMES = Object.keys(TEMAS);

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

const usados = new Set(fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8").split("\n").filter(Boolean) : []);

// Espaço total de combinações
const soma = (f) => NOMES.reduce((n, t) => n + f(TEMAS[t]), 0);
const TOTAL_TEMA = (t) => TEMAS[t].pares.length * TEMAS[t].verdades.length * TEMAS[t].fechos.length * CONECTORES.length;
const TOTAL = soma((t) => t.pares.length) * soma((t) => t.verdades.length * t.fechos.length) * CONECTORES.length;

function montar(ta, tb) {
  const [a, b] = pick(TEMAS[ta].pares);
  return `Não ${a}, ${b}. ${pick(CONECTORES)} ${pick(TEMAS[tb].verdades)}. ${pick(TEMAS[tb].fechos)}`;
}

function gerar(tema) {
  // 1) tenta dentro do tema (ou misturando temas se nenhum foi pedido)
  for (let i = 0; i < 500; i++) {
    const ta = tema || pick(NOMES);
    const tb = tema || pick(NOMES);
    const msg = montar(ta, tb);
    const h = hash(msg);
    if (!usados.has(h)) {
      usados.add(h);
      fs.appendFileSync(ARQ, h + "\n");
      return { tema: tema || "misto", mensagem: msg };
    }
  }
  // 2) tema esgotado: mistura temas
  if (tema) return gerar(null);
  return null;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const tema = (url.searchParams.get("tema") || "").toLowerCase();
    const qtd = Math.min(Math.max(parseInt(url.searchParams.get("qtd")) || 1, 1), 20);
    const texto = url.searchParams.get("formato") === "texto";

    if (url.pathname === "/mensagem") {
      if (tema && !TEMAS[tema]) return send(res, 400, { erro: "tema inválido", temas: NOMES });
      const lista = [];
      for (let i = 0; i < qtd; i++) {
        const m = gerar(tema || null);
        if (!m) break;
        lista.push(m);
      }
      if (!lista.length) return send(res, 410, { erro: "banco esgotado: todas as frases já foram entregues" });
      if (texto) return send(res, 200, lista.map((m) => m.mensagem).join("\n\n"), "text/plain; charset=utf-8");
      return send(res, 200, qtd === 1 ? lista[0] : { total: lista.length, mensagens: lista });
    }
    if (url.pathname === "/temas") return send(res, 200, { temas: NOMES });
    if (url.pathname === "/status")
      return send(res, 200, { entregues: usados.size, combinacoes_totais: TOTAL, restantes: TOTAL - usados.size });
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (url.pathname === "/")
      return send(res, 200, {
        endpoints: {
          "GET /mensagem": "frase nova (nunca repetida)",
          "GET /mensagem?tema=bondade": "frase de um tema",
          "GET /mensagem?qtd=5": "várias frases (máx. 20)",
          "GET /mensagem?formato=texto": "texto puro",
          "GET /temas": "temas",
          "GET /status": "quantas já foram entregues / restantes",
        },
        temas: NOMES,
      });
    send(res, 404, { erro: "rota não encontrada" });
  })
  .listen(PORT, () => console.log(`API em http://localhost:${PORT} | combinações: ${TOTAL.toLocaleString("pt-BR")}`));
