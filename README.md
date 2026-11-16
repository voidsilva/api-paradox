# api-paradox

API simples de frases no estilo de *O Idiota* (Dostoiévski). Nunca entrega a mesma frase duas vezes (histórico em `usados.txt`).

```
npm start   # http://localhost:3000
```

- `GET /mensagem` — frase nova (`?tema=bondade`, `?qtd=5`, `?formato=texto`)
- `GET /temas` — temas
- `GET /status` — entregues / restantes (256.000 combinações)
