function previewJob(profile) {
  const documentType = profile === 'kitchen' ? 'ORDER_KITCHEN' : 'ORDER_CUSTOMER';
  return {
    id: 'preview',
    document_type: documentType,
    payload: {
      documentType,
      store: {
        nome: 'Mercado Entregaí',
        razaoSocial: 'Mercado Entregaí LTDA',
        cnpj: '12.345.678/0001-90',
        telefone: '(81) 99999-0000',
        email: 'contato@entregai.com.br',
      },
      order: {
        numeroPedido: 'PED-1024',
        numeroComandaCodigo: '00042',
        clienteNome: 'Maria Silva',
        clienteTelefone: '(81) 98888-7777',
        clienteDocumento: '123.456.789-00',
        tipoPedidoLabel: 'Entrega',
        enderecoDestaque: {
          linha: 'Rua das Flores, 120',
          bairro: 'Centro',
          completo: 'Rua das Flores, 120, Casa 2',
          referencia: 'Próximo à praça',
        },
      },
      items: [
        {
          quantidade: 1,
          nomeProduto: 'Pizza',
          nomeVariacao: 'XG - 12 Fatias',
          precoTotal: 77.5,
          observacoes: 'Quero ela quentinha e fresquinha',
          selecoes: [
            {
              nomeGrupo: 'Sabores',
              nomeOpcao: '4 Queijos Especial',
              observacoes: 'Com cebola',
              quantidade: 1,
              fracao: 0.25,
              fracaoLabel: '25%',
            },
            {
              nomeGrupo: 'Sabores',
              nomeOpcao: 'Atum',
              observacoes: 'Sem picles',
              quantidade: 1,
              fracao: 0.25,
              fracaoLabel: '25%',
            },
            {
              nomeGrupo: 'Sabores',
              nomeOpcao: 'Chocolate Branco',
              observacoes: 'Com bastante chocolate',
              quantidade: 1,
              fracao: 0.25,
              fracaoLabel: '25%',
            },
            {
              nomeGrupo: 'Sabores',
              nomeOpcao: 'Frango Fricasse',
              observacoes: 'Sem milho e ervilha',
              quantidade: 1,
              fracao: 0.25,
              fracaoLabel: '25%',
            },
          ],
        },
        {
          quantidade: 1,
          nomeProduto: 'Pizza Aurora Mussarela 440g',
          precoTotal: 17.9,
          selecoes: [],
        },
        {
          quantidade: 1,
          nomeProduto: 'Refrigerante Coca-Cola 1,5L',
          precoTotal: 6.79,
          selecoes: [],
        },
        {
          quantidade: 1,
          nomeProduto: 'Refrigerante Coca-Cola Original 2,5L',
          precoTotal: 11.49,
          selecoes: [],
        },
      ],
      totals: {
        subtotalLabel: 'Subtotal dos pedidos lançados',
        subtotal: 113.68,
        taxaEntrega: 0,
        desconto: 0,
        total: 113.68,
      },
      payment: {
        formaPagamentoLabel: 'Dinheiro',
        statusLabel: 'Pendente',
        pago: false,
        pagoLabel: 'PAGAMENTO PENDENTE',
        valor: 113.68,
        troco: { linhas: ['Troco para R$ 150,00'] },
      },
    },
  };
}

module.exports = previewJob;
