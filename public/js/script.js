document.addEventListener('DOMContentLoaded', function() {
    console.log("Script.js carregado - verificando configurações globais...");
    
    // Verificar se as configurações globais foram carregadas
    if (typeof CONFIG_FINANCIAMENTO === 'undefined' || typeof CONFIG_CONSORCIO === 'undefined') {
        console.error("ERRO: Configurações globais não encontradas. Carregando valores padrão.");
        // Definir configurações padrão caso o arquivo versoes.js não tenha sido carregado
        window.CONFIG_FINANCIAMENTO = {
            PRAZO_MESES: 420,
            TAXA_JUROS_ANUAL: 0.1149,
            TEXTO_PRAZO: "420 meses (35 anos)"
        };
        
        window.CONFIG_CONSORCIO = {
            PRAZO_MESES: 240,
            TAXA_ADMIN: 0.28,
            TEXTO_PRAZO: "240 meses (20 anos)"
        };
        
        window.VERSAO_SCRIPTS = "1.2-fallback";
        console.log("Configurações padrão carregadas com sucesso.");
    } else {
        console.log("Configurações globais encontradas:", CONFIG_FINANCIAMENTO);
    }
    
    const form = document.getElementById('simulador-form');
    const resultadoDiv = document.getElementById('resultado');
    
    // Aplicar máscaras nos campos monetários
    const camposMoeda = ['input[name="currentRent"]', 'input[name="familyIncome"]', 'input[name="propertyValue"]', 'input[name="downPayment"]', 'input[name="fgts"]'];
    
    camposMoeda.forEach(campo => {
        $(campo).maskMoney({
            prefix: 'R$ ',
            thousands: '.',
            decimal: ',',
            allowZero: true,
            allowNegative: false
        });
    });
    
    // Inicializar os campos monetários
    camposMoeda.forEach(campo => {
        $(campo).maskMoney('mask');
    });
    
    // Inicializar máscaras
    $('[name="whatsapp"]').mask('(00) 00000-0000');
    $('[name="cpf"]').mask('000.000.000-00');
    
    // Inicializar máscaras monetárias
    $('[name="familyIncome"]').maskMoney({
        prefix: 'R$ ',
        thousands: '.',
        decimal: ',',
        allowZero: true,
        allowNegative: false
    });
    
    // Máscara para o WhatsApp
    $('input[name="whatsapp"]').on('input', function() {
        let valor = $(this).val().replace(/\D/g, '');
        if (valor.length > 11) valor = valor.substring(0, 11);
        
        if (valor.length > 2) {
            valor = `(${valor.substring(0, 2)}) ${valor.substring(2)}`;
        }
        if (valor.length > 10) {
            valor = `${valor.substring(0, 10)}-${valor.substring(10)}`;
        }
        
        $(this).val(valor);
    });
    
    // Máscara para o CEP
    $('#cep').on('input', function() {
        let cep = $(this).val().replace(/\D/g, '');
        if (cep.length > 8) cep = cep.substring(0, 8);
        if (cep.length > 5) {
            cep = cep.substring(0, 5) + '-' + cep.substring(5);
        }
        $(this).val(cep);
    });
    
    // Validação e preenchimento automático do CEP
    $('#cep').on('blur', function() {
        const cep = $(this).val().replace(/\D/g, '');
        if (cep.length === 8) {
            fetch(`https://viacep.com.br/ws/${cep}/json/`)
                .then(response => response.json())
                .then(data => {
                    if (!data.erro) {
                        // Preenche os campos de endereço, se existirem
                        $('input[name="address"]').val(`${data.logradouro ? data.logradouro + ', ' : ''}${data.bairro ? data.bairro + ', ' : ''}${data.localidade ? data.localidade + ' - ' : ''}${data.uf ? data.uf : ''}`);
                        // Remove a classe de erro se a busca for bem-sucedida
                        $(this).removeClass('erro');
                    } else {
                        // Adiciona a classe de erro se o CEP for inválido
                        $(this).addClass('erro');
                        alert('CEP não encontrado.');
                    }
                })
                .catch(error => {
                    console.error('Erro ao buscar CEP:', error);
                    $(this).addClass('erro');
                    alert('Erro ao buscar CEP. Verifique sua conexão.');
                });
        } else if (cep.length > 0) {
            // Adiciona classe de erro se o CEP estiver incompleto
            $(this).addClass('erro');
            alert('CEP inválido.');
        }
    });
    
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Verificar se o formulário é válido
        if (!validarFormulario()) {
            return;
        }
        
        // Mostrar loader
        mostrarLoader('Calculando sua simulação...');
        
        // Coletar dados do formulário
        const formData = new FormData(form);
        const dados = {};
        
        formData.forEach((value, key) => {
            // Converter valores monetários para números
            if (['currentRent', 'familyIncome', 'propertyValue', 'downPayment', 'fgts'].includes(key)) {
                dados[key] = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            } else {
                dados[key] = value;
            }
        });
        
        // Calcular resultados localmente
        const resultado = calcularSimulacao(dados);
        
        // Preparar dados para enviar ao servidor
        const dadosServidor = {
            nome: dados.name,
            email: dados.email,
            whatsapp: dados.whatsapp,
            profissao: dados.profession,
            tipoImovel: dados.propertyType,
            aluguel: dados.currentRent,
            renda: dados.familyIncome,
            valorImovel: dados.propertyValue,
            entrada: dados.downPayment,
            fgts: dados.fgts,
            financiamento: resultado.financiamento,
            consorcio: resultado.consorcio
        };
        
        console.log('Enviando dados para o servidor:', dadosServidor);
        
        // Enviar para o servidor gerar o PDF
        fetch('/api/simular', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosServidor)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao processar simulação');
            }
            return response.json();
        })
        .then(data => {
            console.log('Resposta do servidor:', data);
            
            // Esconder loader
            esconderLoader();
            
            if (data.success && data.pdfUrl) {
                // Armazenar dados
                localStorage.setItem('simulacaoResultado', JSON.stringify({
                    cliente: dadosServidor,
                    financiamento: resultado.financiamento,
                    consorcio: resultado.consorcio,
                    pdfUrl: data.pdfUrl
                }));
                
                // Redirecionar para a página de resultados
                window.location.href = `resultado.html?pdf=${encodeURIComponent(data.pdfUrl)}`;
            } else {
                // Mostrar resultados na mesma página
                mostrarResultado(resultado);
                
                // Mostrar mensagem sobre o PDF se houver erro
                if (data.error) {
                    mostrarMensagem('Erro ao gerar PDF: ' + data.error, 'erro');
                }
            }
        })
        .catch(error => {
            console.error('Erro ao enviar simulação:', error);
            esconderLoader();
            mostrarMensagem('Erro ao processar simulação: ' + error.message, 'erro');
            
            // Mostrar resultados mesmo assim
            mostrarResultado(resultado);
        });
    });
    
    function validarFormulario() {
        let valido = true;
        const camposObrigatorios = [
            'name',
            'email',
            'whatsapp',
            'profession',
            'propertyType',
            'familyIncome',
            'propertyValue',
            'cpf'
        ];
        
        // Remover mensagens de erro anteriores
        document.querySelectorAll('.erro-mensagem').forEach(el => el.remove());
        
        camposObrigatorios.forEach(campo => {
            const elemento = document.querySelector(`[name="${campo}"]`);
            const valor = elemento.value.trim();
            
            if (!valor) {
                elemento.classList.add('erro');
                // Adicionar mensagem de erro abaixo do campo
                const mensagemErro = document.createElement('div');
                mensagemErro.className = 'erro-mensagem';
                mensagemErro.style.color = '#ff3b30';
                mensagemErro.style.fontSize = '0.8rem';
                mensagemErro.style.marginTop = '4px';
                mensagemErro.textContent = 'Este campo é obrigatório';
                elemento.parentNode.appendChild(mensagemErro);
                valido = false;
            } else {
                elemento.classList.remove('erro');
                // Validações específicas
                if (campo === 'email' && !validarEmail(valor)) {
                    elemento.classList.add('erro');
                    const mensagemErro = document.createElement('div');
                    mensagemErro.className = 'erro-mensagem';
                    mensagemErro.style.color = '#ff3b30';
                    mensagemErro.style.fontSize = '0.8rem';
                    mensagemErro.style.marginTop = '4px';
                    mensagemErro.textContent = 'Email inválido';
                    elemento.parentNode.appendChild(mensagemErro);
                    valido = false;
                }
                if (campo === 'whatsapp' && !validarWhatsapp(valor)) {
                    elemento.classList.add('erro');
                    const mensagemErro = document.createElement('div');
                    mensagemErro.className = 'erro-mensagem';
                    mensagemErro.style.color = '#ff3b30';
                    mensagemErro.style.fontSize = '0.8rem';
                    mensagemErro.style.marginTop = '4px';
                    mensagemErro.textContent = 'WhatsApp inválido';
                    elemento.parentNode.appendChild(mensagemErro);
                    valido = false;
                }
                if (campo === 'cpf' && !validarCPF(valor)) {
                    elemento.classList.add('erro');
                    const mensagemErro = document.createElement('div');
                    mensagemErro.className = 'erro-mensagem';
                    mensagemErro.style.color = '#ff3b30';
                    mensagemErro.style.fontSize = '0.8rem';
                    mensagemErro.style.marginTop = '4px';
                    mensagemErro.textContent = 'CPF inválido';
                    elemento.parentNode.appendChild(mensagemErro);
                    valido = false;
                }
                // Validar valores monetários
                if (['familyIncome', 'propertyValue', 'downPayment', 'fgts'].includes(campo)) {
                    const valorNumerico = extrairValorMonetario(valor);
                    if (valorNumerico <= 0) {
                        elemento.classList.add('erro');
                        const mensagemErro = document.createElement('div');
                        mensagemErro.className = 'erro-mensagem';
                        mensagemErro.style.color = '#ff3b30';
                        mensagemErro.style.fontSize = '0.8rem';
                        mensagemErro.style.marginTop = '4px';
                        mensagemErro.textContent = 'Valor inválido';
                        elemento.parentNode.appendChild(mensagemErro);
                        valido = false;
                    }
                }
            }
        });
        
        if (!valido) {
            // Rolar até o primeiro campo com erro
            const primeiroErro = document.querySelector('.erro');
            if (primeiroErro) {
                primeiroErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            alert('Por favor, preencha todos os campos corretamente.');
        }
        
        return valido;
    }
    
    // Função auxiliar para validar email
    function validarEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Função auxiliar para validar WhatsApp
    function validarWhatsapp(whatsapp) {
        const numero = whatsapp.replace(/\D/g, '');
        return numero.length >= 10 && numero.length <= 11;
    }
    
    // Função auxiliar para validar CPF
    function validarCPF(cpf) {
        cpf = cpf.replace(/[^\d]/g, '');
        
        if (cpf.length !== 11) return false;
        
        // Verificar se todos os dígitos são iguais
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        // Validar primeiro dígito verificador
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let resto = 11 - (soma % 11);
        let digitoVerificador1 = resto > 9 ? 0 : resto;
        if (digitoVerificador1 !== parseInt(cpf.charAt(9))) return false;
        
        // Validar segundo dígito verificador
        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(cpf.charAt(i)) * (11 - i);
        }
        resto = 11 - (soma % 11);
        let digitoVerificador2 = resto > 9 ? 0 : resto;
        if (digitoVerificador2 !== parseInt(cpf.charAt(10))) return false;
        
        return true;
    }
    
    function calcularSimulacao(dados) {
        // Valores baseados nas tabelas fornecidas
        const valorImovel = dados.propertyValue;
        const valorEntrada = dados.downPayment + dados.fgts;
        
        // FINANCIAMENTO - Usar configurações globais
        const taxaJurosAnual = CONFIG_FINANCIAMENTO.TAXA_JUROS_ANUAL;
        const parcelasFinanciamento = CONFIG_FINANCIAMENTO.PRAZO_MESES;
        
        // Cálculo do financiamento usando taxa de juros
        const taxaMensal = Math.pow(1 + taxaJurosAnual, 1/12) - 1;
        const valorParcelaFinanciamento = (valorImovel - valorEntrada) * (taxaMensal * Math.pow(1 + taxaMensal, parcelasFinanciamento)) / (Math.pow(1 + taxaMensal, parcelasFinanciamento) - 1);
        const totalFinanciamento = valorParcelaFinanciamento * parcelasFinanciamento;
        
        // CONSÓRCIO - Usar configurações globais
        const taxaAdministrativa = CONFIG_CONSORCIO.TAXA_ADMIN;
        const parcelasConsorcio = CONFIG_CONSORCIO.PRAZO_MESES;
        
        // Calcular parcela e total do consórcio
        const valorParcelaConsorcio = (valorImovel * (1 + taxaAdministrativa)) / parcelasConsorcio;
        const totalConsorcio = valorParcelaConsorcio * parcelasConsorcio;
        
        return {
            financiamento: {
                credito: valorImovel, // Usando valor do imóvel diretamente como crédito
                entrada: valorEntrada,
                parcelas: parcelasFinanciamento,
                valorParcela: valorParcelaFinanciamento,
                total: totalFinanciamento,
                taxaAnual: taxaJurosAnual * 100, // em percentual
                prazoAnos: parcelasFinanciamento / 12
            },
            consorcio: {
                credito: valorImovel, // Usando valor do imóvel diretamente como crédito
                entrada: 0, // Consórcio geralmente não tem entrada
                parcelas: parcelasConsorcio,
                valorParcela: valorParcelaConsorcio,
                total: totalConsorcio,
                taxaAdm: taxaAdministrativa * 100, // em percentual
                prazoAnos: parcelasConsorcio / 12
            }
        };
    }
    
    function mostrarResultado(resultado) {
        // Armazenar os dados no localStorage para recuperação futura
        const dadosFormulario = {
            cliente: {
                nome: document.querySelector('input[name="name"]').value,
                email: document.querySelector('input[name="email"]').value,
                whatsapp: document.querySelector('input[name="whatsapp"]').value,
                profissao: document.querySelector('input[name="profession"]').value,
                tipoImovel: document.querySelector('select[name="propertyType"]').value,
                aluguelAtual: extrairValorMonetario(document.querySelector('input[name="currentRent"]').value),
                rendaFamiliar: extrairValorMonetario(document.querySelector('input[name="familyIncome"]').value),
                valorImovel: extrairValorMonetario(document.querySelector('input[name="propertyValue"]').value),
                entrada: extrairValorMonetario(document.querySelector('input[name="downPayment"]').value),
                fgts: extrairValorMonetario(document.querySelector('input[name="fgts"]').value)
            },
            financiamento: resultado.financiamento,
            consorcio: resultado.consorcio
        };
        
        // Debug - verificar valores antes de armazenar
        console.log('Dados coletados:', dadosFormulario);
        
        localStorage.setItem('simulacaoResultado', JSON.stringify(dadosFormulario));
        
        // Codificar os dados para passar pela URL (para casos onde localStorage não funciona)
        const dadosEncoded = btoa(JSON.stringify(dadosFormulario));
        
        // Redirecionar para a página de resultados com os dados na URL
        window.location.href = `resultado.html?dados=${dadosEncoded}`;
        
        // Atualizar os elementos com os resultados
        const valorImovel = resultado.financiamento.credito;
        const valorEntrada = resultado.financiamento.entrada;
        const valorParcelaFinanciamento = resultado.financiamento.valorParcela;
        const totalFinanciamento = resultado.financiamento.total;
        
        document.getElementById('financing-credit').textContent = formatarNumero(valorImovel);
        document.getElementById('financing-down-payment').textContent = formatarNumero(valorEntrada);
        document.getElementById('financing-rate').textContent = '11,49% a.a.';
        document.getElementById('financing-term').textContent = '35 anos';
        document.getElementById('financing-installments').textContent = `420x de ${formatarNumero(valorParcelaFinanciamento)}`;
        document.getElementById('financing-total').textContent = formatarNumero(totalFinanciamento + valorEntrada);
    }
    
    // Função auxiliar para extrair o valor monetário de uma string formatada
    function extrairValorMonetario(str) {
        if (!str) return 0;
        // Remove caracteres não numéricos, exceto vírgula ou ponto decimal
        return parseFloat(str.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
    }
    
    function formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }
    
    function formatarNumero(valor) {
        return valor.toLocaleString('pt-BR');
    }
});

// Adicionar estilos para inputs com erro
document.head.insertAdjacentHTML('beforeend', `
    <style>
        input.erro, select.erro {
            border-color: #ff3b30 !important;
            box-shadow: 0 0 0 2px rgba(255, 59, 48, 0.2) !important;
        }
    </style>
`);

// Função para mostrar o loader
function mostrarLoader(mensagem) {
    // Verificar se já existe um loader
    let loader = document.getElementById('simulacao-loader');
    
    if (!loader) {
        // Criar elemento loader se não existir
        loader = document.createElement('div');
        loader.id = 'simulacao-loader';
        loader.className = 'simulacao-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <div class="loader-mensagem">${mensagem || 'Carregando...'}</div>
        `;
        document.body.appendChild(loader);
        
        // Adicionar estilo do loader se necessário
        if (!document.getElementById('loader-style')) {
            const style = document.createElement('style');
            style.id = 'loader-style';
            style.textContent = `
                .simulacao-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    color: white;
                }
                .loader-spinner {
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #3498db;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    animation: spin 2s linear infinite;
                    margin-bottom: 15px;
                }
                .loader-mensagem {
                    font-size: 18px;
                    text-align: center;
                    max-width: 80%;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        // Atualizar mensagem se o loader já existir
        const mensagemElement = loader.querySelector('.loader-mensagem');
        if (mensagemElement && mensagem) {
            mensagemElement.textContent = mensagem;
        }
    }
    
    // Mostrar o loader
    loader.style.display = 'flex';
}

// Função para esconder o loader
function esconderLoader() {
    const loader = document.getElementById('simulacao-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Função para mostrar mensagem
function mostrarMensagem(texto, tipo) {
    // Verificar se já existe um elemento de mensagem
    let mensagem = document.querySelector('.simulacao-mensagem');
    
    if (!mensagem) {
        // Criar elemento de mensagem
        mensagem = document.createElement('div');
        mensagem.className = `simulacao-mensagem ${tipo || 'info'}`;
        
        // Adicionar estilo da mensagem
        if (!document.getElementById('mensagem-style')) {
            const style = document.createElement('style');
            style.id = 'mensagem-style';
            style.textContent = `
                .simulacao-mensagem {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 9998;
                    transition: transform 0.3s, opacity 0.3s;
                    transform: translateY(-100px);
                    opacity: 0;
                    max-width: 300px;
                }
                .simulacao-mensagem.info {
                    background: #3498db;
                    color: white;
                }
                .simulacao-mensagem.sucesso {
                    background: #2ecc71;
                    color: white;
                }
                .simulacao-mensagem.erro {
                    background: #e74c3c;
                    color: white;
                }
                .simulacao-mensagem.visivel {
                    transform: translateY(0);
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(mensagem);
    }
    
    // Atualizar texto e tipo da mensagem
    mensagem.textContent = texto;
    mensagem.className = `simulacao-mensagem ${tipo || 'info'}`;
    
    // Mostrar a mensagem
    setTimeout(() => {
        mensagem.classList.add('visivel');
    }, 10);
    
    // Esconder depois de 5 segundos
    setTimeout(() => {
        mensagem.classList.remove('visivel');
    }, 5000);
}

// Função para mostrar popup personalizado
function mostrarPopup(titulo, mensagem, botoes = []) {
    // Verificar se já existe um popup
    let popup = document.getElementById('simulacao-popup');
    
    if (!popup) {
        // Criar elemento popup se não existir
        popup = document.createElement('div');
        popup.id = 'simulacao-popup';
        popup.className = 'simulacao-popup';
        
        // Adicionar estilo do popup se necessário
        if (!document.getElementById('popup-style')) {
            const style = document.createElement('style');
            style.id = 'popup-style';
            style.textContent = `
                .simulacao-popup {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                .popup-conteudo {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    width: 90%;
                    max-width: 500px;
                    padding: 20px;
                    position: relative;
                    animation: popupEntrada 0.3s ease-out forwards;
                }
                @keyframes popupEntrada {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .popup-titulo {
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #333;
                }
                .popup-mensagem {
                    font-size: 1rem;
                    line-height: 1.5;
                    margin-bottom: 20px;
                    color: #555;
                }
                .popup-botoes {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .popup-botao {
                    padding: 8px 16px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .popup-botao-primario {
                    background: var(--cor-primaria, #007bff);
                    color: white;
                }
                .popup-botao-secundario {
                    background: #f2f2f2;
                    color: #333;
                }
                .popup-botao:hover {
                    opacity: 0.9;
                }
                .popup-fechar {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #999;
                }
                .popup-fechar:hover {
                    color: #333;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Limpar conteúdo existente
    popup.innerHTML = '';
    
    // Criar conteúdo do popup
    const conteudo = document.createElement('div');
    conteudo.className = 'popup-conteudo';
    
    // Adicionar título
    const tituloElement = document.createElement('div');
    tituloElement.className = 'popup-titulo';
    tituloElement.textContent = titulo;
    conteudo.appendChild(tituloElement);
    
    // Botão fechar
    const botaoFechar = document.createElement('button');
    botaoFechar.className = 'popup-fechar';
    botaoFechar.innerHTML = '&times;';
    botaoFechar.onclick = function() {
        fecharPopup();
    };
    conteudo.appendChild(botaoFechar);
    
    // Adicionar mensagem
    const mensagemElement = document.createElement('div');
    mensagemElement.className = 'popup-mensagem';
    mensagemElement.innerHTML = mensagem;
    conteudo.appendChild(mensagemElement);
    
    // Adicionar botões
    const botoesContainer = document.createElement('div');
    botoesContainer.className = 'popup-botoes';
    
    // Se não houver botões definidos, adicionar um botão OK padrão
    if (botoes.length === 0) {
        botoes.push({
            texto: 'OK',
            primario: true,
            onClick: () => fecharPopup()
        });
    }
    
    // Adicionar botões fornecidos
    botoes.forEach(botao => {
        const btn = document.createElement('button');
        btn.className = `popup-botao ${botao.primario ? 'popup-botao-primario' : 'popup-botao-secundario'}`;
        btn.textContent = botao.texto;
        btn.onclick = function() {
            if (botao.onClick) {
                botao.onClick();
            }
        };
        botoesContainer.appendChild(btn);
    });
    
    conteudo.appendChild(botoesContainer);
    popup.appendChild(conteudo);
    document.body.appendChild(popup);
    
    // Função para fechar o popup
    function fecharPopup() {
        popup.style.display = 'none';
        // Opcional: remover o popup do DOM após fechamento
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 300);
    }
    
    return {
        fechar: fecharPopup
    };
}

// Exemplos de uso da função mostrarPopup:
// 
// 1. Popup simples com botão OK padrão:
// mostrarPopup('Simulação Concluída', 'Sua simulação foi realizada com sucesso!');
//
// 2. Popup com botões personalizados:
// mostrarPopup('Confirmar Dados', 'Deseja prosseguir com os dados informados?', [
//     {
//         texto: 'Cancelar',
//         primario: false,
//         onClick: () => {
//             // Ação ao cancelar
//         }
//     },
//     {
//         texto: 'Confirmar',
//         primario: true,
//         onClick: () => {
//             // Ação ao confirmar
//             enviarDados();
//         }
//     }
// ]);
//
// 3. Popup com formulário HTML:
// mostrarPopup('Entre em contato', `
//     <form id="formContato">
//         <div class="form-group">
//             <label for="nome">Nome:</label>
//             <input type="text" id="nome" class="form-control" required>
//         </div>
//         <div class="form-group">
//             <label for="email">Email:</label>
//             <input type="email" id="email" class="form-control" required>
//         </div>
//     </form>
// `, [
//     {
//         texto: 'Fechar',
//         primario: false
//     },
//     {
//         texto: 'Enviar',
//         primario: true,
//         onClick: () => {
//             const form = document.getElementById('formContato');
//             if (form.checkValidity()) {
//                 // Processar formulário
//             } else {
//                 form.reportValidity();
//             }
//         }
//     }
// ]); 