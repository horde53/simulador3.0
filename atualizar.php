<?php
// Script para atualizar e limpar o cache no servidor
header('Content-Type: text/plain');

echo "Iniciando atualização do sistema...\n";

// Limpar o cache do navegador através de headers
echo "Configurando headers para limpar cache...\n";
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Inserir conteúdo nos arquivos para forçar atualização
$arquivos_js = [
    'versoes.js' => '// Definições globais para cálculos
const CONFIG_FINANCIAMENTO = {
    PRAZO_MESES: 420, // 35 anos = 420 meses (FIXADO)
    TAXA_JUROS_ANUAL: 0.1149, // 11.49% ao ano (FIXADO)
    TEXTO_PRAZO: "420 meses (35 anos)"
};

const CONFIG_CONSORCIO = {
    PRAZO_MESES: 240, // 20 anos = 240 meses (FIXADO) 
    TAXA_ADMIN: 0.28, // 28% taxa administrativa (FIXADO)
    TEXTO_PRAZO: "240 meses (20 anos)"
};

// Versão dos scripts para verificar se estão atualizados
const VERSAO_SCRIPTS = "1.2-' . date('YmdHis') . '";

console.log("Configurações globais carregadas - Versão:", VERSAO_SCRIPTS);
console.log("Prazo financiamento:", CONFIG_FINANCIAMENTO.PRAZO_MESES, "meses");
console.log("Prazo consórcio:", CONFIG_CONSORCIO.PRAZO_MESES, "meses");'
];

foreach ($arquivos_js as $arquivo => $conteudo) {
    if (file_put_contents($arquivo, $conteudo)) {
        echo "Arquivo $arquivo atualizado com sucesso!\n";
    } else {
        echo "Erro ao atualizar o arquivo $arquivo!\n";
    }
}

// Verificar arquivo de configurações
if (file_exists('versoes.js')) {
    echo "Arquivo de configurações encontrado!\n";
    
    // Verificar conteúdo do arquivo
    $configContent = file_get_contents('versoes.js');
    if (strpos($configContent, 'PRAZO_MESES: 420') !== false) {
        echo "Configuração de prazo de 420 meses para financiamento encontrada e correta.\n";
    } else {
        echo "ATENÇÃO: Configuração de prazo para financiamento não encontrada ou incorreta!\n";
    }
} else {
    echo "ERRO: Arquivo de configurações não encontrado!\n";
}

// Limpar arquivo de cache específicos se necessário
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPCache limpo com sucesso!\n";
}

// Verificar outros arquivos JavaScript
$files = ['script.js', 'resultado.js', 'app.js'];
foreach ($files as $file) {
    if (file_exists($file)) {
        echo "Arquivo $file encontrado.\n";
        
        // Adicionar marca de tempo no final para forçar recarregamento
        $content = file_get_contents($file);
        $content .= "\n// Última atualização: " . date('Y-m-d H:i:s');
        file_put_contents($file, $content);
        echo "Adicionado timestamp ao arquivo $file para forçar recarregamento.\n";
    } else {
        echo "ATENÇÃO: Arquivo $file não encontrado!\n";
    }
}

// Criar um novo arquivo .htaccess para garantir que o cache está desativado
$htaccess = '# Desativar cache - Atualizado em ' . date('Y-m-d H:i:s') . '
<IfModule mod_headers.c>
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
</IfModule>

# Forçar recarregamento de arquivos JavaScript e CSS
<FilesMatch "\.(js|css)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
</FilesMatch>';

file_put_contents('.htaccess', $htaccess);
echo "Arquivo .htaccess atualizado para desativar cache.\n";

echo "\nAtualização concluída. Os arquivos foram atualizados com sucesso e o cache foi limpo.\n";
echo "Por favor, limpe o cache do seu navegador para garantir que as alterações sejam aplicadas.\n";
echo "Versão do sistema: 1.2 - " . date('Y-m-d H:i:s');
?> 