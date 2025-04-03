document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

function initDashboard() {
  loadUserData();
  setupNavigation();
  setupEventListeners();
}

function loadUserData() {
  const userDataStr = sessionStorage.getItem('userDisplayInfo');
  
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      updateUserInterface(userData);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      fetchUserProfile();
    }
  } else {
    fetchUserProfile();
  }
}

async function fetchUserProfile() {
  try {
    const response = await fetch('/api/user-profile', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      const displayData = {
        nome: userData.nome,
        email: userData.email,
        type_user: userData.type_user || 'user'
      };
      
      sessionStorage.setItem('userDisplayInfo', JSON.stringify(displayData));
      updateUserInterface(displayData);
    }
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
  }
}

function updateUserInterface(userData) {
  const userNameElement = document.getElementById('user-name');
  if (userNameElement && userData.nome) {
    userNameElement.textContent = userData.nome;
  }
}

function setupNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.sidebar nav ul li a');
  
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href');
    const linkParent = link.parentElement;
    
    if (currentPath === linkPath) {
      linkParent.classList.add('active');
    } else {
      linkParent.classList.remove('active');
    }
  });
}

function setupEventListeners() {
  // Action buttons
  const actionButtons = document.querySelectorAll('.btn-text');
  actionButtons.forEach(button => {
    button.addEventListener('click', handleActionClick);
  });
  
  // Table rows
  const tableRows = document.querySelectorAll('.data-table tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('click', handleRowClick);
  });
}

function handleActionClick(event) {
  const button = event.currentTarget;
  const panel = button.closest('.panel');
  
  if (panel.classList.contains('latest-attestations')) {
    window.location.href = '/atestados';
  } else if (panel.classList.contains('upcoming-exams')) {
    window.location.href = '/exames';
  }
}

function handleRowClick(event) {
  // Ignora o clique se for em um botão
  if (event.target.tagName.toLowerCase() === 'button') {
    return;
  }
  
  const row = event.currentTarget;
  const userName = row.querySelector('.user-name').textContent;
  
  console.log(`Clicou na linha de ${userName}`);
  // Aqui você pode adicionar uma ação como redirecionar para uma página de detalhes
}