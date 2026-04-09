# Mobility App 📱

Aplicativo mobile desenvolvido em React Native com Expo para ajudar pessoas com deficiência a encontrarem rotas urbanas seguras e acessíveis.

## Sobre o projeto

O Mobility App é o cliente mobile da Mobility API, um sistema que combina inteligência artificial, Google Street View e análise de acessibilidade para guiar pessoas com deficiência por rotas urbanas. O app foi desenvolvido com foco em acessibilidade desde o primeiro commit, contemplando deficientes visuais, cadeirantes e pessoas com mobilidade reduzida.

A identidade visual do projeto foi construída em torno do cão guia: símbolo universal de independência e acessibilidade, com uma paleta azul (#0057A8) que remete ao símbolo internacional de acesso.

## Tech Stack

- **React Native**: framework para desenvolvimento mobile multiplataforma
- **Expo**: plataforma que simplifica o desenvolvimento, build e distribuição do app
- **TypeScript**: tipagem estática para maior segurança
- **Expo Router**: roteamento baseado em arquivos, padrão do ecossistema Expo

## Funcionalidades implementadas

- Tela de login com campos de email e senha
- Identidade visual com ilustração de deficiente visual e cão guia
- Paleta de acessibilidade baseada no azul internacional (#0057A8)
- Estrutura base de navegação com Expo Router

## Roadmap

- [ ] Tela de cadastro
- [ ] Autenticação JWT integrada com a Mobility API
- [ ] Tela de busca de rotas com origem e destino
- [ ] Exibição de rotas analisadas com alertas de acessibilidade
- [ ] Tela de lugares acessíveis
- [ ] Avaliações colaborativas de locais
- [ ] Suporte a leitores de tela (TalkBack/VoiceOver)
- [ ] Modo de alto contraste
- [ ] Filtro de rotas por tipo de deficiência
- [ ] Versão iOS

## Pré-requisitos

- Node.js 18+
- Expo Go instalado no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

## Instalação e uso

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/mobility-app.git
cd mobility-app

# Instale as dependências
npm install

# Inicie o projeto
npx expo start
```

Escaneie o QR code com o Expo Go para visualizar o app no celular.

## Relação com o backend

Este app consome a [Mobility API](https://github.com/seu-usuario/mobility-api): uma API REST desenvolvida em NestJS responsável por:

- Autenticação de usuários com JWT
- Cálculo e análise de rotas acessíveis via Google Directions API
- Análise de acessibilidade via Google Street View + Gemini 2.5 Flash
- CRUD de lugares acessíveis e avaliações colaborativas

## Licença

MIT