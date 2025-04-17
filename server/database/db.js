const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

// Caminho para o banco de dados SQLite (armazenado na pasta storage)
const dbPath = path.join(__dirname, '../../storage/database.sqlite');

// Conexão com o banco de dados
let db = null;

// Inicializar banco de dados
async function initDatabase() {
    try {
        // Certifique-se de que o diretório existe
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Abrir a conexão com o banco de dados
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log(`Banco de dados SQLite conectado em: ${dbPath}`);
        
        // Criar as tabelas necessárias
        await criarTabelas();
        
        return true;
    } catch (error) {
        console.error('Erro ao inicializar o banco de dados:', error);
        return false;
    }
}

// Criar tabelas necessárias
async function criarTabelas() {
    try {
        // Tabela de clientes
        await db.exec(`
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                telefone TEXT NOT NULL,
                profissao TEXT,
                renda REAL,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Tabela clientes verificada/criada com sucesso');
        
        // Tabela de simulações
        await db.exec(`
            CREATE TABLE IF NOT EXISTS simulacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER NOT NULL,
                valor_imovel REAL NOT NULL,
                valor_entrada REAL NOT NULL,
                valor_financiado REAL NOT NULL,
                prazo INTEGER NOT NULL,
                valor_parcela_financiamento REAL NOT NULL,
                valor_parcela_consorcio REAL NOT NULL,
                total_financiamento REAL NOT NULL,
                total_consorcio REAL NOT NULL,
                economia_total REAL NOT NULL,
                caminho_arquivo_pdf TEXT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
            )
        `);
        
        console.log('Tabela simulacoes verificada/criada com sucesso');
        
        return true;
    } catch (error) {
        console.error('Erro ao criar tabelas:', error);
        return false;
    }
}

// Salvar uma nova simulação
async function salvarSimulacao(dados) {
    try {
        // Início da transação
        await db.exec('BEGIN TRANSACTION');
        
        // Verifica se o cliente já existe (pelo email)
        const cliente = await db.get(
            'SELECT id FROM clientes WHERE email = ?',
            [dados.cliente.email]
        );
        
        let clienteId;
        
        if (cliente) {
            // Atualiza o cliente existente
            clienteId = cliente.id;
            await db.run(
                `UPDATE clientes 
                SET nome = ?, telefone = ?, profissao = ?, renda = ? 
                WHERE id = ?`,
                [
                    dados.cliente.nome,
                    dados.cliente.telefone,
                    dados.cliente.profissao || null,
                    dados.cliente.renda || null,
                    clienteId
                ]
            );
            console.log(`Cliente atualizado com ID: ${clienteId}`);
        } else {
            // Insere um novo cliente
            const result = await db.run(
                `INSERT INTO clientes (nome, email, telefone, profissao, renda) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    dados.cliente.nome,
                    dados.cliente.email,
                    dados.cliente.telefone,
                    dados.cliente.profissao || null,
                    dados.cliente.renda || null
                ]
            );
            clienteId = result.lastID;
            console.log(`Novo cliente inserido com ID: ${clienteId}`);
        }
        
        // Insere a simulação
        const valorImovel = dados.valorCredito || dados.valorImovel;
        const valorEntrada = dados.entrada || dados.valorEntrada;
        const valorFinanciado = dados.valorFinanciado;
        const prazo = dados.prazo || dados.financiamento.parcelas;
        
        const simulacaoResult = await db.run(
            `INSERT INTO simulacoes (
                cliente_id, valor_imovel, valor_entrada, valor_financiado, 
                prazo, valor_parcela_financiamento, valor_parcela_consorcio,
                total_financiamento, total_consorcio, economia_total, caminho_arquivo_pdf
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clienteId,
                valorImovel,
                valorEntrada,
                valorFinanciado,
                prazo,
                dados.financiamento.valorParcela,
                dados.consorcio.valorParcela,
                dados.financiamento.totalPago,
                dados.consorcio.totalPago,
                dados.financiamento.totalPago - dados.consorcio.totalPago,
                dados.caminhoArquivoPDF
            ]
        );
        
        // Commit da transação
        await db.exec('COMMIT');
        
        console.log(`Nova simulação inserida com ID: ${simulacaoResult.lastID}`);
        
        return {
            success: true,
            simulacaoId: simulacaoResult.lastID,
            clienteId
        };
    } catch (error) {
        // Rollback em caso de erro
        await db.exec('ROLLBACK');
        
        console.error('Erro ao salvar simulação:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Obter uma simulação por ID
async function obterSimulacaoPorId(id) {
    try {
        const simulacao = await db.get(
            `SELECT s.*, c.nome, c.email, c.telefone, c.profissao, c.renda
            FROM simulacoes s
            INNER JOIN clientes c ON s.cliente_id = c.id
            WHERE s.id = ?`,
            [id]
        );
        
        if (!simulacao) {
            return {
                success: false,
                error: 'Simulação não encontrada'
            };
        }
        
        // Formata os dados para retornar no formato esperado
        return {
            success: true,
            id: simulacao.id,
            cliente: {
                id: simulacao.cliente_id,
                nome: simulacao.nome,
                email: simulacao.email,
                telefone: simulacao.telefone,
                profissao: simulacao.profissao,
                renda: simulacao.renda
            },
            valorImovel: simulacao.valor_imovel,
            valorEntrada: simulacao.valor_entrada,
            valorFinanciado: simulacao.valor_financiado,
            valorCredito: simulacao.valor_imovel,
            prazo: simulacao.prazo,
            financiamento: {
                valorParcela: simulacao.valor_parcela_financiamento,
                totalPago: simulacao.total_financiamento
            },
            consorcio: {
                valorParcela: simulacao.valor_parcela_consorcio,
                totalPago: simulacao.total_consorcio
            },
            economiaTotal: simulacao.economia_total,
            caminhoArquivoPDF: simulacao.caminho_arquivo_pdf,
            dataCriacao: simulacao.data_criacao
        };
    } catch (error) {
        console.error('Erro ao obter simulação:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Listar todas as simulações com paginação
async function listarSimulacoes(pagina = 1, limite = 10, campo = 'nome', filtro = '') {
    try {
        const offset = (pagina - 1) * limite;
        
        // Condição de filtro de cliente
        let whereClause = '';
        let params = [];
        
        if (filtro) {
            // Se o campo for 'nome', filtra pelo nome do cliente
            if (campo === 'nome') {
                whereClause = 'WHERE c.nome LIKE ?';
                params.push(`%${filtro}%`);
            } else if (campo === 'email') {
                whereClause = 'WHERE c.email LIKE ?';
                params.push(`%${filtro}%`);
            } else if (campo === 'telefone') {
                whereClause = 'WHERE c.telefone LIKE ?';
                params.push(`%${filtro}%`);
            } else if (campo === 'renda') {
                // Filtrar por faixa de renda
                const rendaMatch = filtro.match(/(\d+)\s*-\s*(\d+)/);
                if (rendaMatch) {
                    whereClause = 'WHERE c.renda BETWEEN ? AND ?';
                    params.push(parseFloat(rendaMatch[1]), parseFloat(rendaMatch[2]));
                } else {
                    whereClause = 'WHERE c.renda = ?';
                    params.push(parseFloat(filtro));
                }
            } else if (campo === 'data') {
                whereClause = 'WHERE date(s.data_criacao) = ?';
                params.push(filtro); // Formato exato para data
            } else if (campo === 'valorCredito') {
                // Filtrar por faixa de valor de crédito
                const valorMatch = filtro.match(/(\d+)\s*-\s*(\d+)/);
                if (valorMatch) {
                    whereClause = 'WHERE s.valor_imovel BETWEEN ? AND ?';
                    params.push(parseFloat(valorMatch[1]), parseFloat(valorMatch[2]));
                } else {
                    whereClause = 'WHERE s.valor_imovel = ?';
                    params.push(parseFloat(filtro));
                }
            } else {
                whereClause = 'WHERE c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?';
                params = [`%${filtro}%`, `%${filtro}%`, `%${filtro}%`];
            }
        }
        
        // Consulta paginada - incluindo a renda do cliente
        const simulacoes = await db.all(
            `SELECT s.*, c.nome, c.email, c.telefone, c.profissao, c.renda
            FROM simulacoes s
            INNER JOIN clientes c ON s.cliente_id = c.id
            ${whereClause}
            ORDER BY s.data_criacao DESC
            LIMIT ? OFFSET ?`,
            [...params, limite, offset]
        );
        
        // Consulta para contar o total
        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM simulacoes s
            INNER JOIN clientes c ON s.cliente_id = c.id
            ${whereClause}`;
        
        const totalRow = await db.get(countQuery, params);
        const total = totalRow.total;
        
        // Formatar dados para retorno
        const simulacoesFormatadas = simulacoes.map(simulacao => ({
            id: simulacao.id,
            cliente: {
                id: simulacao.cliente_id,
                nome: simulacao.nome,
                email: simulacao.email,
                telefone: simulacao.telefone,
                renda: simulacao.renda,
                profissao: simulacao.profissao
            },
            valorImovel: simulacao.valor_imovel,
            valorEntrada: simulacao.valor_entrada,
            valorFinanciado: simulacao.valor_financiado,
            prazo: simulacao.prazo,
            economiaTotal: simulacao.economia_total,
            dataCriacao: simulacao.data_criacao
        }));
        
        return {
            success: true,
            simulacoes: simulacoesFormatadas,
            total: total,
            pagina: parseInt(pagina),
            limite: parseInt(limite),
            totalPaginas: Math.ceil(total / limite)
        };
    } catch (error) {
        console.error('Erro ao listar simulações:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Excluir uma simulação
async function excluirSimulacao(id) {
    try {
        // Primeiro obter o caminho do PDF para excluí-lo
        const simulacao = await db.get(
            'SELECT caminho_arquivo_pdf FROM simulacoes WHERE id = ?',
            [id]
        );
        
        if (!simulacao) {
            return {
                success: false,
                error: 'Simulação não encontrada'
            };
        }
        
        const caminhoArquivoPDF = simulacao.caminho_arquivo_pdf;
        console.log('Caminho do PDF no banco de dados:', caminhoArquivoPDF);
        
        // Excluir o arquivo PDF se existir
        if (caminhoArquivoPDF) {
            // Tratamento específico para caminhos que começam com /pdfs/
            let pdfPath;
            if (caminhoArquivoPDF.startsWith('/pdfs/')) {
                // O caminho é relativo à pasta storage/pdfs
                const nomeArquivo = path.basename(caminhoArquivoPDF);
                pdfPath = path.join(__dirname, '../../storage/pdfs', nomeArquivo);
            } else {
                // Outras situações - manter o comportamento anterior
                pdfPath = caminhoArquivoPDF.startsWith('/') 
                    ? path.join(__dirname, '../..', caminhoArquivoPDF.substring(1))
                    : path.join(__dirname, '../..', caminhoArquivoPDF);
            }
            
            console.log('Tentando excluir PDF no caminho:', pdfPath);
            
            if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath);
                console.log(`Sucesso! Arquivo PDF excluído: ${pdfPath}`);
            } else {
                console.log(`Erro: Arquivo PDF não encontrado no caminho: ${pdfPath}`);
            }
        } else {
            console.log('Nenhum caminho de PDF associado a esta simulação');
        }
        
        // Agora excluir o registro do banco de dados
        const result = await db.run(
            'DELETE FROM simulacoes WHERE id = ?',
            [id]
        );
        
        if (result.changes === 0) {
            return {
                success: false,
                error: 'Simulação não encontrada'
            };
        }
        
        return {
            success: true,
            message: 'Simulação excluída com sucesso'
        };
    } catch (error) {
        console.error('Erro ao excluir simulação:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Listar todos os clientes com paginação e filtro
async function listarClientes(pagina = 1, limite = 10, filtro = '') {
    try {
        const offset = (pagina - 1) * limite;
        
        // Condição de filtro
        let whereClause = '';
        let params = [];
        
        if (filtro) {
            whereClause = 'WHERE c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?';
            params = [`%${filtro}%`, `%${filtro}%`, `%${filtro}%`];
        }
        
        // Consulta paginada com contagem de simulações
        const clientes = await db.all(
            `SELECT c.*, 
                COUNT(s.id) AS total_simulacoes,
                MAX(s.data_criacao) AS ultima_simulacao
            FROM clientes c
            LEFT JOIN simulacoes s ON c.id = s.cliente_id
            ${whereClause}
            GROUP BY c.id
            ORDER BY c.nome
            LIMIT ? OFFSET ?`,
            [...params, limite, offset]
        );
        
        // Consulta para contar o total
        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM clientes c
            ${whereClause}`;
        
        const totalRow = await db.get(countQuery, params);
        const total = totalRow.total;
        
        return {
            success: true,
            clientes,
            total: total,
            pagina: parseInt(pagina),
            limite: parseInt(limite),
            totalPaginas: Math.ceil(total / limite)
        };
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Verificar status do banco de dados
async function verificarStatusBanco() {
    try {
        if (!db) {
            return {
                conectado: false,
                mensagem: 'Banco de dados não inicializado'
            };
        }
        
        // Tenta executar uma consulta simples para verificar a conexão
        await db.get('SELECT 1');
        
        return {
            conectado: true,
            mensagem: 'Conexão com o banco de dados está operacional'
        };
    } catch (error) {
        console.error('Erro ao verificar status do banco:', error);
        
        return {
            conectado: false,
            mensagem: error.message
        };
    }
}

module.exports = {
    initDatabase,
    salvarSimulacao,
    obterSimulacaoPorId,
    listarSimulacoes,
    excluirSimulacao,
    listarClientes,
    verificarStatusBanco,
    db // Exporta a conexão para uso em outros lugares
}; 