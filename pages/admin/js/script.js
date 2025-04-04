document.addEventListener('DOMContentLoaded', function() {
  // Estado da aplicação
  const state = {
    users: [],
    companies: [],
    filteredCompanies: [],
    userCompanies: [],
    selectedUser: null,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      limit: 10
    },
    companyTransfer: {
      availableSelected: [],
      assignedSelected: []
    }
  };

  // Elementos DOM
  const elements = {
    // Tabela de usuários
    usersTable: document.getElementById('usersTable'),
    usersTableBody: document.getElementById('usersTableBody'),
    
    // Paginação
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    paginationInfo: document.getElementById('paginationInfo'),
    
    // Busca
    searchInput: document.getElementById('searchInput'),
    btnSearch: document.getElementById('btnSearch'),
    
    // Modal de usuário
    userModal: document.getElementById('userModal'),
    modalTitle: document.getElementById('modalTitle'),
    closeUserModal: document.getElementById('closeUserModal'),
    userForm: document.getElementById('userForm'),
    userId: document.getElementById('userId'),
    nome: document.getElementById('nome'),
    email: document.getElementById('email'),
    senha: document.getElementById('senha'),
    passwordHelpText: document.getElementById('passwordHelpText'),
    typeUser: document.getElementById('typeUser'),
    active: document.getElementById('active'),
    activeStatus: document.getElementById('activeStatus'),
    saveUserBtn: document.getElementById('saveUserBtn'),
    cancelUserBtn: document.getElementById('cancelUserBtn'),
    btnAddUser: document.getElementById('btnAddUser'),
    
    // Modal de empresas
    companiesModal: document.getElementById('companiesModal'),
    companiesModalTitle: document.getElementById('companiesModalTitle'),
    closeCompaniesModal: document.getElementById('closeCompaniesModal'),
    companySearchInput: document.getElementById('companySearchInput'),
    availableCompanies: document.getElementById('availableCompanies'),
    assignedCompanies: document.getElementById('assignedCompanies'),
    btnAddCompanies: document.getElementById('btnAddCompanies'),
    btnRemoveCompanies: document.getElementById('btnRemoveCompanies'),
    saveCompaniesBtn: document.getElementById('saveCompaniesBtn'),
    cancelCompaniesBtn: document.getElementById('cancelCompaniesBtn'),
    
    // Modal de confirmação
    confirmModal: document.getElementById('confirmModal'),
    confirmModalTitle: document.getElementById('confirmModalTitle'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    closeConfirmModal: document.getElementById('closeConfirmModal'),
    confirmBtn: document.getElementById('confirmBtn'),
    cancelConfirmBtn: document.getElementById('cancelConfirmBtn'),
    
    // Container de toasts
    toastContainer: document.getElementById('toastContainer')
  };

  // Inicia a aplicação
  init();

  function init() {
    // Adiciona estilo inline para garantir que o container de empresas tenha scroll
    fixCompanyListStyle();
    
    // Carregar usuários iniciais
    loadUsers();
    
    // Configurar event listeners
    setupEventListeners();
  }
  
  // Função para corrigir o estilo das listas de empresas
  function fixCompanyListStyle() {
    // Garantir que o container de empresas tenha altura suficiente e scroll
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .company-list-wrapper {
        max-height: 350px;
        overflow-y: auto !important;
      }
      .company-selection-container {
        height: auto !important;
        min-height: 350px;
      }
      .company-list {
        height: auto !important;
        max-height: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  function setupEventListeners() {
    // Paginação
    elements.btnPrevPage.addEventListener('click', prevPage);
    elements.btnNextPage.addEventListener('click', nextPage);
    
    // Busca
    elements.btnSearch.addEventListener('click', () => loadUsers(elements.searchInput.value));
    elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadUsers(elements.searchInput.value);
      }
    });
    
    // Adicionar usuário
    elements.btnAddUser.addEventListener('click', showAddUserModal);
    
    // Modal de usuário
    elements.closeUserModal.addEventListener('click', () => hideModal(elements.userModal));
    elements.cancelUserBtn.addEventListener('click', () => hideModal(elements.userModal));
    elements.saveUserBtn.addEventListener('click', saveUser);
    elements.active.addEventListener('change', updateActiveStatus);
    
    // Modal de empresas
    elements.closeCompaniesModal.addEventListener('click', () => hideModal(elements.companiesModal));
    elements.cancelCompaniesBtn.addEventListener('click', () => hideModal(elements.companiesModal));
    elements.saveCompaniesBtn.addEventListener('click', saveCompanyAssignments);
    elements.btnAddCompanies.addEventListener('click', moveCompaniesToAssigned);
    elements.btnRemoveCompanies.addEventListener('click', moveCompaniesToAvailable);
    elements.companySearchInput.addEventListener('input', filterCompanies);
    
    // Modal de confirmação
    elements.closeConfirmModal.addEventListener('click', () => hideModal(elements.confirmModal));
    elements.cancelConfirmBtn.addEventListener('click', () => hideModal(elements.confirmModal));
  }

  // Funções de carregamento de dados
  async function loadUsers(search = '') {
    try {
      const skip = (state.pagination.currentPage - 1) * state.pagination.limit;
      const url = new URL(`${window.location.origin}/api/admin/users`);
      
      url.searchParams.append('skip', skip);
      url.searchParams.append('limit', state.pagination.limit);
      
      if (search) {
        url.searchParams.append('search', search);
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
        state.users = data.items;
        state.pagination.totalPages = Math.ceil(data.total / state.pagination.limit);
        
        renderUsers();
        updatePagination();
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao carregar usuários', 'error');
      console.error('Erro ao carregar usuários:', error);
    }
  }

  async function loadCompanies() {
    try {
      // Limpa o array de empresas
      state.companies = [];
      
      // Usa um Map para rastrear empresas por código
      const companyMap = new Map();
      
      // Configuração inicial
      let pageSize = 1000; // Tenta usar um pageSize máximo primeiro
      let totalExpected = 0;
      let allPagesLoaded = false;
      
      // Iniciar mensagem de carregamento
      elements.availableCompanies.innerHTML = '<li class="loading-item">Carregando todas as empresas...</li>';
      
      // FASE 1: Tenta carregar tudo de uma vez primeiro
      try {
        const url = new URL(`${window.location.origin}/api/admin/companies`);
        url.searchParams.append('skip', 0);
        url.searchParams.append('limit', pageSize);
        
        console.log("[ESTRATÉGIA 1] Tentando carregar todas as empresas de uma vez");
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          totalExpected = data.total;
          
          if (data.items && data.items.length > 0) {
            for (const company of data.items) {
              companyMap.set(company.codigo, company);
            }
            
            state.companies = Array.from(companyMap.values());
            console.log(`[ESTRATÉGIA 1] Carregadas ${state.companies.length} de ${totalExpected} empresas`);
            
            if (state.companies.length >= totalExpected) {
              allPagesLoaded = true;
            }
          }
        }
      } catch (e) {
        console.error("[ESTRATÉGIA 1] Falha:", e);
      }
      
      // FASE 2: Se não funcionou, tenta carregar página por página
      if (!allPagesLoaded) {
        console.log("[ESTRATÉGIA 2] Carregando página por página");
        
        pageSize = 100; // Tamanho de página mais conservador
        let page = 0;
        let maxPage = Math.ceil(totalExpected / pageSize) + 3; // Algumas páginas extras para garantir
        
        while (page < maxPage && state.companies.length < totalExpected) {
          const skip = page * pageSize;
          try {
            const url = new URL(`${window.location.origin}/api/admin/companies`);
            url.searchParams.append('skip', skip);
            url.searchParams.append('limit', pageSize);
            
            console.log(`[ESTRATÉGIA 2] Carregando página ${page+1} (skip=${skip})`);
            elements.availableCompanies.innerHTML = `<li class="loading-item">Carregando empresas... página ${page+1} (${state.companies.length} de ${totalExpected})</li>`;
            
            const response = await fetch(url, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              credentials: 'include'
            });
            
            if (response.ok) {
              const data = await response.json();
              let newItems = 0;
              
              if (data.items && data.items.length > 0) {
                console.log(`[ESTRATÉGIA 2] Página ${page+1} contém ${data.items.length} empresas`);
                
                for (const company of data.items) {
                  if (!companyMap.has(company.codigo)) {
                    companyMap.set(company.codigo, company);
                    newItems++;
                  }
                }
                
                state.companies = Array.from(companyMap.values());
                console.log(`[ESTRATÉGIA 2] Total atual: ${state.companies.length}/${totalExpected} (${Math.round(state.companies.length/totalExpected*100)}%)`);
                
                // Se não há novas empresas e já tentamos mais de 2 páginas além do esperado, finalizamos
                if (newItems === 0 && page >= Math.ceil(totalExpected / pageSize) + 2) {
                  console.log("[ESTRATÉGIA 2] Sem novas empresas, finalizando");
                  break;
                }
              }
            }
          } catch (e) {
            console.error(`[ESTRATÉGIA 2] Erro na página ${page+1}:`, e);
          }
          
          page++;
        }
      }
      
      // FASE 3: Se ainda estiver faltando, tenta recuperar por código
      if (state.companies.length < totalExpected) {
        console.log("[ESTRATÉGIA 3] Tentando recuperar empresas faltantes");
        await tryRecoverAllCompanies(totalExpected, companyMap);
      }
      
      // FINALIZAÇÃO
      console.log(`[FINALIZAÇÃO] Total carregado: ${state.companies.length}/${totalExpected}`);
      
      // Atualiza filteredCompanies e ordena por nome
      state.filteredCompanies = [...state.companies];
      state.filteredCompanies.sort((a, b) => a.nome_abreviado.localeCompare(b.nome_abreviado));
      
      // Renderiza as listas se necessário
      if (state.userCompanies.length > 0) {
        renderCompanyLists();
      }
      
      // Mostra o toast com o resultado
      if (state.companies.length === totalExpected) {
        elements.availableCompanies.innerHTML = "";  // Limpa mensagem de carregamento
        showToast(`Sucesso! Todas as ${state.companies.length} empresas foram carregadas.`, 'success');
      } else {
        showToast(`Atenção: Carregadas ${state.companies.length} de ${totalExpected} empresas.`, 'warning');
      }
      
      // Força um re-render da lista para garantir
      if (state.companies.length > 0) {
        renderCompanyLists();
      }
    } catch (error) {
      console.error('[ERRO CRÍTICO] Falha geral:', error);
      showToast('Erro ao carregar empresas. Tente novamente.', 'error');
    }
  }

  // Função auxiliar para recuperar empresas faltantes
  async function tryRecoverAllCompanies(totalExpected, companyMap) {
    // Se chegarmos aqui, vamos tentar fazer buscas por código para encontrar empresas faltantes
    // Começamos criando um intervalo baseado nas empresas que já temos
    
    if (state.companies.length >= totalExpected) return;
    
    const knownCodes = Array.from(companyMap.keys());
    if (knownCodes.length === 0) return;
    
    // Encontramos o intervalo de códigos
    const minCode = Math.min(...knownCodes);
    const maxCode = Math.max(...knownCodes);
    const codeRange = maxCode - minCode;
    
    console.log(`[ESTRATÉGIA 3] Intervalo de códigos: ${minCode} a ${maxCode} (${codeRange} possíveis)`);
    
    // Se o intervalo for muito grande, tentamos outra abordagem
    if (codeRange > 2000) {
      console.log("[ESTRATÉGIA 3] Intervalo muito grande, tentando abordagem alternativa");
      await tryAlternativeRecovery(totalExpected, companyMap);
      return;
    }
    
    // Encontramos códigos que estão "faltando" no intervalo
    const missingCodes = [];
    for (let code = minCode; code <= maxCode; code++) {
      if (!companyMap.has(code)) {
        missingCodes.push(code);
      }
    }
    
    console.log(`[ESTRATÉGIA 3] Encontrados ${missingCodes.length} possíveis códigos faltantes`);
    
    // Tenta recuperar até 100 códigos faltantes
    const codesToTry = missingCodes.slice(0, 100);
    for (const code of codesToTry) {
      try {
        // Busca empresas usando o código como filtro
        const url = new URL(`${window.location.origin}/api/admin/companies`);
        url.searchParams.append('search', code.toString());
        
        elements.availableCompanies.innerHTML = `<li class="loading-item">Recuperando empresas... (${state.companies.length} de ${totalExpected})</li>`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            let newItems = 0;
            for (const company of data.items) {
              if (!companyMap.has(company.codigo)) {
                companyMap.set(company.codigo, company);
                newItems++;
              }
            }
            
            if (newItems > 0) {
              state.companies = Array.from(companyMap.values());
              console.log(`[ESTRATÉGIA 3] Recuperadas +${newItems} empresas, total: ${state.companies.length}/${totalExpected}`);
            }
            
            if (state.companies.length >= totalExpected) {
              break;
            }
          }
        }
      } catch (e) {
        // Ignora erros e continua
      }
    }
  }

  // Função para tentar uma terceira abordagem de recuperação
  async function tryAlternativeRecovery(totalExpected, companyMap) {
    console.log("[ESTRATÉGIA 4] Tentando método alternativo de recuperação");
    
    // Buscar por termos comuns em nomes de empresas
    const searchTerms = ["LTDA", "S.A", "COMERCIO", "SERVIÇOS", "CONSULTORIA", "INDUSTRIA", "EMPRESA"];
    
    for (const term of searchTerms) {
      if (state.companies.length >= totalExpected) break;
      
      try {
        const url = new URL(`${window.location.origin}/api/admin/companies`);
        url.searchParams.append('search', term);
        url.searchParams.append('limit', 1000);
        
        elements.availableCompanies.innerHTML = `<li class="loading-item">Buscando empresas com "${term}"... (${state.companies.length} de ${totalExpected})</li>`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            let newItems = 0;
            for (const company of data.items) {
              if (!companyMap.has(company.codigo)) {
                companyMap.set(company.codigo, company);
                newItems++;
              }
            }
            
            state.companies = Array.from(companyMap.values());
            console.log(`[ESTRATÉGIA 4] Busca por "${term}" encontrou ${newItems} novas empresas, total: ${state.companies.length}/${totalExpected}`);
          }
        }
      } catch (e) {
        console.error(`[ESTRATÉGIA 4] Erro buscando por "${term}":`, e);
      }
    }
  }

  async function loadUserCompanies(userId) {
    try {
      const response = await fetch(`${window.location.origin}/api/admin/users/${userId}/companies`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        state.userCompanies = await response.json();
        
        // Verificar duplicatas nas empresas do usuário
        const uniqueCompanies = new Map();
        const duplicates = [];
        
        state.userCompanies.forEach(company => {
          if (!uniqueCompanies.has(company.codigo)) {
            uniqueCompanies.set(company.codigo, company);
          } else {
            duplicates.push(company);
            console.log(`Empresa duplicada nas atribuições do usuário: ${company.codigo} - ${company.nome_abreviado}`);
          }
        });
        
        // Se encontramos duplicatas, limpe-as
        if (duplicates.length > 0) {
          console.log(`Removendo ${duplicates.length} empresas duplicadas das atribuições de usuário`);
          state.userCompanies = Array.from(uniqueCompanies.values());
        }
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao carregar empresas do usuário', 'error');
      console.error('Erro ao carregar empresas do usuário:', error);
    }
  }

  // Funções de renderização
  function renderUsers() {
    elements.usersTableBody.innerHTML = '';
    
    if (state.users.length === 0) {
      elements.usersTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">Nenhum usuário encontrado</td>
        </tr>
      `;
      return;
    }
    
    state.users.forEach(user => {
      const row = document.createElement('tr');
      
      // Formatação da data
      const formattedDate = new Date(user.dt_criacao).toLocaleDateString('pt-BR');
      
      // Badge para tipo de usuário
      const userTypeBadge = getUserTypeBadge(user.type_user);
      
      // Badge para status
      const statusBadge = user.active 
        ? '<span class="badge badge-success">Ativo</span>'
        : '<span class="badge badge-danger">Inativo</span>';
      
      row.innerHTML = `
        <td>${user.nome}</td>
        <td>${user.email}</td>
        <td>${userTypeBadge}</td>
        <td>${statusBadge}</td>
        <td>${formattedDate}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm btn-edit" data-id="${user.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-secondary btn-sm btn-companies" data-id="${user.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </button>
            <button class="btn btn-danger btn-sm btn-delete" data-id="${user.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </td>
      `;
      
      // Adicionar event listeners para botões de ação
      const editBtn = row.querySelector('.btn-edit');
      const companiesBtn = row.querySelector('.btn-companies');
      const deleteBtn = row.querySelector('.btn-delete');
      
      editBtn.addEventListener('click', () => showEditUserModal(user.id));
      companiesBtn.addEventListener('click', () => showCompaniesModal(user.id));
      deleteBtn.addEventListener('click', () => showDeleteConfirmation(user.id));
      
      elements.usersTableBody.appendChild(row);
    });
  }

  function getUserTypeBadge(type) {
    const types = {
      'user': { class: 'badge-user', label: 'Usuário' },
      'admin': { class: 'badge-admin', label: 'Administrador' },
      'superadmin': { class: 'badge-superadmin', label: 'Super Admin' }
    };
    
    const typeInfo = types[type] || types['user'];
    return `<span class="badge ${typeInfo.class}">${typeInfo.label}</span>`;
  }

  function updatePagination() {
    elements.paginationInfo.textContent = `Página ${state.pagination.currentPage} de ${state.pagination.totalPages}`;
    
    // Habilitar/desabilitar botões de navegação
    elements.btnPrevPage.disabled = state.pagination.currentPage <= 1;
    elements.btnNextPage.disabled = state.pagination.currentPage >= state.pagination.totalPages;
  }

  function renderCompanyLists() {
    // Limpar listas
    elements.availableCompanies.innerHTML = '';
    elements.assignedCompanies.innerHTML = '';
    
    // Reset seleções
    state.companyTransfer.availableSelected = [];
    state.companyTransfer.assignedSelected = [];
    
    // Criar sets de códigos das empresas já atribuídas para busca rápida
    const assignedCodes = new Set(state.userCompanies.map(company => company.codigo));
    
    // Empresas disponíveis (não atribuídas)
    const availableCompanies = state.filteredCompanies.filter(company => 
      !assignedCodes.has(company.codigo)
    );
    
    console.log(`Rendering available companies: ${availableCompanies.length} items`);
    
    // Renderizar empresas disponíveis
    if (availableCompanies.length === 0) {
      elements.availableCompanies.innerHTML = '<li class="loading-item">Nenhuma empresa disponível</li>';
    } else {
      // Para melhorar a performance, nós vamos criar um fragmento e adicionar as empresas em lotes
      const fragment = document.createDocumentFragment();
      
      // Definir um limite razoável para o número de empresas a mostrar de uma vez
      const batchSize = 100;
      const totalBatches = Math.ceil(availableCompanies.length / batchSize);
      
      for (let batch = 0; batch < totalBatches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, availableCompanies.length);
        
        console.log(`Rendering batch ${batch+1}/${totalBatches}: items ${start}-${end}`);
        
        for (let i = start; i < end; i++) {
          const company = availableCompanies[i];
          const li = document.createElement('li');
          li.dataset.id = company.id;
          li.dataset.codigo = company.codigo;
          li.textContent = `${company.nome_abreviado} (${company.codigo})`;
          
          li.addEventListener('click', () => toggleCompanySelection(li, 'available'));
          
          fragment.appendChild(li);
        }
      }
      
      // Adiciona tudo de uma vez ao DOM
      elements.availableCompanies.appendChild(fragment);
      
      // Adiciona uma mensagem indicando o total
      if (availableCompanies.length > batchSize) {
        const countInfo = document.createElement('li');
        countInfo.className = 'loading-item';
        countInfo.style.backgroundColor = '#f0f8ff'; // azul claro
        countInfo.textContent = `Total: ${availableCompanies.length} empresas disponíveis`;
        elements.availableCompanies.prepend(countInfo);
      }
    }
    
    // Renderizar empresas atribuídas
    if (state.userCompanies.length === 0) {
      elements.assignedCompanies.innerHTML = '<li class="loading-item">Nenhuma empresa atribuída</li>';
    } else {
      const fragment = document.createDocumentFragment();
      
      state.userCompanies.forEach(company => {
        const li = document.createElement('li');
        li.dataset.id = company.id;
        li.dataset.codigo = company.codigo;
        li.textContent = `${company.nome_abreviado} (${company.codigo})`;
        
        li.addEventListener('click', () => toggleCompanySelection(li, 'assigned'));
        
        fragment.appendChild(li);
      });
      
      elements.assignedCompanies.appendChild(fragment);
    }
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
  
  function resetUserForm() {
    elements.userForm.reset();
    elements.userId.value = '';
    elements.passwordHelpText.style.display = 'none';
    updateActiveStatus();
  }
  
  function showAddUserModal() {
    resetUserForm();
    elements.modalTitle.textContent = 'Adicionar Usuário';
    elements.passwordHelpText.style.display = 'none';
    showModal(elements.userModal);
  }
  
  async function showEditUserModal(userId) {
    resetUserForm();
    elements.modalTitle.textContent = 'Editar Usuário';
    elements.passwordHelpText.style.display = 'block';
    
    try {
      const response = await fetch(`${window.location.origin}/api/admin/users/${userId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const user = await response.json();
        
        // Preencher formulário
        elements.userId.value = user.id;
        elements.nome.value = user.nome;
        elements.email.value = user.email;
        elements.typeUser.value = user.type_user;
        elements.active.checked = user.active;
        updateActiveStatus();
        
        showModal(elements.userModal);
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao carregar dados do usuário', 'error');
      console.error('Erro ao carregar dados do usuário:', error);
    }
  }
  
  async function showCompaniesModal(userId) {
    state.selectedUser = userId;
    
    elements.companiesModalTitle.textContent = 'Gerenciar Empresas do Usuário';
    
    // Reset do filtro
    elements.companySearchInput.value = '';
    
    try {
      // Buscar todas as empresas se ainda não foram carregadas
      if (state.companies.length === 0) {
        await loadCompanies();
      } else {
        console.log(`Usando ${state.companies.length} empresas já carregadas`);
      }
      
      // Buscar empresas do usuário
      await loadUserCompanies(userId);
      
      // Atualiza filteredCompanies com a lista atual de empresas
      state.filteredCompanies = [...state.companies];
      
      // Renderizar listas
      renderCompanyLists();
      
      showModal(elements.companiesModal);
    } catch (error) {
      showToast('Erro ao preparar gerenciamento de empresas', 'error');
      console.error('Erro ao preparar gerenciamento de empresas:', error);
    }
  }
  
  function showDeleteConfirmation(userId) {
    const user = state.users.find(u => u.id === userId);
    
    if (!user) {
      showToast('Usuário não encontrado', 'error');
      return;
    }
    
    elements.confirmModalTitle.textContent = 'Confirmar Exclusão';
    elements.confirmModalMessage.textContent = `Tem certeza que deseja excluir o usuário "${user.nome}"?`;
    
    // Configurar callback para o botão de confirmação
    elements.confirmBtn.onclick = () => {
      deleteUser(userId);
      hideModal(elements.confirmModal);
    };
    
    showModal(elements.confirmModal);
  }

  // Funções de manipulação de dados
  async function saveUser() {
    const isEditing = !!elements.userId.value;
    
    const userData = {
      nome: elements.nome.value,
      email: elements.email.value,
      type_user: elements.typeUser.value,
      active: elements.active.checked
    };
    
    // Adicionar senha apenas se estiver preenchida ou for um novo usuário
    if (elements.senha.value || !isEditing) {
      userData.senha = elements.senha.value;
    }
    
    try {
      let url = `${window.location.origin}/api/admin/users`;
      let method = 'POST';
      
      if (isEditing) {
        url = `${url}/${elements.userId.value}`;
        method = 'PUT';
      }
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      
      if (response.ok) {
        hideModal(elements.userModal);
        showToast(`Usuário ${isEditing ? 'atualizado' : 'criado'} com sucesso!`, 'success');
        loadUsers(elements.searchInput.value);
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast(`Erro ao ${isEditing ? 'atualizar' : 'criar'} usuário`, 'error');
      console.error(`Erro ao ${isEditing ? 'atualizar' : 'criar'} usuário:`, error);
    }
  }
  
  async function deleteUser(userId) {
    try {
      const response = await fetch(`${window.location.origin}/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        showToast('Usuário excluído com sucesso!', 'success');
        loadUsers(elements.searchInput.value);
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao excluir usuário', 'error');
      console.error('Erro ao excluir usuário:', error);
    }
  }
  
  function toggleCompanySelection(element, listType) {
    element.classList.toggle('selected');
    
    const companyId = element.dataset.id;
    
    if (listType === 'available') {
      if (element.classList.contains('selected')) {
        state.companyTransfer.availableSelected.push(companyId);
      } else {
        state.companyTransfer.availableSelected = state.companyTransfer.availableSelected.filter(id => id !== companyId);
      }
    } else {
      if (element.classList.contains('selected')) {
        state.companyTransfer.assignedSelected.push(companyId);
      } else {
        state.companyTransfer.assignedSelected = state.companyTransfer.assignedSelected.filter(id => id !== companyId);
      }
    }
    
    // Atualizar estado dos botões de transferência
    elements.btnAddCompanies.disabled = state.companyTransfer.availableSelected.length === 0;
    elements.btnRemoveCompanies.disabled = state.companyTransfer.assignedSelected.length === 0;
  }
  
  function moveCompaniesToAssigned() {
    if (state.companyTransfer.availableSelected.length === 0) return;
    
    // Para cada empresa selecionada na lista disponível
    state.companyTransfer.availableSelected.forEach(companyId => {
      const company = state.companies.find(c => c.id === companyId);
      if (company) {
        // Verifica se a empresa já existe no array de userCompanies (por código)
        const existingIndex = state.userCompanies.findIndex(c => c.codigo === company.codigo);
        
        if (existingIndex === -1) {
          // Adiciona apenas se não existir
          state.userCompanies.push(company);
        } else {
          console.log(`Empresa ${company.codigo} - ${company.nome_abreviado} já está atribuída ao usuário.`);
        }
      }
    });
    
    // Rerender as listas
    renderCompanyLists();
  }
  
  function moveCompaniesToAvailable() {
    if (state.companyTransfer.assignedSelected.length === 0) return;
    
    // Remover empresas selecionadas da lista de atribuídas
    state.userCompanies = state.userCompanies.filter(company => 
      !state.companyTransfer.assignedSelected.includes(company.id)
    );
    
    // Rerender as listas
    renderCompanyLists();
  }
  
  function filterCompanies() {
    const searchTerm = elements.companySearchInput.value.toLowerCase();
    
    if (searchTerm === '') {
      state.filteredCompanies = [...state.companies];
    } else {
      state.filteredCompanies = state.companies.filter(company => 
        company.nome_abreviado.toLowerCase().includes(searchTerm) || 
        company.razao_social.toLowerCase().includes(searchTerm) ||
        company.codigo.toString().includes(searchTerm)
      );
    }
    
    renderCompanyLists();
  }
  
  async function saveCompanyAssignments() {
    if (!state.selectedUser) {
      showToast('Erro: Usuário não selecionado', 'error');
      return;
    }
    
    try {
      const companyIds = state.userCompanies.map(company => company.id);
      
      const response = await fetch(`${window.location.origin}/api/admin/users/${state.selectedUser}/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ company_ids: companyIds })
      });
      
      if (response.ok) {
        hideModal(elements.companiesModal);
        showToast('Empresas atualizadas com sucesso!', 'success');
      } else {
        handleApiError(response);
      }
    } catch (error) {
      showToast('Erro ao atualizar empresas', 'error');
      console.error('Erro ao atualizar empresas:', error);
    }
  }

  // Funções de navegação e paginação
  function prevPage() {
    if (state.pagination.currentPage > 1) {
      state.pagination.currentPage--;
      loadUsers(elements.searchInput.value);
    }
  }
  
  function nextPage() {
    if (state.pagination.currentPage < state.pagination.totalPages) {
      state.pagination.currentPage++;
      loadUsers(elements.searchInput.value);
    }
  }
  
  // Funções auxiliares
  function updateActiveStatus() {
    elements.activeStatus.textContent = elements.active.checked ? 'Ativo' : 'Inativo';
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