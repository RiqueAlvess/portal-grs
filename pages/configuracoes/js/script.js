document.addEventListener('DOMContentLoaded', function() {
  // Estado da aplicação
  const state = {
    user: null,
    companies: [],
    selectedCompany: null,
    passwordStrength: 0,
    notification: {
      timer: null,
      duration: 5000 // 5 segundos
    },
    autoSelectionDone: false // Flag para controlar se já fizemos auto-seleção
  };

  // Elementos do DOM
  const elements = {
    // Formulário de alteração de senha
    passwordForm: document.getElementById('changePasswordForm'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    strengthBar: document.getElementById('strengthBar'),
    strengthText: document.getElementById('strengthText'),
    togglePasswordButtons: document.querySelectorAll('.toggle-password'),
    
    // Seleção de empresa
    companySelect: document.getElementById('companySelect'),
    companyCodigo: document.getElementById('companyCodigo'),
    companyRazaoSocial: document.getElementById('companyRazaoSocial'),
    companyCNPJ: document.getElementById('companyCNPJ'),
    companyCidadeUF: document.getElementById('companyCidadeUF'),
    saveCompanyBtn: document.getElementById('saveCompanyBtn'), // Novo botão de salvar
    
    // Notificação
    notificationToast: document.getElementById('notificationToast'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationClose: document.querySelector('.notification-close')
  };

  // Inicialização
  init();

  // Função de inicialização
  async function init() {
    try {
      await loadUserProfile();
      await loadCompanies();
      await getCurrentCompany();
      
      // Se não temos empresa selecionada e temos empresas disponíveis, 
      // selecionar automaticamente a primeira em ordem alfabética
      if (!state.selectedCompany && state.companies.length > 0 && !state.autoSelectionDone) {
        state.autoSelectionDone = true; // Marcar que já tentamos auto-seleção
        await autoSelectFirstCompany();
      }
      
      setupEventListeners();
    } catch (error) {
      console.error('Erro na inicialização:', error);
      showNotification('Erro ao carregar configurações. Tente novamente mais tarde.', 'error');
    }
  }

  // Auto-selecionar a primeira empresa em ordem alfabética
  async function autoSelectFirstCompany() {
    if (state.companies.length === 0) return;
    
    // Ordenar empresas por nome
    const sortedCompanies = [...state.companies].sort((a, b) => 
      a.nome_abreviado.localeCompare(b.nome_abreviado)
    );
    
    // Pegar a primeira empresa
    const firstCompany = sortedCompanies[0];
    
    // Selecionar no dropdown
    if (elements.companySelect) {
      elements.companySelect.value = firstCompany.id;
    }
    
    // Selecionar no estado
    state.selectedCompany = firstCompany;
    
    // Atualizar detalhes
    updateCompanyDetails();
    
    // Salvar no servidor
    await saveSelectedCompany(firstCompany.id);
  }

  // Salvar empresa selecionada no servidor
  async function saveSelectedCompany(companyId) {
    try {
      // Desabilitar botão de salvar durante o processamento
      if (elements.saveCompanyBtn) {
        elements.saveCompanyBtn.disabled = true;
        elements.saveCompanyBtn.textContent = 'Salvando...';
      }
      
      const response = await fetch('/api/configuracoes/selecionar-empresa', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          empresa_id: companyId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao selecionar empresa');
      }
      
      const data = await response.json();
      showNotification(`Empresa "${data.empresa.nome_abreviado}" selecionada com sucesso!`, 'success');
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      showNotification(error.message || 'Erro ao selecionar empresa. Tente novamente.', 'error');
      return false;
    } finally {
      // Reativar botão de salvar
      if (elements.saveCompanyBtn) {
        elements.saveCompanyBtn.disabled = false;
        elements.saveCompanyBtn.textContent = 'Salvar';
      }
    }
  }
  
  // Remover seleção de empresa
  async function clearCompanySelection() {
    try {
      if (elements.saveCompanyBtn) {
        elements.saveCompanyBtn.disabled = true;
        elements.saveCompanyBtn.textContent = 'Removendo...';
      }
      
      await fetch('/api/configuracoes/selecionar-empresa', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      state.selectedCompany = null;
      updateCompanyDetails();
      
      if (elements.companySelect) {
        elements.companySelect.value = '';
      }
      
      showNotification('Seleção de empresa removida com sucesso.', 'info');
      
      return true;
    } catch (error) {
      console.error('Erro ao remover seleção de empresa:', error);
      showNotification('Erro ao remover seleção de empresa.', 'error');
      return false;
    } finally {
      if (elements.saveCompanyBtn) {
        elements.saveCompanyBtn.disabled = false;
        elements.saveCompanyBtn.textContent = 'Salvar';
      }
    }
  }

  // Configurar event listeners
  function setupEventListeners() {
    // Toggle de visibilidade da senha
    elements.togglePasswordButtons.forEach(button => {
      button.addEventListener('click', togglePasswordVisibility);
    });
    
    // Medidor de força da senha
    elements.newPassword.addEventListener('input', checkPasswordStrength);
    
    // Submit do formulário de alteração de senha
    elements.passwordForm.addEventListener('submit', handlePasswordChange);
    
    // Botão de salvar seleção de empresa
    if (elements.saveCompanyBtn) {
      elements.saveCompanyBtn.addEventListener('click', handleSaveCompany);
    }
    
    // Seleção de empresa (para atualizar a UI, mas não salva ainda)
    elements.companySelect.addEventListener('change', handleCompanyChange);
    
    // Fechamento da notificação
    elements.notificationClose.addEventListener('click', hideNotification);
  }

  // Manipular clique no botão de salvar
  async function handleSaveCompany() {
    const companyId = elements.companySelect.value;
    
    if (!companyId) {
      // Se não há empresa selecionada, remover seleção atual
      const success = await clearCompanySelection();
      if (success) {
        // Recarregar a página para atualizar todas as informações
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
      return;
    }
    
    // Encontrar a empresa selecionada
    const selectedCompany = state.companies.find(company => company.id === companyId);
    
    if (!selectedCompany) {
      showNotification('Empresa não encontrada.', 'error');
      return;
    }
    
    const success = await saveSelectedCompany(companyId);
    if (success) {
      state.selectedCompany = selectedCompany;
      updateCompanyDetails();
      
      // Recarregar a página para atualizar todas as informações
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  // Carregar perfil do usuário
  async function loadUserProfile() {
    try {
      const response = await fetch('/api/user-profile', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar perfil: ${response.status}`);
      }
      
      state.user = await response.json();
      
      // Atualizar nome do usuário na UI se necessário
      const userNameElement = document.getElementById('user-name');
      if (userNameElement && state.user.nome) {
        userNameElement.textContent = state.user.nome;
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
      throw error;
    }
  }

  // Carregar empresas do usuário
  async function loadCompanies() {
    try {
      const response = await fetch('/api/user/companies', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar empresas: ${response.status}`);
      }
      
      state.companies = await response.json();
      populateCompanySelect();
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      elements.companySelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
      throw error;
    }
  }

  // Obter empresa atual selecionada
  async function getCurrentCompany() {
    try {
      const response = await fetch('/api/configuracoes/empresa-ativa', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Se não houver empresa selecionada ainda, não é um erro
        if (response.status === 404) {
          state.selectedCompany = null;
          return;
        }
        throw new Error(`Erro ao obter empresa atual: ${response.status}`);
      }
      
      state.selectedCompany = await response.json();
      updateCompanyDetails();
      
      // Selecionar a empresa no dropdown
      if (state.selectedCompany && elements.companySelect) {
        elements.companySelect.value = state.selectedCompany.id;
      }
    } catch (error) {
      console.error('Erro ao obter empresa atual:', error);
    }
  }

  // Preencher o select de empresas
  function populateCompanySelect() {
    if (!elements.companySelect) return;
    
    elements.companySelect.innerHTML = '';
    
    if (state.companies.length === 0) {
      elements.companySelect.innerHTML = '<option value="">Nenhuma empresa disponível</option>';
      return;
    }
    
    // Adicionar opção default
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecione uma empresa...';
    elements.companySelect.appendChild(defaultOption);
    
    // Adicionar empresas ordenadas por nome
    const sortedCompanies = [...state.companies].sort((a, b) => 
      a.nome_abreviado.localeCompare(b.nome_abreviado)
    );
    
    sortedCompanies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.id;
      option.textContent = `${company.nome_abreviado} (${company.codigo})`;
      elements.companySelect.appendChild(option);
    });
  }

  // Atualizar detalhes da empresa na UI
  function updateCompanyDetails() {
    if (!state.selectedCompany) {
      elements.companyCodigo.textContent = '-';
      elements.companyRazaoSocial.textContent = '-';
      elements.companyCNPJ.textContent = '-';
      elements.companyCidadeUF.textContent = '-';
      return;
    }
    
    elements.companyCodigo.textContent = state.selectedCompany.codigo || '-';
    elements.companyRazaoSocial.textContent = state.selectedCompany.razao_social || '-';
    elements.companyCNPJ.textContent = formatCNPJ(state.selectedCompany.cnpj) || '-';
    
    const cidade = state.selectedCompany.cidade || '';
    const uf = state.selectedCompany.uf || '';
    elements.companyCidadeUF.textContent = cidade && uf ? `${cidade}/${uf}` : '-';
  }

  // Formatar CNPJ
  function formatCNPJ(cnpj) {
    if (!cnpj) return '';
    
    // Remove caracteres não numéricos
    const numericCnpj = cnpj.replace(/\D/g, '');
    
    // Verifica se tem o tamanho correto
    if (numericCnpj.length !== 14) return cnpj;
    
    // Aplica a formatação
    return numericCnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }

  // Alternar visibilidade da senha
  function togglePasswordVisibility(event) {
    const button = event.currentTarget;
    const targetId = button.getAttribute('data-target');
    const inputElement = document.getElementById(targetId);
    
    if (inputElement.type === 'password') {
      inputElement.type = 'text';
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
      inputElement.type = 'password';
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
  }

  // Verificar força da senha
  function checkPasswordStrength() {
    const password = elements.newPassword.value;
    
    // Critérios de força
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    
    // Calcular pontuação (0-100)
    let strength = 0;
    
    if (password.length > 0) {
      // Comprimento básico (até 40 pontos)
      strength += Math.min(40, (password.length * 5));
      
      // Critérios adicionais (15 pontos cada)
      if (hasLowerCase) strength += 15;
      if (hasUpperCase) strength += 15;
      if (hasNumber) strength += 15;
      if (hasSpecialChar) strength += 15;
    }
    
    // Limitar a 100
    strength = Math.min(100, strength);
    state.passwordStrength = strength;
    
    // Atualizar UI
    elements.strengthBar.style.width = `${strength}%`;
    
    // Cor da barra baseada na força
    if (strength < 30) {
      elements.strengthBar.style.backgroundColor = '#d9534f'; // Vermelho
      elements.strengthText.textContent = 'Senha fraca';
    } else if (strength < 60) {
      elements.strengthBar.style.backgroundColor = '#f0ad4e'; // Amarelo
      elements.strengthText.textContent = 'Senha média';
    } else if (strength < 80) {
      elements.strengthBar.style.backgroundColor = '#5bc0de'; // Azul
      elements.strengthText.textContent = 'Senha forte';
    } else {
      elements.strengthBar.style.backgroundColor = '#5cb85c'; // Verde
      elements.strengthText.textContent = 'Senha muito forte';
    }
  }

  // Manipular mudança de senha
  async function handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = elements.currentPassword.value;
    const newPassword = elements.newPassword.value;
    const confirmPassword = elements.confirmPassword.value;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('Preencha todos os campos de senha.', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showNotification('A nova senha e a confirmação não coincidem.', 'error');
      return;
    }
    
    if (state.passwordStrength < 30) {
      showNotification('A senha é muito fraca. Escolha uma senha mais segura.', 'warning');
      return;
    }
    
    // Desabilitar botão durante o processamento
    elements.changePasswordBtn.disabled = true;
    elements.changePasswordBtn.textContent = 'Alterando...';
    
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao alterar senha');
      }
      
      // Limpar formulário
      elements.passwordForm.reset();
      elements.strengthBar.style.width = '0%';
      elements.strengthText.textContent = 'Força da senha';
      
      showNotification('Senha alterada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      showNotification(error.message || 'Erro ao alterar senha. Tente novamente.', 'error');
    } finally {
      elements.changePasswordBtn.disabled = false;
      elements.changePasswordBtn.textContent = 'Alterar Senha';
    }
  }

  // Manipular mudança de empresa (só atualiza a UI, não salva ainda)
  function handleCompanyChange(event) {
    const companyId = event.target.value;
    
    if (!companyId) {
      // Usuário selecionou a opção vazia
      state.selectedCompany = null;
      updateCompanyDetails();
      return;
    }
    
    // Encontrar a empresa selecionada
    const selectedCompany = state.companies.find(company => company.id === companyId);
    
    if (!selectedCompany) {
      showNotification('Empresa não encontrada.', 'error');
      return;
    }
    
    // Apenas atualizar a UI, não salvar ainda
    state.selectedCompany = selectedCompany;
    updateCompanyDetails();
  }

  // Mostrar notificação
  function showNotification(message, type = 'info') {
    // Limpar timer anterior se existir
    if (state.notification.timer) {
      clearTimeout(state.notification.timer);
    }
    
    // Definir mensagem e tipo
    elements.notificationMessage.textContent = message;
    
    // Remover classes anteriores
    elements.notificationToast.classList.remove('success', 'error', 'warning', 'info');
    
    // Adicionar classe de tipo
    elements.notificationToast.classList.add(type);
    
    // Mostrar notificação
    elements.notificationToast.classList.add('show');
    
    // Configurar timer para esconder
    state.notification.timer = setTimeout(() => {
      hideNotification();
    }, state.notification.duration);
  }

  // Esconder notificação
  function hideNotification() {
    elements.notificationToast.classList.remove('show');
    
    if (state.notification.timer) {
      clearTimeout(state.notification.timer);
      state.notification.timer = null;
    }
  }
});