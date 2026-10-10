# ERA UMA VEZ — Openverse edition

Protótipo web de histórias em grupo com busca de imagens no Openverse. Compatível com GitHub Pages (HTML/CSS/JS estático).

## O que funciona nesta versão

- Interface responsiva para PC e celular.
- Modo demonstração local, sem Firebase.
- Trechos de história e galeria de imagens.
- Busca de imagens pelo Openverse a partir de palavras do texto.
- Link da fonte e indicação da licença mostrada pelo Openverse.
- Estrutura de salas online usando Firebase Realtime Database e autenticação anônima.

## Antes de publicar salas online

O modo demonstração funciona sem configurar Firebase. Para o multiplayer online:

1. Abra o Firebase Console e entre no projeto `eraumaque`.
2. Em **Build > Realtime Database**, crie um banco de dados.
3. Copie a URL exata mostrada na página do banco (normalmente `https://...firebasedatabase.app` ou `https://...firebaseio.com`).
4. Abra `firebase-config.js` e substitua `COLE_AQUI_A_URL_DO_REALTIME_DATABASE` pela URL exata.
5. Em **Authentication > Sign-in method**, habilite **Anonymous**.
6. Publique as regras de `database.rules.json` apenas como ponto de partida para teste.

**Aviso de segurança:** as regras fornecidas aqui são permissivas para leitura/escrita da sala e não são adequadas para lançamento público. Antes de compartilhar com desconhecidos, as regras devem ser reforçadas para validar anfitrião, membros e campos permitidos. Não use regras abertas como solução definitiva.

## Imagens / Openverse

O jogo consulta `https://api.openverse.org/v1/images/`. A busca é externa e pode falhar se houver limites, mudanças de API, bloqueios de rede ou indisponibilidade. A galeria usa miniaturas externas; elas não são copiadas para o projeto. Cada imagem tem uma licença própria. Confira os detalhes na página de origem antes de reutilizar ou redistribuir imagens.

A busca é por palavras-chave extraídas do texto, não é geração de imagem por IA. O Openverse não garante que o resultado combine perfeitamente com a história.

## Publicar no GitHub Pages

1. Extraia o ZIP.
2. Envie `index.html`, `style.css`, `app.js`, `firebase-config.js`, `database.rules.json` e `README.md` para a raiz do repositório.
3. No GitHub, abra **Settings > Pages** e escolha a branch e a pasta raiz.
4. Para teste local, use um servidor estático (módulos ES não funcionam de forma confiável abrindo `index.html` diretamente como `file://`).

## Limitações conhecidas deste protótipo

- O modo demonstração guarda a história apenas na memória da página.
- Não há temporizador de 30 segundos nem finalização automática ainda.
- Multiplayer online requer configurar corretamente Firebase Auth e Realtime Database.
- A API pública de busca pode aplicar limites de requisição.
