document.addEventListener('DOMContentLoaded', function() {
  // Estado da aplicação
  const state = {
    funcionarios: [],
    unidades: [],
    setores: [],
    filteredFuncionarios: [],
    selectedFuncionario: null,
    filters: {
      unidade: '',
      setor: '',
      situacao: '',
      search: ''
    },
    pagination: {
      currentPage: 1,
      totalPages: 1,
      limit: 10,
      total: 0 // Total de registros para melhor controle
    },
    loading: false // Indicador de carregamento
  };

  // Elementos DOM
  const elements = {
    // Tabela de funcionários
    funcionariosTable: document.getElementById('funcionariosTable'),
    funcionariosTableBody: document.getElementById('funcionariosTableBody'),
    
    // Paginação
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    paginationInfo: document.getElementById('paginationInfo'),
    
    // Busca e filtros
    searchInput: document.getElementById('searchInput'),
    btnSearch: document.getElementById('btnSearch'),
    unidadeFilter: document.getElementById('unidadeFilter'),
    setorFilter: document.getElementById('setorFilter'),
    situacaoFilter: document.getElementById('situacaoFilter'),
    
    // Modal de detalhes
    funcionarioModal: document.getElementById('funcionarioModal'),
    modalTitle: document.getElementById('modalTitle'),
    closeModal: document.getElementById('closeModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    
    // Campos de perfil do funcionário
    avatarInitials: document.getElementById('avatarInitials'),
    profileNome: document.getElementById('profileNome'),
    profileCargo: document.getElementById('profileCargo'),
    profileEmpresa: document.getElementById('profileEmpresa'),
    profileStatus: document.getElementById('profileStatus'),
    
    // Abas
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Container de toasts
    toastContainer: document.getElementById('toastContainer')
  };

  // Mapeadores para exibições legíveis de códigos internos
  const mappers = {
    sexo: {
      1: 'Masculino',
      2: 'Feminino'
    },
    estadoCivil: {
      1: 'Solteiro(a)',
      2: 'Casado(a)',
      3: 'Divorciado(a)',
      4: 'Viúvo(a)',
      5: 'Separado(a)',
      6: 'União Estável'
    },
    tipoContratacao: {
      1: 'CLT',
      2: 'Terceirizado',
      3: 'Autônomo',
      4: 'Estágio',
      5: 'Jovem Aprendiz',
      6: 'PJ'
    },
    escolaridade: {
      1: 'Fundamental Incompleto',
      2: 'Fundamental Completo',
      3: 'Médio Incompleto',
      4: 'Médio Completo',
      5: 'Superior Incompleto',
      6: 'Superior Completo',
      7: 'Pós-graduação',
      8: 'Mestrado',
      9: 'Doutorado'
    },
    cor: {
      1: 'Branca',
      2: 'Preta',
      3: 'Parda',
      4: 'Amarela',
      5: 'Indígena',
      6: 'Não Informada'
    },
    regimeRevezamento: {
      1: 'Não',
      2: 'Sim'
    },
    turnoTrabalho: {
      1: 'Diurno',
      2: 'Noturno',
      3: 'Revezamento'
    }
  };

  // Inicia a aplicação
  init();

  function init() {
    console.log('Inicializando aplicação de funcionários');
    
    // Carregar funcionários iniciais
    loadFuncionarios();
    
    // Configurar event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Paginação - CORRIGINDO EVENTOS
    if (elements.btnPrevPage) {
      elements.btnPrevPage.addEventListener('click', function(event) {
        event.preventDefault(); // Impedir comportamento padrão
        console.log('Clique em Página Anterior');
        prevPage();
      });
    }
    
    if (elements.btnNextPage) {
      elements.btnNextPage.addEventListener('click', function(event) {
        event.preventDefault(); // Impedir comportamento padrão
        console.log('Clique em Próxima Página');
        nextPage();
      });
    }
    
    // Busca
    if (elements.btnSearch) {
      elements.btnSearch.addEventListener('click', () => {
        state.filters.search = elements.searchInput.value;
        applyFilters();
      });
    }
    
    if (elements.searchInput) {
      elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          state.filters.search = elements.searchInput.value;
          applyFilters();
        }
      });
    }
    
    // Filtros
    if (elements.unidadeFilter) {
      elements.unidadeFilter.addEventListener('change', () => {
        state.filters.unidade = elements.unidadeFilter.value;
        
        // Atualizar filtro de setores baseado na unidade selecionada
        if (state.filters.unidade) {
          loadSetores(state.filters.unidade);
        } else {
          // Reset do filtro de setores
          populateSetoresFilter([]);
        }
        
        applyFilters();
      });
    }
    
    if (elements.setorFilter) {
      elements.setorFilter.addEventListener('change', () => {
        state.filters.setor = elements.setorFilter.value;
        applyFilters();
      });
    }
    
    if (elements.situacaoFilter) {
      elements.situacaoFilter.addEventListener('change', () => {
        state.filters.situacao = elements.situacaoFilter.value;
        applyFilters();
      });
    }
    
    // Modal de detalhes
    if (elements.closeModal) {
      elements.closeModal.addEventListener('click', () => {
        hideModal(elements.funcionarioModal);
      });
    }
    
    if (elements.closeModalBtn) {
      elements.closeModalBtn.addEventListener('click', () => {
        hideModal(elements.funcionarioModal);
      });
    }
    
    // Fechar modal ao clicar fora dele
    if (elements.funcionarioModal) {
      elements.funcionarioModal.addEventListener('click', (event) => {
        if (event.target === elements.funcionarioModal) {
          hideModal(elements.funcionarioModal);
        }
      });
    }
    
    // Abas do perfil
    if (elements.tabButtons) {
      elements.tabButtons.forEach(button => {
        button.addEventListener('click', function() {
          const tabId = this.getAttribute('data-tab');
          switchTab(tabId);
        });
      });
    }
  }

  // Funções de carregamento de dados - CORREÇÃO DA PAGINAÇÃO
  async function loadFuncionarios(applyingFilters = false) {
    // Evitar múltiplas requisições simultâneas
    if (state.loading) {
      console.log('Já existe um carregamento em andamento, ignorando requisição');
      return;
    }
    
    try {
      state.loading = true;
      
      // Mostrar indicador de carregamento
      elements.funcionariosTableBody.innerHTML = `
        <tr class="loading-row">
          <td colspan="6" class="text-center">Carregando funcionários...</td>
        </tr>
      `;
      
      // Calcular skip com base na página atual
      const skip = (state.pagination.currentPage - 1) * state.pagination.limit;
      
      // Log para diagnóstico
      console.log(`Carregando funcionários: página ${state.pagination.currentPage}, skip=${skip}, limit=${state.pagination.limit}`);
      
      const url = new URL(`${window.location.origin}/api/funcionarios`);
      
      url.searchParams.append('skip', skip);
      url.searchParams.append('limit', state.pagination.limit);
      
      // Adicionar filtros à URL
      if (state.filters.unidade) {
        url.searchParams.append('unidade', state.filters.unidade);
      }
      
      if (state.filters.setor) {
        url.searchParams.append('setor', state.filters.setor);
      }
      
      if (state.filters.situacao) {
        url.searchParams.append('situacao', state.filters.situacao);
      }
      
      if (state.filters.search) {
        url.searchParams.append('search', state.filters.search);
      }
      
      // Log da URL para diagnóstico
      console.log('URL da requisição:', url.toString());
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache' // Evitar cache
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Log dos dados recebidos
        console.log(`Dados recebidos: ${data.items ? data.items.length : 0} funcionários, total: ${data.total || 0}`);
        
        // Atualizar estado
        state.funcionarios = data.items || [];
        state.filteredFuncionarios = [...state.funcionarios];
        state.pagination.total = data.total || 0;
        state.pagination.totalPages = Math.max(1, Math.ceil(state.pagination.total / state.pagination.limit));
        
        // Renderizar e atualizar interface
        renderFuncionarios();
        updatePagination();
      } else {
        handleApiError(response);
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      showToast('Erro ao carregar funcionários', 'error');
      
      // Em caso de erro, limpar a tabela
      elements.funcionariosTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">Erro ao carregar funcionários. Tente novamente.</td>
        </tr>
      `;
    } finally {
      state.loading = false;
    }
  }

  async function loadUnidades() {
    try {
      const response = await fetch(`${window.location.origin}/api/empresas`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        state.unidades = data.items;
        
        // Preencher o select de unidades
        populateUnidadesFilter(state.unidades);
      } else {
        // Silenciosamente falha
        console.log('Não foi possível carregar unidades');
        
        // Extrair unidades dos funcionários como fallback
        extractUnidadesFromFuncionarios();
      }
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      
      // Fallback
      extractUnidadesFromFuncionarios();
    }
  }
  
  // Função para extrair unidades dos funcionários já carregados (fallback)
  function extractUnidadesFromFuncionarios() {
    if (state.funcionarios.length === 0) {
      return;
    }
    
    // Extrair unidades únicas dos funcionários
    const uniqueUnidades = new Map();
    
    state.funcionarios.forEach(funcionario => {
      if (funcionario.nome_unidade && funcionario.codigo_unidade) {
        uniqueUnidades.set(funcionario.codigo_unidade, {
          codigo: funcionario.codigo_unidade,
          nome: funcionario.nome_unidade
        });
      }
    });
    
    state.unidades = Array.from(uniqueUnidades.values());
    populateUnidadesFilter(state.unidades);
  }

  async function loadSetores(unidadeCodigo) {
    try {
      const response = await fetch(`${window.location.origin}/api/setores?unidade=${unidadeCodigo}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        state.setores = data;
        
        // Preencher o select de setores
        populateSetoresFilter(state.setores);
      } else {
        // Silenciosamente falha, usar fallback
        extractSetoresFromFuncionarios(unidadeCodigo);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
      
      // Fallback
      extractSetoresFromFuncionarios(unidadeCodigo);
    }
  }
  
  // Função para extrair setores dos funcionários (fallback)
  function extractSetoresFromFuncionarios(unidadeCodigo = null) {
    if (state.funcionarios.length === 0) {
      return;
    }
    
    // Extrair setores únicos dos funcionários
    const uniqueSetores = new Map();
    
    state.funcionarios.forEach(funcionario => {
      // Se unidadeCodigo for fornecido, filtre apenas os setores dessa unidade
      if (unidadeCodigo && funcionario.codigo_unidade !== unidadeCodigo) {
        return;
      }
      
      if (funcionario.nome_setor && funcionario.codigo_setor) {
        uniqueSetores.set(funcionario.codigo_setor, {
          codigo: funcionario.codigo_setor,
          nome: funcionario.nome_setor
        });
      }
    });
    
    state.setores = Array.from(uniqueSetores.values());
    populateSetoresFilter(state.setores);
  }

  async function loadFuncionarioDetails(funcionarioId) {
    try {
      const response = await fetch(`${window.location.origin}/api/funcionarios/${funcionarioId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const funcionario = await response.json();
        state.selectedFuncionario = funcionario;
        
        renderFuncionarioDetails(funcionario);
        showModal(elements.funcionarioModal);
        
        // Garantir que a primeira aba seja ativada
        switchTab('pessoal');
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao carregar detalhes do funcionário', 'error');
      console.error('Erro ao carregar detalhes do funcionário:', error);
    }
  }

  // Funções de renderização
  function renderFuncionarios() {
    elements.funcionariosTableBody.innerHTML = '';
    
    if (state.funcionarios.length === 0) {
      elements.funcionariosTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">Nenhum funcionário encontrado</td>
        </tr>
      `;
      return;
    }
    
    state.funcionarios.forEach(funcionario => {
      const row = document.createElement('tr');
      
      // Formatação da data de admissão
      const dataAdmissao = funcionario.data_admissao ? new Date(funcionario.data_admissao).toLocaleDateString('pt-BR') : '-';
      
      // Badge para situação
      const situacaoBadge = getSituacaoBadge(funcionario.situacao);
      
      row.innerHTML = `
        <td>${funcionario.nome || '-'}</td>
        <td>${formatCpf(funcionario.cpf) || '-'}</td>
        <td>${funcionario.nome_cargo || '-'}</td>
        <td>${dataAdmissao}</td>
        <td>${situacaoBadge}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm btn-details" data-id="${funcionario.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Detalhes
            </button>
          </div>
        </td>
      `;
      
      // Garantir que o event listener seja adicionado corretamente
      const detailsBtn = row.querySelector('.btn-details');
      if (detailsBtn) {
        detailsBtn.addEventListener('click', () => {
          const id = detailsBtn.getAttribute('data-id');
          if (id) loadFuncionarioDetails(id);
        });
      }
      
      elements.funcionariosTableBody.appendChild(row);
    });
  }

  function renderFuncionarioDetails(funcionario) {
    // Usar uma função de atualização segura que verifica a existência dos elementos
    function updateElement(id, value) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value || '-';
      }
    }
    
    // Header do perfil
    updateElement('avatarInitials', getInitials(funcionario.nome));
    updateElement('profileNome', funcionario.nome);
    updateElement('profileCargo', funcionario.nome_cargo);
    updateElement('profileEmpresa', `Empresa: ${funcionario.nome_empresa || '-'}`);
    
    // Status com a badge
    const statusElement = document.getElementById('profileStatus');
    if (statusElement) {
      statusElement.textContent = funcionario.situacao || '-';
      statusElement.className = `badge ${getSituacaoClass(funcionario.situacao)}`;
    }
    
    // Tab: Informações Pessoais
    updateElement('infoNome', funcionario.nome);
    updateElement('infoDataNascimento', formatDate(funcionario.data_nascimento));
    updateElement('infoSexo', mappers.sexo[funcionario.sexo]);
    updateElement('infoEstadoCivil', mappers.estadoCivil[funcionario.estado_civil]);
    updateElement('infoNomeMae', funcionario.nm_mae_funcionario);
    updateElement('infoNaturalidade', funcionario.naturalidade);
    updateElement('infoEscolaridade', mappers.escolaridade[funcionario.escolaridade]);
    updateElement('infoDeficiente', funcionario.deficiente ? 'Sim' : 'Não');
    updateElement('infoDeficiencia', funcionario.deficiencia);
    
    // Tab: Informações Profissionais
    updateElement('infoEmpresa', funcionario.nome_empresa);
    updateElement('infoMatricula', funcionario.matricula_funcionario);
    updateElement('infoSituacao', funcionario.situacao);
    updateElement('infoDataAdmissao', formatDate(funcionario.data_admissao));
    updateElement('infoDataDemissao', formatDate(funcionario.data_demissao));
    updateElement('infoCargo', funcionario.nome_cargo);
    updateElement('infoCboCargo', funcionario.cbo_cargo);
    updateElement('infoUnidade', funcionario.nome_unidade);
    updateElement('infoSetor', funcionario.nome_setor);
    updateElement('infoCentroCusto', funcionario.nome_centro_custo);
    updateElement('infoTipoContratacao', mappers.tipoContratacao[funcionario.tipo_contratacao]);
    updateElement('infoRegimeTrabalho', funcionario.regime_trabalho);
    updateElement('infoTurnoTrabalho', mappers.turnoTrabalho[funcionario.turno_trabalho]);
    updateElement('infoRegimeRevezamento', mappers.regimeRevezamento[funcionario.regime_revezamento]);
    
    // Tab: Contato
    updateElement('infoEndereco', funcionario.endereco);
    updateElement('infoNumeroEndereco', funcionario.numero_endereco);
    updateElement('infoBairro', funcionario.bairro);
    updateElement('infoCidade', funcionario.cidade);
    updateElement('infoUf', funcionario.uf);
    updateElement('infoCep', funcionario.cep);
    updateElement('infoTelefoneResidencial', funcionario.telefone_residencial);
    updateElement('infoTelefoneCelular', funcionario.telefone_celular);
    updateElement('infoTelComercial', funcionario.tel_comercial);
    updateElement('infoRamal', funcionario.ramal);
    updateElement('infoEmail', funcionario.email);
    
    // Tab: Documentos
    updateElement('infoCpf', formatCpf(funcionario.cpf));
    updateElement('infoRg', funcionario.rg);
    updateElement('infoOrgaoEmissorRg', funcionario.orgao_emissor_rg);
    updateElement('infoUfRg', funcionario.uf_rg);
    updateElement('infoPis', funcionario.pis);
    updateElement('infoCtps', funcionario.ctps);
    updateElement('infoSerieCtps', funcionario.serie_ctps);
  }

  // CORREÇÃO DA PAGINAÇÃO - Atualização da UI
  function updatePagination() {
    if (elements.paginationInfo) {
      elements.paginationInfo.textContent = `Página ${state.pagination.currentPage} de ${state.pagination.totalPages}`;
    }
    
    if (elements.btnPrevPage) {
      elements.btnPrevPage.disabled = state.pagination.currentPage <= 1;
    }
    
    if (elements.btnNextPage) {
      elements.btnNextPage.disabled = state.pagination.currentPage >= state.pagination.totalPages;
    }
    
    // Log para diagnóstico
    console.log(`Paginação atualizada: Página ${state.pagination.currentPage}/${state.pagination.totalPages}, Total: ${state.pagination.total}`);
  }

  function populateUnidadesFilter(unidades) {
    if (!elements.unidadeFilter) return;
    
    // Manter a opção padrão
    elements.unidadeFilter.innerHTML = '<option value="">Todas as unidades</option>';
    
    if (!unidades || unidades.length === 0) return;
    
    // Ordenar unidades pelo nome para melhor usabilidade
    const sortedUnidades = [...unidades].sort((a, b) => {
      return (a.nome || '').localeCompare(b.nome || '');
    });
    
    // Adicionar as unidades ao select
    sortedUnidades.forEach(unidade => {
      if (unidade && unidade.codigo && unidade.nome) {
        const option = document.createElement('option');
        option.value = unidade.codigo;
        option.textContent = unidade.nome;
        elements.unidadeFilter.appendChild(option);
      }
    });
  }

  function populateSetoresFilter(setores) {
    if (!elements.setorFilter) return;
    
    // Manter a opção padrão
    elements.setorFilter.innerHTML = '<option value="">Todos os setores</option>';
    
    if (!setores || setores.length === 0) return;
    
    // Ordenar setores pelo nome para melhor usabilidade
    const sortedSetores = [...setores].sort((a, b) => {
      return (a.nome || '').localeCompare(b.nome || '');
    });
    
    // Adicionar os setores ao select
    sortedSetores.forEach(setor => {
      if (setor && setor.codigo && setor.nome) {
        const option = document.createElement('option');
        option.value = setor.codigo;
        option.textContent = setor.nome;
        elements.setorFilter.appendChild(option);
      }
    });
  }

  // Funções de manipulação de modais
  function showModal(modal) {
    // Verificar se o modal existe
    if (!modal) return;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Evita rolagem no fundo
  }
  
  function hideModal(modal) {
    // Verificar se o modal existe
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
  
  function switchTab(tabId) {
    // Garantir que tabId existe
    if (!tabId) return;
    
    // Desativar todas as abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Ativar a aba selecionada
    const selectedButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const selectedPane = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    
    if (selectedButton) selectedButton.classList.add('active');
    if (selectedPane) selectedPane.classList.add('active');
  }

  // CORREÇÃO DA PAGINAÇÃO - Funções de navegação
  function prevPage() {
    if (state.pagination.currentPage > 1) {
      state.pagination.currentPage--;
      
      // Log para diagnóstico
      console.log(`Navegando para página anterior: ${state.pagination.currentPage}`);
      
      // Carregar dados da nova página
      loadFuncionarios(true);
    }
  }
  
  function nextPage() {
    if (state.pagination.currentPage < state.pagination.totalPages) {
      state.pagination.currentPage++;
      
      // Log para diagnóstico
      console.log(`Navegando para próxima página: ${state.pagination.currentPage}`);
      
      // Carregar dados da nova página
      loadFuncionarios(true);
    }
  }
  
  // Funções de filtro
  function applyFilters() {
    // Reset da paginação
    state.pagination.currentPage = 1;
    
    // Log para diagnóstico
    console.log(`Aplicando filtros:`, state.filters);
    
    // Recarregar funcionários com os novos filtros
    loadFuncionarios(true);
  }

  // Funções auxiliares
  function getSituacaoBadge(situacao) {
    const classes = getSituacaoClass(situacao);
    return `<span class="badge ${classes}">${situacao || '-'}</span>`;
  }
  
  function getSituacaoClass(situacao) {
    if (!situacao) return 'badge-inactive';
    
    situacao = situacao.toLowerCase();
    
    if (situacao.includes('ativo')) return 'badge-active';
    if (situacao.includes('inativo')) return 'badge-inactive';
    if (situacao.includes('afast')) return 'badge-afastado';
    if (situacao.includes('féria') || situacao.includes('feria')) return 'badge-ferias';
    
    return 'badge-inactive';
  }
  
  function getInitials(name) {
    if (!name) return '--';
    
    const names = name.split(' ').filter(n => n.length > 0);
    if (names.length === 0) return '--';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }
  
  function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return '-';
    }
  }
  
  function formatCpf(cpf) {
    if (!cpf) return '-';
    
    // Remover caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');
    
    // Verificar se tem 11 dígitos
    if (cpf.length !== 11) return cpf;
    
    // Formatar como xxx.xxx.xxx-xx
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  async function handleApiError(response) {
    let errorMessage = 'Ocorreu um erro na operação';
    
    try {
      // Verificar content-type antes de tentar parsear JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } else {
        errorMessage = `Erro ${response.status}: ${response.statusText}`;
      }
    } catch (e) {
      errorMessage = `Erro ${response.status}: ${response.statusText}`;
    }
    
    // Só mostrar toast se não for erro relacionado a empresas (evitar mensagem desnecessária)
    if (!errorMessage.toLowerCase().includes('empresa')) {
      showToast(errorMessage, 'error');
    } else {
      console.log(errorMessage); // Log sem mostrar toast
    }
  }
  
  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div>${message}</div>
      <button class="toast-close">&times;</button>
    `;
    
    // Adicionar ao container
    elements.toastContainer.appendChild(toast);
    
    // Configurar auto-remoção
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (elements.toastContainer.contains(toast)) {
          elements.toastContainer.removeChild(toast);
        }
      });
    }
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
      if (elements.toastContainer && elements.toastContainer.contains(toast)) {
        elements.toastContainer.removeChild(toast);
      }
    }, 5000);
  }
});