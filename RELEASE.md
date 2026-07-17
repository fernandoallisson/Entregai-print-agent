# Atualizações remotas do Entregaí Print Agent

## Como funciona

O aplicativo usa `electron-updater`, `electron-builder`, instalador NSIS e GitHub Releases do repositório público `fernandoallisson/Entregai-print-agent`.

Quando o aplicativo está empacotado e configurado no ambiente de produção, ele:

1. consulta uma nova versão após a inicialização e periodicamente;
2. baixa a atualização em segundo plano;
3. continua imprimindo normalmente durante a consulta e o download;
4. mantém a atualização pronta sem reiniciar o computador ou o agente;
5. instala a atualização quando o aplicativo for encerrado normalmente.

Credenciais, vínculo, impressoras, layout e conexão são armazenados no diretório de dados do usuário do Electron. O instalador não remove esse diretório durante uma atualização.

Erros de rede ou de atualização são registrados e exibidos discretamente. Eles não encerram o agente e não impedem impressões.

Não existe downgrade automático. Uma correção ou rollback deve sempre ser publicada como uma versão numericamente superior.

## Primeira instalação manual

A primeira versão que contém o atualizador precisa ser instalada manualmente uma última vez em cada computador.

Para esta implementação, gere e instale manualmente o arquivo:

```text
Entregaí Print Agent Setup 1.1.0.exe
```

Depois da instalação:

1. abra o aplicativo;
2. acesse **Configurar conexão**;
3. selecione o ambiente **Produção**;
4. informe a URL HTTPS do backend;
5. mantenha o transporte em **Automático**;
6. vincule o computador à loja;
7. confirme na interface que aparece `Versão 1.1.0` e que as atualizações automáticas estão ativadas.

As versões posteriores poderão ser recebidas remotamente.

## Publicar uma nova versão

Antes de publicar, o diretório de trabalho deve estar limpo, os testes devem passar e a versão atual deve estar presente na instalação piloto.

### Patch

Use para correções compatíveis, por exemplo `1.1.0` para `1.1.1`:

```powershell
npm version patch
git push
git push --tags
```

### Minor

Use para funcionalidades compatíveis, por exemplo `1.1.0` para `1.2.0`:

```powershell
npm version minor
git push
git push --tags
```

### Major

Use para mudanças incompatíveis, por exemplo `1.1.0` para `2.0.0`:

```powershell
npm version major
git push
git push --tags
```

`npm version` atualiza `package.json` e `package-lock.json`, cria o commit da versão e gera a tag `vX.Y.Z`.

Um `git push` comum não publica atualização. O workflow é iniciado somente por uma tag correspondente ao padrão `vX.Y.Z`, e ainda valida se a tag corresponde exatamente à versão do `package.json`.

## Acompanhar a publicação

1. Acesse [Actions do repositório](https://github.com/fernandoallisson/Entregai-print-agent/actions).
2. Abra o workflow **Publicar atualização do Print Agent**.
3. Confirme a aprovação das etapas de instalação, verificações, testes, build e validação dos artefatos.
4. Acesse [Releases](https://github.com/fernandoallisson/Entregai-print-agent/releases).

A Release deve conter exatamente os artefatos da versão:

```text
Entregaí Print Agent Setup X.Y.Z.exe
Entregaí Print Agent Setup X.Y.Z.exe.blockmap
latest.yml
```

O `latest.yml` deve informar a mesma versão e o mesmo nome do instalador, além do hash SHA-512 correspondente. O workflow executa `npm run release:validate` antes de publicar.

## Verificar no agente

Após publicar:

1. mantenha o agente piloto aberto e conectado à internet;
2. confirme a mensagem de verificação de atualização;
3. acompanhe o percentual do download;
4. aguarde a mensagem de atualização pronta;
5. confirme que impressões continuam funcionando;
6. encerre o aplicativo normalmente após o expediente;
7. abra o aplicativo novamente e confirme a nova versão.

O aplicativo nunca chama reinício automático durante a operação. A instalação fica pendente até um encerramento normal.

## Assinatura digital

O workflow está preparado para os seguintes secrets do GitHub:

- `WINDOWS_CSC_LINK`: certificado de assinatura em formato aceito pelo `electron-builder`, normalmente o conteúdo Base64 do arquivo PFX;
- `WINDOWS_CSC_KEY_PASSWORD`: senha do certificado.

Não armazene o certificado ou sua senha no Git. Quando o certificado definitivo estiver disponível, configure também o nome oficial do publicador no `electron-builder` se ele for exigido pela política de assinatura adotada.

Enquanto os secrets não estiverem configurados, builds locais e do GitHub continuam funcionando sem assinatura. Instaladores sem assinatura podem exibir alertas do Microsoft Defender SmartScreen e do Controle de Conta de Usuário do Windows.

## Falha na publicação

- Se a falha for transitória e não exigir alteração de código, use **Re-run failed jobs** no GitHub Actions.
- Se for necessário modificar código, não mova nem reutilize uma tag já publicada. Corrija o problema e gere uma nova versão.
- Se a Release foi criada com arquivos incompletos, não distribua essa versão. Corrija o pipeline e publique uma versão superior.
- Nunca envie manualmente somente o `.exe`; o `.blockmap` e o `latest.yml` da mesma versão também são obrigatórios.

## Rollback

O atualizador não realiza downgrade. Para reverter uma versão com problema:

1. restaure o código estável;
2. mantenha as correções necessárias para compatibilidade;
3. gere uma nova versão numericamente superior com `npm version patch`;
4. publique a nova tag normalmente;
5. valide primeiro em um agente piloto.

Exemplo: se `1.2.0` apresentar problema, publique a correção como `1.2.1`; não tente publicar novamente `1.1.0` como atualização automática.

## Configurações externas pendentes

- Confirmar em **Settings > Actions > General** que workflows podem criar Releases com `GITHUB_TOKEN`.
- Instalar manualmente a primeira versão com atualizador em cada computador.
- Adicionar futuramente os secrets de assinatura digital.
- Manter o repositório público enquanto ele for usado diretamente como provedor de atualizações.

