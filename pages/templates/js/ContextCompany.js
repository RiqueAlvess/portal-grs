/**
 * CompanyContext - Serviço para gerenciar o contexto da empresa atual
 * 
 * Este script deve ser incluído em todas as páginas que precisam
 * conhecer qual é a empresa atual selecionada pelo usuário.
 */

await fetch("/api/user/current-company", {
  method: "GET",
  credentials: "include"
});


class CompanyContext {
  constructor() {
    this.company = null;
    this.companies = [];
    this.isLoading = false;
    this.error = null;
    this.listeners = [];
    this.initialized = false;
    this.autoSelectionDone = false; // Controle de auto-seleção
  }

  /**
   * Inicializar o contexto da empresa
   * @returns {Promise} Promise que resolve quando o contexto estiver pronto
   */
  async init() {
    if (this.initialized) return;
    
    try {
      this.isLoading = true;
      this.notifyListeners();
      
      // Primeiro, obter a empresa atual se já estiver selecionada
      await this.loadCurrentCompany();
      
      // Se não temos empresa selecionada, carregar empresas disponíveis
      if (!this.company) {
        await this.loadAvailableCompanies();
        
        // Auto-selecionar a primeira empresa em ordem alfabética se não tiver nenhuma selecionada
        if (!this.company && this.companies.length > 0 && !this.autoSelectionDone) {
          this.autoSelectionDone = true;
          await this.autoSelectFirstCompany();
        }
      }
    } catch (error) {
      this.error = error.message || 'Erro desconhecido';
      this.company = null;
      console.error('Erro ao inicializar contexto da empresa:', error);
    } finally {
      this.isLoading = false;
      this.initialized = true;
      this.notifyListeners();
    }
  }

  /**
   * Carregar a empresa ativa atual
   */
  async loadCurrentCompany() {
    try {
      const response = await fetch('/api/configuracoes/empresa-ativa', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        this.company = await response.json();
        this.error = null;
      } else {
        // 404 significa que não há empresa selecionada, não é erro
        if (response.status === 404) {
          this.company = null;
          this.error = null;
        } else {
          try {
            const errorData = await response.json();
            this.error = errorData.detail || 'Erro ao carregar empresa';
          } catch (e) {
            this.error = `Erro ${response.status}: ${response.statusText}`;
          }
          this.company = null;
          console.error('Erro ao carregar empresa:', this.error);
        }
      }
    } catch (error) {
      this.error = error.message || 'Erro ao carregar empresa ativa';
      this.company = null;
      console.error('Erro ao carregar empresa ativa:', error);
    }
  }

  /**
   * Carregar as empresas disponíveis para o usuário
   */
  async loadAvailableCompanies() {
    try {
      const response = await fetch('/api/user/companies', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        this.companies = await response.json();
      } else {
        this.companies = [];
        console.error('Erro ao carregar empresas:', response.status);
      }
    } catch (error) {
      this.companies = [];
      console.error('Erro ao carregar empresas disponíveis:', error);
    }
  }

  /**
   * Auto-selecionar a primeira empresa em ordem alfabética
   */
  async autoSelectFirstCompany() {
    if (this.companies.length === 0) return;
    
    // Ordenar por nome
    const sortedCompanies = [...this.companies].sort((a, b) => 
      a.nome_abreviado.localeCompare(b.nome_abreviado)
    );
    
    // Selecionar a primeira
    const firstCompany = sortedCompanies[0];
    
    try {
      // Enviar solicitação para selecionar empresa
      const response = await fetch('/api/configuracoes/selecionar-empresa', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          empresa_id: firstCompany.id
        })
      });
      
      if (response.ok) {
        // Atualizar o contexto com a empresa selecionada
        this.company = firstCompany;
        console.log(`Empresa selecionada automaticamente: ${firstCompany.nome_abreviado}`);
      } else {
        console.error('Erro ao selecionar empresa automaticamente:', response.status);
      }
    } catch (error) {
      console.error('Erro ao selecionar primeira empresa:', error);
    }
  }

  /**
   * Obter os dados da empresa atual
   * @returns {Object|null} Dados da empresa ou null se não houver seleção
   */
  getCompany() {
    return this.company;
  }

  /**
   * Verificar se existe uma empresa selecionada
   * @returns {boolean} True se existe uma empresa selecionada
   */
  hasCompany() {
    return this.company !== null;
  }

  /**
   * Verificar se o contexto está carregando
   * @returns {boolean} True se o contexto estiver carregando
   */
  isCompanyLoading() {
    return this.isLoading;
  }

  /**
   * Obter o erro atual (se houver)
   * @returns {string|null} Mensagem de erro ou null
   */
  getError() {
    return this.error;
  }

  /**
   * Adicionar um listener para mudanças no contexto
   * @param {Function} listener Função a ser chamada quando o contexto mudar
   * @returns {Function} Função para remover o listener
   */
  addListener(listener) {
    if (typeof listener !== 'function') {
      throw new Error('O listener deve ser uma função');
    }
    
    this.listeners.push(listener);
    
    // Notificar imediatamente com o estado atual
    listener(this.getState());
    
    // Retornar função para remover o listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Obter o estado completo do contexto
   * @returns {Object} Estado do contexto
   */
  getState() {
    return {
      company: this.company,
      isLoading: this.isLoading,
      error: this.error,
      hasCompany: this.hasCompany()
    };
  }

  /**
   * Notificar todos os listeners sobre mudanças no contexto
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Criar e inserir um banner de seleção de empresa
   * @param {HTMLElement} containerElement Elemento onde o banner será inserido
   */
  createCompanyBanner(containerElement) {
    if (!containerElement) return;
    
    // Verificar se já existe um banner
    const existingBanner = document.getElementById('company-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    // Criar o banner
    const banner = document.createElement('div');
    banner.id = 'company-banner';
    banner.classList.add('company-banner');
    
    // Atualizar o conteúdo do banner
    this.updateBannerContent(banner);
    
    // Inserir no início do container
    containerElement.insertBefore(banner, containerElement.firstChild);
    
    // Adicionar listener para atualizar o banner quando o contexto mudar
    this.addListener(() => {
      this.updateBannerContent(banner);
    });
    
    // Adicionar estilo
    this.addBannerStyle();
  }

  /**
   * Atualizar o conteúdo do banner
   * @param {HTMLElement} banner Elemento do banner
   */
  updateBannerContent(banner) {
    if (!banner) return;
    
    if (this.isLoading) {
      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          </div>
          <div class="banner-message">Carregando dados da empresa...</div>
        </div>
      `;
      banner.className = 'company-banner company-banner-loading';
    } else if (this.error && this.error !== 'Nenhuma empresa selecionada') {
      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div class="banner-message">Erro: ${this.error}</div>
          <a href="/configuracoes" class="banner-action">Configurações</a>
        </div>
      `;
      banner.className = 'company-banner company-banner-error';
    } else if (!this.company) {
      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <div class="banner-message">Nenhuma empresa selecionada. Selecione uma empresa para visualizar os dados.</div>
          <a href="/configuracoes" class="banner-action">Selecionar Empresa</a>
        </div>
      `;
      banner.className = 'company-banner company-banner-warning';
    } else {
      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          </div>
          <div class="banner-info">
            <div class="banner-company-name">${this.company.nome_abreviado}</div>
            <div class="banner-company-details">Código: ${this.company.codigo} | CNPJ: ${this.company.cnpj || 'N/A'}</div>
          </div>
          <a href="/configuracoes" class="banner-action">Alterar</a>
        </div>
      `;
      banner.className = 'company-banner company-banner-success';
    }
  }

  /**
   * Adicionar estilos para o banner
   */
  addBannerStyle() {
    // Verificar se o estilo já existe
    if (document.getElementById('company-banner-style')) return;
    
    const style = document.createElement('style');
    style.id = 'company-banner-style';
    style.textContent = `
      .company-banner {
        width: 100%;
        padding: 10px 16px;
        margin-bottom: 20px;
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .company-banner-success {
        background-color: #e6f7ee;
        border: 1px solid #5cb85c;
        color: #2c662d;
      }
      
      .company-banner-warning {
        background-color: #fff5e6;
        border: 1px solid #f0ad4e;
        color: #a76a00;
      }
      
      .company-banner-error {
        background-color: #fbe7e6;
        border: 1px solid #d9534f;
        color: #a02622;
      }
      
      .company-banner-loading {
        background-color: #f8f9fa;
        border: 1px solid #ddd;
        color: #666;
      }
      
      .banner-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .banner-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .banner-message {
        flex: 1;
      }
      
      .banner-info {
        flex: 1;
      }
      
      .banner-company-name {
        font-weight: 600;
        margin-bottom: 2px;
      }
      
      .banner-company-details {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      .banner-action {
        text-decoration: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: 500;
        background-color: rgba(255, 255, 255, 0.5);
        transition: background-color 0.2s;
      }
      
      .company-banner-success .banner-action {
        color: #2c662d;
      }
      
      .company-banner-warning .banner-action {
        color: #a76a00;
      }
      
      .company-banner-error .banner-action {
        color: #a02622;
      }
      
      .banner-action:hover {
        background-color: rgba(255, 255, 255, 0.8);
        text-decoration: none;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Criar e exportar a instância singleton
window.companyContext = new CompanyContext();