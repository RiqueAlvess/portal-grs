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
      // Carregar usuários iniciais
      loadUsers();
      
      // Configurar event listeners
      setupEventListeners();
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
        state.companies = [];
        let page = 0;
        let hasMoreData = true;
        const pageSize = 100;
        

        elements.availableCompanies.innerHTML = '<li class="loading-item">Carregando empresas...</li>';
        
        while (hasMoreData) {
          const skip = page * pageSize;
          const url = new URL(`${window.location.origin}/api/admin/companies`);
          url.searchParams.append('skip', skip);
          url.searchParams.append('limit', pageSize);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            
            state.companies = [...state.companies, ...data.items];

            hasMoreData = data.items.length === pageSize;
            page++;
            
            if (hasMoreData) {
              elements.availableCompanies.innerHTML = `<li class="loading-item">Carregando empresas... (${state.companies.length} de ~${Math.max(data.total, state.companies.length)})</li>`;
            }
          } else {
            handleApiError(response);
            hasMoreData = false;
          }
        }
        
        state.filteredCompanies = [...state.companies];
        
        logger.info(`Total de ${state.companies.length} empresas carregadas`);
      } catch (error) {
        showToast('Erro ao carregar empresas', 'error');
        console.error('Erro ao carregar empresas:', error);
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
      
      // Criar arrays de IDs das empresas já atribuídas
      const assignedIds = state.userCompanies.map(company => company.id);
      
      // Empresas disponíveis (não atribuídas)
      const availableCompanies = state.filteredCompanies.filter(company => 
        !assignedIds.includes(company.id)
      );
      
      // Renderizar empresas disponíveis
      if (availableCompanies.length === 0) {
        elements.availableCompanies.innerHTML = '<li class="loading-item">Nenhuma empresa disponível</li>';
      } else {
        availableCompanies.forEach(company => {
          const li = document.createElement('li');
          li.dataset.id = company.id;
          li.textContent = `${company.nome_abreviado} (${company.codigo})`;
          
          li.addEventListener('click', () => toggleCompanySelection(li, 'available'));
          
          elements.availableCompanies.appendChild(li);
        });
      }
      
      // Renderizar empresas atribuídas
      if (state.userCompanies.length === 0) {
        elements.assignedCompanies.innerHTML = '<li class="loading-item">Nenhuma empresa atribuída</li>';
      } else {
        state.userCompanies.forEach(company => {
          const li = document.createElement('li');
          li.dataset.id = company.id;
          li.textContent = `${company.nome_abreviado} (${company.codigo})`;
          
          li.addEventListener('click', () => toggleCompanySelection(li, 'assigned'));
          
          elements.assignedCompanies.appendChild(li);
        });
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
        }
        
        // Buscar empresas do usuário
        await loadUserCompanies(userId);
        
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
          state.userCompanies.push(company);
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