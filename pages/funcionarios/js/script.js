document.addEventListener('DOMContentLoaded', function() {
    // Estado da aplicação
    const state = {
      funcionarios: [],
      empresas: [],
      setores: [],
      filteredFuncionarios: [],
      selectedFuncionario: null,
      filters: {
        empresa: '',
        setor: '',
        situacao: '',
        search: ''
      },
      pagination: {
        currentPage: 1,
        totalPages: 1,
        limit: 10
      }
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
      empresaFilter: document.getElementById('empresaFilter'),
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
      // Carregar funcionários iniciais
      loadFuncionarios();
      
      // Carregar empresas para o filtro
      loadEmpresas();
      
      // Configurar event listeners
      setupEventListeners();
    }
  
    function setupEventListeners() {
      // Paginação
      elements.btnPrevPage.addEventListener('click', prevPage);
      elements.btnNextPage.addEventListener('click', nextPage);
      
      // Busca
      elements.btnSearch.addEventListener('click', () => {
        state.filters.search = elements.searchInput.value;
        applyFilters();
      });
      
      elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          state.filters.search = elements.searchInput.value;
          applyFilters();
        }
      });
      
      // Filtros
      elements.empresaFilter.addEventListener('change', () => {
        state.filters.empresa = elements.empresaFilter.value;
        
        // Atualizar filtro de setores baseado na empresa selecionada
        if (state.filters.empresa) {
          loadSetores(state.filters.empresa);
        } else {
          // Reset do filtro de setores
          populateSetoresFilter([]);
        }
        
        applyFilters();
      });
      
      elements.setorFilter.addEventListener('change', () => {
        state.filters.setor = elements.setorFilter.value;
        applyFilters();
      });
      
      elements.situacaoFilter.addEventListener('change', () => {
        state.filters.situacao = elements.situacaoFilter.value;
        applyFilters();
      });
      
      // Modal de detalhes
      elements.closeModal.addEventListener('click', () => hideModal(elements.funcionarioModal));
      elements.closeModalBtn.addEventListener('click', () => hideModal(elements.funcionarioModal));
      
      // Abas do perfil
      elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const tabId = button.getAttribute('data-tab');
          switchTab(tabId);
        });
      });
    }
  
    // Funções de carregamento de dados
    async function loadFuncionarios(applyingFilters = false) {
      try {
        // Mostrar indicador de carregamento
        if (!applyingFilters) {
          elements.funcionariosTableBody.innerHTML = `
            <tr class="loading-row">
              <td colspan="6" class="text-center">Carregando funcionários...</td>
            </tr>
          `;
        }
        
        const skip = (state.pagination.currentPage - 1) * state.pagination.limit;
        const url = new URL(`${window.location.origin}/api/funcionarios`);
        
        url.searchParams.append('skip', skip);
        url.searchParams.append('limit', state.pagination.limit);
        
        // Adicionar filtros à URL
        if (state.filters.empresa) {
          url.searchParams.append('empresa', state.filters.empresa);
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
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          state.funcionarios = data.items;
          state.filteredFuncionarios = [...state.funcionarios];
          state.pagination.totalPages = Math.ceil(data.total / state.pagination.limit);
          
          renderFuncionarios();
          updatePagination();
        } else {
          handleApiError(response);
        }
      } catch (error) {
        showToast('Erro ao carregar funcionários', 'error');
        console.error('Erro ao carregar funcionários:', error);
      }
    }
  
    async function loadEmpresas() {
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
          state.empresas = data.items;
          
          // Preencher o select de empresas
          populateEmpresasFilter(state.empresas);
        } else {
          handleApiError(response);
        }
      } catch (error) {
        showToast('Erro ao carregar empresas', 'error');
        console.error('Erro ao carregar empresas:', error);
      }
    }
  
    async function loadSetores(empresaCodigo) {
      try {
        const response = await fetch(`${window.location.origin}/api/empresas/${empresaCodigo}/setores`, {
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
          handleApiError(response);
        }
      } catch (error) {
        showToast('Erro ao carregar setores', 'error');
        console.error('Erro ao carregar setores:', error);
      }
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
          
          // Ativa a primeira aba por padrão
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
        
        // Adicionar event listeners para botões de ação
        const detailsBtn = row.querySelector('.btn-details');
        detailsBtn.addEventListener('click', () => loadFuncionarioDetails(funcionario.id));
        
        elements.funcionariosTableBody.appendChild(row);
      });
    }
  
    function renderFuncionarioDetails(funcionario) {
      // Header do perfil
      elements.avatarInitials.textContent = getInitials(funcionario.nome);
      elements.profileNome.textContent = funcionario.nome || '-';
      elements.profileCargo.textContent = funcionario.nome_cargo || '-';
      elements.profileEmpresa.textContent = `Empresa: ${funcionario.nome_empresa || '-'}`;
      elements.profileStatus.textContent = funcionario.situacao || '-';
      elements.profileStatus.className = `badge ${getSituacaoClass(funcionario.situacao)}`;
      
      // Tab: Informações Pessoais
      document.getElementById('infoNome').textContent = funcionario.nome || '-';
      document.getElementById('infoDataNascimento').textContent = formatDate(funcionario.data_nascimento);
      document.getElementById('infoSexo').textContent = mappers.sexo[funcionario.sexo] || '-';
      document.getElementById('infoEstadoCivil').textContent = mappers.estadoCivil[funcionario.estado_civil] || '-';
      document.getElementById('infoNomeMae').textContent = funcionario.nm_mae_funcionario || '-';
      document.getElementById('infoNaturalidade').textContent = funcionario.naturalidade || '-';
      document.getElementById('infoEscolaridade').textContent = mappers.escolaridade[funcionario.escolaridade] || '-';
      document.getElementById('infoDeficiente').textContent = funcionario.deficiente ? 'Sim' : 'Não';
      document.getElementById('infoDeficiencia').textContent = funcionario.deficiencia || '-';
      
      // Tab: Informações Profissionais
      document.getElementById('infoEmpresa').textContent = funcionario.nome_empresa || '-';
      document.getElementById('infoMatricula').textContent = funcionario.matricula_funcionario || '-';
      document.getElementById('infoSituacao').textContent = funcionario.situacao || '-';
      document.getElementById('infoDataAdmissao').textContent = formatDate(funcionario.data_admissao);
      document.getElementById('infoDataDemissao').textContent = formatDate(funcionario.data_demissao);
      document.getElementById('infoCargo').textContent = funcionario.nome_cargo || '-';
      document.getElementById('infoCboCargo').textContent = funcionario.cbo_cargo || '-';
      document.getElementById('infoUnidade').textContent = funcionario.nome_unidade || '-';
      document.getElementById('infoSetor').textContent = funcionario.nome_setor || '-';
      document.getElementById('infoCentroCusto').textContent = funcionario.nome_centro_custo || '-';
      document.getElementById('infoTipoContratacao').textContent = mappers.tipoContratacao[funcionario.tipo_contratacao] || '-';
      document.getElementById('infoRegimeTrabalho').textContent = funcionario.regime_trabalho || '-';
      document.getElementById('infoTurnoTrabalho').textContent = mappers.turnoTrabalho[funcionario.turno_trabalho] || '-';
      document.getElementById('infoRegimeRevezamento').textContent = mappers.regimeRevezamento[funcionario.regime_revezamento] || '-';
      
      // Tab: Contato
      document.getElementById('infoEndereco').textContent = funcionario.endereco || '-';
      document.getElementById('infoNumeroEndereco').textContent = funcionario.numero_endereco || '-';
      document.getElementById('infoBairro').textContent = funcionario.bairro || '-';
      document.getElementById('infoCidade').textContent = funcionario.cidade || '-';
      document.getElementById('infoUf').textContent = funcionario.uf || '-';
      document.getElementById('infoCep').textContent = funcionario.cep || '-';
      document.getElementById('infoTelefoneResidencial').textContent = funcionario.telefone_residencial || '-';
      document.getElementById('infoTelefoneCelular').textContent = funcionario.telefone_celular || '-';
      document.getElementById('infoTelComercial').textContent = funcionario.tel_comercial || '-';
      document.getElementById('infoRamal').textContent = funcionario.ramal || '-';
      document.getElementById('infoEmail').textContent = funcionario.email || '-';
      
      // Tab: Documentos
      document.getElementById('infoCpf').textContent = formatCpf(funcionario.cpf) || '-';
      document.getElementById('infoRg').textContent = funcionario.rg || '-';
      document.getElementById('infoOrgaoEmissorRg').textContent = funcionario.orgao_emissor_rg || '-';
      document.getElementById('infoUfRg').textContent = funcionario.uf_rg || '-';
      document.getElementById('infoPis').textContent = funcionario.pis || '-';
      document.getElementById('infoCtps').textContent = funcionario.ctps || '-';
      document.getElementById('infoSerieCtps').textContent = funcionario.serie_ctps || '-';
    }
  
    function updatePagination() {
      elements.paginationInfo.textContent = `Página ${state.pagination.currentPage} de ${state.pagination.totalPages}`;
      
      // Habilitar/desabilitar botões de navegação
      elements.btnPrevPage.disabled = state.pagination.currentPage <= 1;
      elements.btnNextPage.disabled = state.pagination.currentPage >= state.pagination.totalPages;
    }
  
    function populateEmpresasFilter(empresas) {
      // Manter a opção padrão
      elements.empresaFilter.innerHTML = '<option value="">Todas as empresas</option>';
      
      // Adicionar as empresas em ordem alfabética
      empresas.sort((a, b) => a.nome_abreviado.localeCompare(b.nome_abreviado))
        .forEach(empresa => {
          const option = document.createElement('option');
          option.value = empresa.codigo;
          option.textContent = empresa.nome_abreviado;
          elements.empresaFilter.appendChild(option);
        });
    }
  
    function populateSetoresFilter(setores) {
      // Manter a opção padrão
      elements.setorFilter.innerHTML = '<option value="">Todos os setores</option>';
      
      // Adicionar os setores em ordem alfabética
      setores.sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach(setor => {
          const option = document.createElement('option');
          option.value = setor.codigo;
          option.textContent = setor.nome;
          elements.setorFilter.appendChild(option);
        });
    }
  
    // Funções de manipulação de modais
    function showModal(modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden'; // Evita rolagem no fundo
    }
    
    function hideModal(modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
    
    function switchTab(tabId) {
      // Desativar todas as abas
      elements.tabButtons.forEach(btn => btn.classList.remove('active'));
      elements.tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Ativar a aba selecionada
      document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
      document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
    }
  
    // Funções de navegação e paginação
    function prevPage() {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        loadFuncionarios(true);
      }
    }
    
    function nextPage() {
      if (state.pagination.currentPage < state.pagination.totalPages) {
        state.pagination.currentPage++;
        loadFuncionarios(true);
      }
    }
    
    // Funções de filtro
    function applyFilters() {
      // Reset da paginação
      state.pagination.currentPage = 1;
      
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
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        errorMessage = `Erro ${response.status}: ${response.statusText}`;
      }
      
      showToast(errorMessage, 'error');
    }
    
    function showToast(message, type = 'info') {
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
      closeBtn.addEventListener('click', () => {
        elements.toastContainer.removeChild(toast);
      });
      
      // Auto-remover após 5 segundos
      setTimeout(() => {
        if (elements.toastContainer.contains(toast)) {
          elements.toastContainer.removeChild(toast);
        }
      }, 5000);
    }
  });