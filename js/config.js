// Configuración de la API para Ice Vibe POS
// Este archivo debe cargarse ANTES que auth.js y otros archivos JS

window.API_CONFIG = {
  API_URL: "https://icevibe-backend-1.onrender.com/api",
  TIMEOUT: 30000,
  WHATSAPP_NUMBER: "573154967711",
};

// Función para hacer peticiones a la API
window.apiRequest = async (endpoint, options = {}) => {
 const url = `${window.API_CONFIG.API_URL}${endpoint}`;


  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), window.API_CONFIG.TIMEOUT);

    const response = await fetch(url, {
      ...defaultOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Intentar parsear como JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    // Si no es JSON, devolver el texto
    const text = await response.text();
    return { success: response.ok, data: text };
  } catch (error) {
    console.error("Error en apiRequest:", error);

    if (error.name === "AbortError") {
      return { success: false, message: "La petición tardó demasiado tiempo" };
    }

    return { success: false, message: "Error de conexión con el servidor" };
  }
};

console.log("✅ API configurada en:", window.API_CONFIG.API_URL);

