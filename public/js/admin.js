// Inicialização do painel admin
document.addEventListener('DOMContentLoaded', function() {
    // Verificar status do banco de dados
    checkDatabaseStatus();
    
    // Carregar estatísticas
    carregarEstatisticas();
    
    // Carregar dados iniciais
    loadSimulacoes(1);
    
    // Adicionar eventos aos elementos
    setupTabs();
    setupSearchHandlers();
    setupModalEvents();
});

// Verificar status do banco de dados
function checkDatabaseStatus() {
    fetch('/api/status/db')
        .then(response => response.json())
        .then(data => {
            const statusElement = document.getElementById('db-status');
            if (data.conectado) {
                statusElement.textContent = 'Banco de Dados Conectado';
                statusElement.className = 'status-box status-success';
            } else {
                statusElement.textContent = 'Erro na Conexão com o Banco';
                statusElement.className = 'status-box status-error';
                console.error('Erro no banco de dados:', data.mensagem);
            }
        })
        .catch(error => {
            console.error('Erro ao verificar status do banco:', error);
            const statusElement = document.getElementById('db-status');
            statusElement.textContent = 'Erro na Conexão com o Banco';
            statusElement.className = 'status-box status-error';
        });
}

// Função para renderizar uma linha da tabela
function renderTableRow(simulacao) {
    const data = new Date(simulacao.dataCriacao).toLocaleDateString('pt-BR');
    const valorImovel = formatarMoeda(simulacao.valorImovel || simulacao.valorCredito || 0);
    
    // Tratamento da renda familiar
    const rendaFamiliar = simulacao.cliente?.rendaFamiliar || simulacao.rendaFamiliar || simulacao.cliente?.renda || 0;
    const rendaFormatada = formatarMoeda(rendaFamiliar);
    
    // Tratamento do telefone/whatsapp
    const telefone = simulacao.cliente?.telefone || simulacao.telefone || simulacao.cliente?.whatsapp || simulacao.whatsapp || '';
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const telefoneFormatado = telefoneLimpo ? `(${telefoneLimpo.slice(0,2)}) ${telefoneLimpo.slice(2,7)}-${telefoneLimpo.slice(7)}` : '-';
    
    return `
        <tr>
            <td>${simulacao.id}</td>
            <td>${data}</td>
            <td>${simulacao.cliente?.nome || simulacao.nome || '-'}</td>
            <td>${telefoneFormatado}</td>
            <td>${valorImovel}</td>
            <td>${rendaFormatada}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info" onclick="viewSimulacao(${simulacao.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteSimulacao(${simulacao.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Carregar estatísticas do dashboard
function carregarEstatisticas() {
    fetch('/api/simulacoes?pagina=1&limite=1000')
        .then(response => response.json())
        .then(data => {
            // Total de simulações
            const totalSimulacoes = data.total || data.simulacoes.length;
            document.getElementById('total-simulacoes').textContent = totalSimulacoes;
            
            // Simulações hoje
            const hoje = new Date().toISOString().split('T')[0];
            const simulacoesHoje = data.simulacoes.filter(sim => {
                const dataSimulacao = new Date(sim.dataCriacao).toISOString().split('T')[0];
                return dataSimulacao === hoje;
            }).length;
            document.getElementById('simulacoes-hoje').textContent = simulacoesHoje;
            
            // Clientes únicos
            const clientesUnicos = new Set(data.simulacoes.map(sim => sim.cliente?.nome || sim.nome)).size;
            document.getElementById('clientes-unicos').textContent = clientesUnicos;
            
            // Média do valor dos imóveis
            if (data.simulacoes.length > 0) {
                const somaValores = data.simulacoes.reduce((acc, sim) => {
                    const valor = sim.valorImovel || sim.valorCredito || 0;
                    return acc + (typeof valor === 'number' ? valor : 0);
                }, 0);
                const mediaValor = somaValores / data.simulacoes.length;
                document.getElementById('media-imovel').textContent = formatarMoeda(mediaValor);
                
                // Forçar a cor do ícone da casa para laranja
                const iconesCasa = document.querySelectorAll('.stat-card i.fas.fa-home');
                iconesCasa.forEach(icone => {
                    icone.style.color = '#ff9800';
                });
            }
        })
        .catch(error => {
            console.error('Erro ao carregar estatísticas:', error);
        });
}

// Configurar as tabs
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remover classe ativa de todas as tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Adicionar classe ativa à tab clicada
            this.classList.add('active');
            
            // Ocultar todos os conteúdos de tab
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Mostrar o conteúdo relacionado à tab clicada
            const tabName = this.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Carregar dados da tab selecionada
            if (tabName === 'simulacoes') {
                loadSimulacoes(1);
            }
        });
    });
}

// Configurar manipuladores de pesquisa
function setupSearchHandlers() {
    document.getElementById('btn-search-simulacoes').addEventListener('click', function() {
        const filtros = {
            nome: document.getElementById('search-nome').value.trim(),
            rendaMin: document.getElementById('search-renda-min').value ? parseFloat(document.getElementById('search-renda-min').value) : null,
            rendaMax: document.getElementById('search-renda-max').value ? parseFloat(document.getElementById('search-renda-max').value) : null,
            valorMin: document.getElementById('search-valor-min').value ? parseFloat(document.getElementById('search-valor-min').value) : null,
            valorMax: document.getElementById('search-valor-max').value ? parseFloat(document.getElementById('search-valor-max').value) : null
        };
        
        console.log('Filtros aplicados:', filtros);
        filtrarSimulacoes(filtros);
    });
    
    document.getElementById('btn-clear-search').addEventListener('click', function() {
        // Limpar todos os campos de filtro
        document.getElementById('search-nome').value = '';
        document.getElementById('search-renda-min').value = '';
        document.getElementById('search-renda-max').value = '';
        document.getElementById('search-valor-min').value = '';
        document.getElementById('search-valor-max').value = '';
        
        // Recarregar os dados sem filtros
        loadSimulacoes(1);
    });
}

// Configurar eventos de modal
function setupModalEvents() {
    // Modal de confirmação
    document.getElementById('close-confirm-modal').addEventListener('click', function() {
        document.getElementById('confirm-modal').style.display = 'none';
    });
    
    document.getElementById('confirm-cancel').addEventListener('click', function() {
        document.getElementById('confirm-modal').style.display = 'none';
    });
    
    // Modal de simulação
    document.getElementById('close-simulacao-modal').addEventListener('click', function() {
        document.getElementById('simulacao-modal').style.display = 'none';
    });
    
    document.getElementById('close-details').addEventListener('click', function() {
        document.getElementById('simulacao-modal').style.display = 'none';
    });
}

// Carregar simulações
function loadSimulacoes(pagina, limite = 10) {
    fetch(`/api/simulacoes?pagina=${pagina}&limite=${limite}`)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#simulacoes-table tbody');
            tableBody.innerHTML = '';
            
            if (data.simulacoes.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma simulação encontrada</td></tr>';
                return;
            }
            
            data.simulacoes.forEach(simulacao => {
                const row = document.createElement('tr');
                
                // Formatar data
                const data = new Date(simulacao.dataCriacao).toLocaleDateString('pt-BR');
                
                // Formatar número do WhatsApp
                const whatsapp = simulacao.whatsapp ? simulacao.whatsapp.replace(/\D/g, '') : '';
                const whatsappFormatado = whatsapp ? `(${whatsapp.slice(0,2)}) ${whatsapp.slice(2,7)}.${whatsapp.slice(7)}` : '-';
                
                row.innerHTML = renderTableRow(simulacao);
                
                tableBody.appendChild(row);
            });
            
            // Adicionar eventos aos botões
            document.querySelectorAll('.btn-view').forEach(btn => {
                btn.addEventListener('click', function() {
                    const simulacaoId = this.getAttribute('data-id');
                    viewSimulacao(simulacaoId);
                });
            });
            
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', function() {
                    const simulacaoId = this.getAttribute('data-id');
                    confirmDelete('simulacao', simulacaoId);
                });
            });
            
            // Gerar paginação
            generatePagination(data.paginacao, 'simulacoes', loadSimulacoes);
        })
        .catch(error => {
            console.error('Erro ao carregar simulações:', error);
            alert('Erro ao carregar simulações. Verifique o console para mais detalhes.');
        });
}

// Visualizar detalhes da simulação
function viewSimulacao(simulacaoId) {
    fetch(`/api/simulacao/${simulacaoId}`)
        .then(response => response.json())
        .then(data => {
            const detailsContainer = document.getElementById('simulacao-details');
            
            // Formatar data
            const data_criacao = new Date(data.dataCriacao);
            const dataFormatada = data_criacao.toLocaleDateString('pt-BR') + ' ' + data_criacao.toLocaleTimeString('pt-BR');
            
            // Criar HTML com detalhes - Layout melhorado
            let html = `
                <div style="padding: 10px; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 20px;">
                    <div style="background-color: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                        <h4 style="color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 8px; margin-bottom: 15px;">
                            <i class="fas fa-user"></i> Dados do Cliente
                        </h4>
                        <p><strong>Nome:</strong> ${data.cliente.nome || 'Não informado'}</p>
                        <p><strong>Email:</strong> ${data.cliente.email || 'Não informado'}</p>
                        <p><strong>Telefone:</strong> ${data.cliente.telefone || 'Não informado'}</p>
                        <p><strong>Profissão:</strong> ${data.cliente.profissao || 'Não informado'}</p>
                        <p><strong>Renda:</strong> ${data.cliente.renda ? formatarMoeda(data.cliente.renda) : 'Não informado'}</p>
                        <p><strong>Data da Simulação:</strong> ${dataFormatada}</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                        <div style="background-color: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <h4 style="color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 8px; margin-bottom: 15px;">
                                <i class="fas fa-university"></i> Financiamento
                            </h4>
                            <p><strong>Valor do Imóvel:</strong> ${formatarMoeda(data.valorImovel || data.valorCredito)}</p>
                            <p><strong>Valor da Entrada:</strong> ${formatarMoeda(data.valorEntrada || 0)}</p>
                            <p><strong>Valor Financiado:</strong> ${formatarMoeda(data.valorFinanciado || 0)}</p>
                            <p><strong>Taxa de Juros:</strong> ${data.financiamento?.taxaAnual?.toFixed(2) || 11.49}% a.a.</p>
                            <p><strong>Parcela Mensal:</strong> ${formatarMoeda(data.valorParcela || data.financiamento?.valorParcela || 0)}</p>
                            <p><strong>Prazo:</strong> ${data.financiamento?.parcelas || data.prazo || 420} meses</p>
                            <p><strong>Total Financiamento:</strong> ${formatarMoeda(data.valorTotalFinanciamento || data.financiamento?.totalPago || data.financiamento?.total || 0)}</p>
                        </div>
                        <div style="background-color: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <h4 style="color: #FF8C00; border-bottom: 2px solid #FF8C00; padding-bottom: 8px; margin-bottom: 15px;">
                                <i class="fas fa-coins"></i> Consórcio
                            </h4>
                            <p><strong>Valor do Crédito:</strong> ${formatarMoeda(data.valorImovel || data.valorCredito)}</p>
                            <p><strong>Taxa Administrativa:</strong> ${data.consorcio?.taxaAdm?.toFixed(2) || 28.00}%</p>
                            <p><strong>Parcela Mensal:</strong> ${formatarMoeda(data.consorcio?.valorParcela || 0)}</p>
                            <p><strong>Parcela Reduzida:</strong> ${formatarMoeda(data.consorcio?.parcelaReduzida || (data.consorcio?.valorParcela ? data.consorcio.valorParcela / 2 : 0))}</p>
                            <p><strong>Prazo:</strong> ${data.consorcio?.parcelas || 240} meses</p>
                            <p><strong>Total Consórcio:</strong> ${formatarMoeda(data.valorTotalConsorcio || data.consorcio?.totalPago || data.consorcio?.total || 0)}</p>
                        </div>
                    </div>
                    
                    <div style="background-color: #ff8c00; color: white; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <h4 style="margin-bottom: 10px; color: white;">
                            <i class="fas fa-chart-line"></i> Economia Total
                        </h4>
                        <p style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">
                            ${formatarMoeda(data.economiaTotal || 0)}
                        </p>
                        <p style="font-size: 16px; margin-bottom: 0;">
                            ${calcularPorcentagemEconomia(data)}% de economia
                        </p>
                    </div>
                </div>
            `;
            
            detailsContainer.innerHTML = html;
            
            // Configurar botão para ver PDF
            document.getElementById('view-pdf').onclick = function() {
                // Verificar se existe o caminho do PDF no objeto data
                const pdfUrl = data.caminhoArquivoPDF || data.url || `/pdfs/simulacao_${simulacaoId}.pdf`;
                console.log("Tentando abrir PDF:", pdfUrl);
                window.open(pdfUrl, '_blank');
            };
            
            // Exibir modal
            document.getElementById('simulacao-modal').style.display = 'block';
        })
        .catch(error => {
            console.error('Erro ao carregar detalhes da simulação:', error);
            alert('Erro ao carregar detalhes da simulação. Verifique o console para mais detalhes.');
        });
}

// Função auxiliar para calcular porcentagem de economia
function calcularPorcentagemEconomia(data) {
    // Obter os valores totais
    const totalFinanciamento = data.valorTotalFinanciamento || data.financiamento?.totalPago || data.financiamento?.total || 0;
    const totalConsorcio = data.valorTotalConsorcio || data.consorcio?.totalPago || data.consorcio?.total || 0;
    
    // Se um dos valores for zero, não há economia
    if (totalFinanciamento === 0 || totalConsorcio === 0) return 0;
    
    // Calcular a porcentagem
    const economia = totalFinanciamento - totalConsorcio;
    const porcentagem = (economia / totalFinanciamento) * 100;
    
    return porcentagem.toFixed(2);
}

// Confirmar exclusão
function confirmDelete(tipo, id) {
    const modal = document.getElementById('confirm-modal');
    const mensagem = document.getElementById('confirm-message');
    const btnDelete = document.getElementById('confirm-delete');
    
    if (tipo === 'simulacao') {
        mensagem.textContent = `Tem certeza que deseja excluir a simulação ${id}? Esta ação não pode ser desfeita.`;
        
        btnDelete.onclick = function() {
            deleteSimulacao(id);
            modal.style.display = 'none';
        };
    }
    
    modal.style.display = 'block';
}

// Excluir simulação
function deleteSimulacao(id) {
    fetch(`/api/simulacao/${id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Simulação excluída com sucesso!');
            loadSimulacoes(1); // Recarregar lista
        } else {
            alert('Erro ao excluir simulação: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Erro ao excluir simulação:', error);
        alert('Erro ao excluir simulação. Verifique o console para mais detalhes.');
    });
}

// Filtrar simulações
function filtrarSimulacoes(filtros) {
    // Adicionar query string para os filtros
    let url = '/api/simulacoes?pagina=1&limite=10';
    
    if (filtros.nome) {
        url += `&nome=${encodeURIComponent(filtros.nome)}`;
    }
    
    if (filtros.rendaMin !== null) {
        url += `&rendaMin=${filtros.rendaMin}`;
    }
    
    if (filtros.rendaMax !== null) {
        url += `&rendaMax=${filtros.rendaMax}`;
    }
    
    if (filtros.valorMin !== null) {
        url += `&valorMin=${filtros.valorMin}`;
    }
    
    if (filtros.valorMax !== null) {
        url += `&valorMax=${filtros.valorMax}`;
    }
    
    // Implementação no lado do cliente caso a API não suporte filtros
    fetch(url)
        .then(response => response.json())
        .then(data => {
            let simulacoesFiltradas = data.simulacoes;
            
            // Filtragem no cliente se necessário (caso o backend não suporte)
            if (filtros.nome) {
                const termoBusca = filtros.nome.toLowerCase();
                simulacoesFiltradas = simulacoesFiltradas.filter(s => 
                    s.cliente.nome.toLowerCase().includes(termoBusca)
                );
            }
            
            if (filtros.rendaMin !== null) {
                simulacoesFiltradas = simulacoesFiltradas.filter(s => 
                    s.cliente.renda >= filtros.rendaMin
                );
            }
            
            if (filtros.rendaMax !== null) {
                simulacoesFiltradas = simulacoesFiltradas.filter(s => 
                    s.cliente.renda <= filtros.rendaMax
                );
            }
            
            if (filtros.valorMin !== null) {
                simulacoesFiltradas = simulacoesFiltradas.filter(s => 
                    s.valorImovel >= filtros.valorMin
                );
            }
            
            if (filtros.valorMax !== null) {
                simulacoesFiltradas = simulacoesFiltradas.filter(s => 
                    s.valorImovel <= filtros.valorMax
                );
            }
            
            // Exibir resultados filtrados
            exibirResultadosFiltrados(simulacoesFiltradas);
        })
        .catch(error => {
            console.error('Erro ao filtrar simulações:', error);
            alert('Erro ao filtrar simulações. Verifique o console para mais detalhes.');
        });
}

// Exibir resultados filtrados
function exibirResultadosFiltrados(simulacoes) {
    const tableBody = document.querySelector('#simulacoes-table tbody');
    tableBody.innerHTML = '';
    
    if (simulacoes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma simulação encontrada com os filtros aplicados</td></tr>';
        return;
    }
    
    simulacoes.forEach(simulacao => {
        const row = document.createElement('tr');
        
        // Formatar data
        const data = new Date(simulacao.dataCriacao).toLocaleDateString('pt-BR');
        
        // Formatar número do WhatsApp
        const whatsapp = simulacao.whatsapp ? simulacao.whatsapp.replace(/\D/g, '') : '';
        const whatsappFormatado = whatsapp ? `(${whatsapp.slice(0,2)}) ${whatsapp.slice(2,7)}.${whatsapp.slice(7)}` : '-';
        
        row.innerHTML = renderTableRow(simulacao);
        
        tableBody.appendChild(row);
    });
    
    // Adicionar eventos aos botões
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', function() {
            const simulacaoId = this.getAttribute('data-id');
            viewSimulacao(simulacaoId);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const simulacaoId = this.getAttribute('data-id');
            confirmDelete('simulacao', simulacaoId);
        });
    });
}

// Função auxiliar para formatar moeda
function formatarMoeda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) {
        valor = 0;
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Gerar paginação
function generatePagination(paginacao, targetId, loadFunction) {
    const paginationContainer = document.getElementById(`${targetId}-pagination`);
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    const totalPages = paginacao?.totalPaginas || 1;
    const currentPage = paginacao?.pagina || 1;
    
    if (totalPages <= 1) return;
    
    // Botão para primeira página
    if (currentPage > 1) {
        const firstPageBtn = document.createElement('button');
        firstPageBtn.innerHTML = '&laquo;';
        firstPageBtn.addEventListener('click', () => loadFunction(1));
        paginationContainer.appendChild(firstPageBtn);
    }
    
    // Botão para página anterior
    if (currentPage > 1) {
        const prevPageBtn = document.createElement('button');
        prevPageBtn.innerHTML = '&lt;';
        prevPageBtn.addEventListener('click', () => loadFunction(currentPage - 1));
        paginationContainer.appendChild(prevPageBtn);
    }
    
    // Botões de páginas (mostrar 5 páginas ao redor da atual)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        
        pageBtn.addEventListener('click', () => loadFunction(i));
        paginationContainer.appendChild(pageBtn);
    }
    
    // Botão para próxima página
    if (currentPage < totalPages) {
        const nextPageBtn = document.createElement('button');
        nextPageBtn.innerHTML = '&gt;';
        nextPageBtn.addEventListener('click', () => loadFunction(currentPage + 1));
        paginationContainer.appendChild(nextPageBtn);
    }
    
    // Botão para última página
    if (currentPage < totalPages) {
        const lastPageBtn = document.createElement('button');
        lastPageBtn.innerHTML = '&raquo;';
        lastPageBtn.addEventListener('click', () => loadFunction(totalPages));
        paginationContainer.appendChild(lastPageBtn);
    }
} 