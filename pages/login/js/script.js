document.addEventListener("DOMContentLoaded", function() {
  const loginForm = document.getElementById("loginForm");
  const inputs = document.querySelectorAll('.input');
  
  for (let i = 0; i < inputs.length; i++) {
    inputs[i].addEventListener('focus', function() {
      this.parentElement.classList.add('input-focused');
    });
    
    inputs[i].addEventListener('blur', function() {
      if (this.value.trim() !== "") {
        this.parentElement.classList.add('has-value');
      } else {
        this.parentElement.classList.remove('has-value');
      }
      this.parentElement.classList.remove('input-focused');
    });
  }
  
  checkAuthentication();
  
  loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();
    const remember = document.getElementById("remember").checked;
    
    if (!email || !senha) {
      showError("Por favor, preencha todos os campos.");
      return;
    }
    
    try {
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.textContent = "Processando...";
      submitBtn.disabled = true;
      
      const apiUrl = "/api/login";
      
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", senha);
      if (remember) {
        formData.append("remember", "true");
      }
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        credentials: "include",
        body: formData
      });
      
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.user) {
          const safeUserData = {
            nome: data.user.nome,
            email: data.user.email
          };
          sessionStorage.setItem("userDisplayInfo", JSON.stringify(safeUserData));
        }
        
        window.location.href = "/dashboard";
      } else {
        handleErrorResponse(response);
      }
    } catch (error) {
      console.error("Erro de conexão:", error.message);
      showError("Ocorreu um erro ao tentar fazer login. Verifique sua conexão e tente novamente.");
    }
  });
  
  async function checkAuthentication() {
    try {
      const response = await fetch('/api/verify-auth', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error.message);
    }
  }
  
  async function handleErrorResponse(response) {
    let errorMessage = "Erro de autenticação. Verifique suas credenciais.";
    
    try {
      const errorData = await response.json();
      if (errorData && errorData.detail) {
        errorMessage = `Erro: ${errorData.detail}`;
      }
    } catch (e) {
      if (response.status === 401) {
        errorMessage = "Email ou senha incorretos.";
      } else if (response.status === 403) {
        errorMessage = "Acesso não autorizado.";
      } else {
        errorMessage = `Erro ${response.status}: ${response.statusText}`;
      }
    }
    
    showError(errorMessage);
  }
  
  function showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
    
    const errorContainer = document.createElement("div");
    errorContainer.className = "error-message";
    errorContainer.textContent = message;
    
    const formBtn = document.querySelector('.container-login-form-btn');
    formBtn.insertAdjacentElement('beforebegin', errorContainer);
    
    setTimeout(() => {
      errorContainer.remove();
    }, 5000);
  }
});