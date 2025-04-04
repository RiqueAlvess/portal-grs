document.addEventListener('DOMContentLoaded', function() {
  // Estado da aplicação
  const state = {
    funcionarios: [],
    selectedFuncionario: null,
    filters: {
      situacao: '',
      search: ''
    },
    pagination: {
      currentPage: 1,
      totalPages: 1,
      limit: 10,
      total: 0
    },
    loading: false
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
    // Paginação - Implementação simplificada
    if (elements.btnPrevPage) {
      elements.btnPrevPage.onclick = function(e) {
        e.preventDefault();
        if (state.pagination.currentPage > 1) {
          state.pagination.currentPage--;
          loadFuncionarios();
        }
      };
    }
    
    if (elements.btnNextPage) {
      elements.btnNextPage.onclick = function(e) {
        e.preventDefault();
        if (state.pagination.currentPage < state.pagination.totalPages) {
          state.pagination.currentPage++;
          loadFuncionarios();
        }
      };
    }
    
    // Busca
    if (elements.btnSearch) {
      elements.btnSearch.addEventListener('click', function() {
        state.filters.search = elements.searchInput.value;
        state.pagination.currentPage = 1; // Reset para primeira página ao buscar
        loadFuncionarios();
      });
    }
    
    if (elements.searchInput) {
      elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          state.filters.search = elements.searchInput.value;
          state.pagination.currentPage = 1; // Reset para primeira página ao buscar
          loadFuncionarios();
        }
      });
    }
    
    // Filtro de situação
    if (elements.situacaoFilter) {
      elements.situacaoFilter.addEventListener('change', function() {
        state.filters.situacao = elements.situacaoFilter.value;
        state.pagination.currentPage = 1; // Reset para primeira página ao filtrar
        loadFuncionarios();
      });
    }
    
    // Modal de detalhes
    if (elements.closeModal) {
      elements.closeModal.addEventListener('click', function() {
        hideModal(elements.funcionarioModal);
      });
    }
    
    if (elements.closeModalBtn) {
      elements.closeModalBtn.addEventListener('click', function() {
        hideModal(elements.funcionarioModal);
      });
    }
    
    // Fechar modal ao clicar fora dele
    if (elements.funcionarioModal) {
      elements.funcionarioModal.addEventListener('click', function(event) {
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

  // Função simplificada para carregar funcionários - usando 'page' em vez de 'skip'
  async function loadFuncionarios() {
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
      
      // Construir URL com parâmetros - usando page em vez de skip
      const url = new URL(`${window.location.origin}/api/funcionarios`);
      
      // Adicionar parâmetros de paginação
      url.searchParams.append('page', state.pagination.currentPage);
      url.searchParams.append('limit', state.pagination.limit);
      
      // Adicionar filtros à URL
      if (state.filters.situacao) {
        url.searchParams.append('situacao', state.filters.situacao);
      }
      
      if (state.filters.search) {
        url.searchParams.append('search', state.filters.search);
      }
      
      // Timestamp para evitar cache
      url.searchParams.append('_t', Date.now());
      
      console.log('Buscando funcionários:', url.toString());
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Log dos dados recebidos
      console.log(`Recebidos ${data.items.length} funcionários de ${data.total} total`);
      console.log('Metadados da resposta:', {
        page: data.page,
        limit: data.limit,
        pages: data.pages
      });
      
      // Atualizar estado
      state.funcionarios = data.items || [];
      state.pagination.total = data.total || 0;
      state.pagination.currentPage = data.page || 1;
      state.pagination.totalPages = data.pages || 1;
      
      // Renderizar dados e atualizar UI
      renderFuncionarios();
      updatePagination();
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      showToast('Erro ao carregar funcionários: ' + error.message, 'error');
      
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

  async function loadFuncionarioDetails(funcionarioId) {
    try {
      const response = await fetch(`${window.location.origin}/api/funcionarios/${funcionarioId}?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const funcionario = await response.json();
      state.selectedFuncionario = funcionario;
      
      renderFuncionarioDetails(funcionario);
      showModal(elements.funcionarioModal);
      
      // Garantir que a primeira aba seja ativada
      switchTab('pessoal');
    } catch (error) {
      showToast('Erro ao carregar detalhes do funcionário: ' + error.message, 'error');
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
        detailsBtn.addEventListener('click', function() {
          const id = this.getAttribute('data-id');
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

  // Função para atualizar paginação
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
    
    console.log(`Paginação atualizada: Página ${state.pagination.currentPage}/${state.pagination.totalPages}, Total: ${state.pagination.total}`);
  }

  // Funções de manipulação de modais
  function showModal(modal) {
    if (!modal) return;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Evita rolagem no fundo
  }
  
  function hideModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
  
  function switchTab(tabId) {
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