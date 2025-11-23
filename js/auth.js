// Sistema de autenticación para Ice Vibe POS
// Las variables API_CONFIG y apiRequest están disponibles globalmente desde config.js

// Función de login
async function login(codigo, password) {
  try {
    console.log("[v0] Iniciando login con código:", codigo)
    console.log("[v0] API URL:", window.API_CONFIG.API_URL)

    const response = await window.apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ codigo, password }),
    })

    console.log("[v0] Respuesta del servidor:", response)

    if (response && (response.success || response.usuario || response.role)) {
      const usuario = response.usuario || response
      const rol = usuario?.rol || usuario?.role || response.role || response.rol

      console.log("[v0] Login exitoso. Rol:", rol)

      const session = {
        id: usuario?.id || usuario?.userId,
        codigo: usuario?.codigo || usuario?.code,
        nombre: usuario?.nombre || usuario?.name,
        email: usuario?.email,
        rol: rol,
        success: true,
        loginTime: new Date().toISOString(),
      }

      console.log("[v0] Sesión guardada:", session)
      localStorage.setItem("session", JSON.stringify(session))

      return { success: true, session: session }
    } else {
      console.error("[v0] Error: respuesta inválida", response)
      return { success: false, message: response?.message || "Credenciales inválidas" }
    }
  } catch (error) {
    console.error("[v0] Error en login:", error)
    return {
      success: false,
      message: `Error al conectar con el servidor. Verifica que el backend esté corriendo en ${window.API_CONFIG.API_URL}`,
    }
  }
}

// Función de logout
function logout() {
  localStorage.removeItem("session")
  window.location.href = "index.html"
}

// Verificar autenticación
function checkAuth(requiredRole) {
  const sessionData = localStorage.getItem("session")

  if (!sessionData) {
    window.location.href = "index.html"
    return null
  }

  const session = JSON.parse(sessionData)

  if (requiredRole && session.rol.toUpperCase() !== requiredRole.toUpperCase()) {
    alert("No tienes permisos para acceder a esta página")
    window.location.href = "index.html"
    return null
  }

  return session
}

// Obtener sesión actual
function getSession() {
  const sessionData = localStorage.getItem("session")
  return sessionData ? JSON.parse(sessionData) : null
}

function mostrarModalRecuperacion() {
  const modal = document.getElementById("modalRecuperacion")
  if (modal) modal.classList.add("show")
}

function cerrarModalRecuperacion() {
  const modal = document.getElementById("modalRecuperacion")
  if (modal) modal.classList.remove("show")
  
  const codigoInput = document.getElementById("codigoRecuperacion")
  const emailInput = document.getElementById("emailRecuperacion")
  const messageDiv = document.getElementById("recoveryMessage")
  
  if (codigoInput) codigoInput.value = ""
  if (emailInput) emailInput.value = ""
  if (messageDiv) messageDiv.textContent = ""
}

async function enviarRecuperacion() {
  const codigo = document.getElementById("codigoRecuperacion").value.trim()
  const email = document.getElementById("emailRecuperacion").value.trim()
  const messageDiv = document.getElementById("recoveryMessage")
  
  if (!codigo || !email) {
    messageDiv.textContent = "Por favor completa todos los campos"
    messageDiv.classList.add("show", "error")
    return
  }
  
  try {
    console.log("[v0] Enviando solicitud de recuperación para:", codigo)
    
    const response = await window.apiRequest("/recuperar-contrasena", {
      method: "POST",
      body: JSON.stringify({ codigo, email }),
    })

    if (response && response.success) {
      messageDiv.textContent = "Instrucciones de recuperación enviadas a tu email. Revisa tu bandeja de entrada."
      messageDiv.classList.add("show", "success")
      messageDiv.classList.remove("error")
      
      setTimeout(() => {
        cerrarModalRecuperacion()
      }, 3000)
    } else {
      messageDiv.textContent = response?.message || "No se encontró el usuario con ese código y email"
      messageDiv.classList.add("show", "error")
      messageDiv.classList.remove("success")
    }
  } catch (error) {
    console.error("[v0] Error en recuperación:", error)
    messageDiv.textContent = "Error al procesar la solicitud. Intenta nuevamente."
    messageDiv.classList.add("show", "error")
    messageDiv.classList.remove("success")
  }
}

// Manejar el formulario de login si existe
if (document.getElementById("loginForm")) {
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault()

    const codigo = document.getElementById("username").value
    const password = document.getElementById("password").value
    const errorMessage = document.getElementById("errorMessage")

    // Mostrar loading
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    submitBtn.textContent = "Iniciando sesión..."
    submitBtn.disabled = true

    const result = await login(codigo, password)

    submitBtn.textContent = originalText
    submitBtn.disabled = false

    if (result.success) {
      const rol = result.session.rol

      console.log("[v0] Redirigiendo usuario con rol:", rol)

      setTimeout(() => {
        const basePath = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "")

        if (rol === "ADMIN") {
          window.location.href = basePath + "/dashboard-admin.html"
        } else if (rol === "GERENTE") {
          window.location.href = basePath + "/dashboard-gerente.html"
        } else if (rol === "VENDEDOR") {
          window.location.href = basePath + "/pos-mesero.html"
        } else if (rol === "CLIENTE") {
          window.location.href = basePath + "/dashboard-cliente.html"
        } else {
          alert("Rol desconocido. No se puede redirigir.")
        }
      }, 500)
    } else {
      errorMessage.textContent = result.message
      errorMessage.classList.add("show")

      setTimeout(() => {
        errorMessage.classList.remove("show")
      }, 5000)
    }
  })
}
