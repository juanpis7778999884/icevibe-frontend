
function getSession() {
  const sessionData = localStorage.getItem("session")
  if (!sessionData) {
    console.error("[v0] No session found")
    window.location.href = "index.html"
    return null
  }
  return JSON.parse(sessionData)
}

const session = getSession()

if (!session || session.rol !== "GERENTE") {
  alert("Acceso denegado. Solo gerentes pueden acceder.")
  window.location.href = "index.html"
}

document.getElementById("userName").textContent = session.nombre

// Verificar que API está disponible
if (!window.apiRequest) {
  console.error("[v0] apiRequest no está disponible. Verifica que config.js está cargado.")
}

let ventasData = []

// Cargar datos al iniciar
document.addEventListener("DOMContentLoaded", () => {
  cargarEstadisticas()
})

async function cargarEstadisticas() {
  try {
    console.log("[v0] Cargando estadísticas del gerente...")

    const [productosRes, ventasRes] = await Promise.all([window.apiRequest("/productos"), window.apiRequest("/ventas")])

    console.log("[v0] Products response:", productosRes)
    console.log("[v0] Sales response:", ventasRes)

    const productos = Array.isArray(productosRes) ? productosRes : productosRes.data || []
    const ventas = Array.isArray(ventasRes) ? ventasRes : ventasRes.data || []

    // Guardar datos de ventas para reportes
    ventasData = ventas

    // Estadísticas de productos
    const totalProductos = productos.length
    const productosActivos = productos.filter((p) => p.activo).length
    const stockBajo = productos.filter((p) => p.stock <= (p.stockMinimo || 5)).length

    // Estadísticas de ventas
    const hoy = new Date().toISOString().split("T")[0]
    const ventasHoy = ventas.filter((v) => v.fechaVenta && v.fechaVenta.startsWith(hoy))
    const totalHoy = ventasHoy.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)

    console.log("[v0] Stats - Total productos:", totalProductos, "Activos:", productosActivos, "Stock bajo:", stockBajo)
    console.log("[v0] Stats - Ventas hoy:", ventasHoy.length, "Total:", totalHoy)

    // Actualizar HTML
    const dashboardStats = document.getElementById("dashboardStats")
    if (dashboardStats) {
      dashboardStats.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; width: 100%;">
          <div class="stat-card">
            <h3>Productos Activos</h3>
            <p class="value">${productosActivos}</p>
          </div>
          <div class="stat-card">
            <h3>Stock Bajo</h3>
            <p class="value">${stockBajo}</p>
          </div>
          <div class="stat-card">
            <h3>Ventas Hoy</h3>
            <p class="value">${ventasHoy.length}</p>
          </div>
          <div class="stat-card">
            <h3>Ingresos Hoy</h3>
            <p class="value">${formatearMoneda(totalHoy)}</p>
          </div>
        </div>
        
        <div style="margin-top: 40px;">
          <h2 style="color: #00d4ff; margin-bottom: 20px;">Reportes de Ventas</h2>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
            <button onclick="generarReportePDF('diario')" class="btn-primary">Descargar Reporte Diario</button>
            <button onclick="generarReportePDF('semanal')" class="btn-primary">Descargar Reporte Semanal</button>
            <button onclick="generarReportePDF('mensual')" class="btn-primary">Descargar Reporte Mensual</button>
          </div>
        </div>

        <div style="margin-top: 40px;">
          <h2 style="color: #00d4ff; margin-bottom: 20px;">Ventas Recientes</h2>
          <div class="data-table">
            <table style="width: 100%;">
              <thead>
                <tr>
                  <th>Número Venta</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody id="ventasRecientesBody">
                ${
                  ventasHoy.length === 0
                    ? '<tr><td colspan="4" style="text-align: center;">No hay ventas hoy</td></tr>'
                    : ventasHoy
                        .slice(0, 10)
                        .map(
                          (v) => `
                  <tr>
                    <td>${v.numeroVenta || v.id}</td>
                    <td>${new Date(v.fechaVenta).toLocaleTimeString("es-ES")}</td>
                    <td>${formatearMoneda(Number.parseFloat(v.total || 0))}</td>
                    <td><span class="badge badge-success">${v.estado || "COMPLETADA"}</span></td>
                  </tr>
                `,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      `
    }
  } catch (error) {
    console.error("[v0] Error cargando estadísticas:", error)
    const dashboardStats = document.getElementById("dashboardStats")
    if (dashboardStats) {
      dashboardStats.innerHTML = `
        <div style="color: #ff3366; padding: 20px; text-align: center;">
          <p>Error al cargar estadísticas. Verifica que el backend esté corriendo.</p>
          <small>${error.message}</small>
        </div>
      `
    }
  }
}

function generarReportePDF(tipo) {
  if (ventasData.length === 0) {
    alert("No hay datos de ventas para generar reporte")
    return
  }

  // Filtrar ventas según el tipo de reporte
  let ventasFiltradas = []
  const hoy = new Date()

  if (tipo === "diario") {
    const fechaHoy = hoy.toISOString().split("T")[0]
    ventasFiltradas = ventasData.filter((v) => v.fechaVenta && v.fechaVenta.startsWith(fechaHoy))
  } else if (tipo === "semanal") {
    const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    ventasFiltradas = ventasData.filter((v) => v.fechaVenta && v.fechaVenta >= hace7Dias)
  } else if (tipo === "mensual") {
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    ventasFiltradas = ventasData.filter((v) => v.fechaVenta && v.fechaVenta >= hace30Dias)
  }

  if (ventasFiltradas.length === 0) {
    alert("No hay ventas en el período seleccionado")
    return
  }

  // Calcular totales
  const totalVentas = ventasFiltradas.length
  const totalMonto = ventasFiltradas.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)
  const totalImpuestos = ventasFiltradas.reduce((sum, v) => sum + Number.parseFloat(v.impuestos || 0), 0)

  // Crear contenido HTML para PDF
  const contenidoHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reporte ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} - Ice Vibe</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #00d4ff; text-align: center; }
        .header { border-bottom: 2px solid #00d4ff; padding-bottom: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-box { border: 1px solid #00d4ff; padding: 15px; border-radius: 5px; background: #f9f9f9; }
        .stat-box h3 { margin: 0 0 10px 0; color: #00d4ff; }
        .stat-box p { margin: 0; font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #00d4ff; color: white; padding: 10px; text-align: left; }
        td { border-bottom: 1px solid #ddd; padding: 10px; }
        tr:hover { background: #f5f5f5; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Ice Vibe POS - Reporte ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</h1>
        <p style="text-align: center; margin: 5px 0; color: #666;">
          Generado: ${new Date().toLocaleString("es-CO")}
        </p>
      </div>

      <div class="stats">
        <div class="stat-box">
          <h3>Total de Ventas</h3>
          <p>${totalVentas}</p>
        </div>
        <div class="stat-box">
          <h3>Monto Total</h3>
          <p>${formatearMoneda(totalMonto)}</p>
        </div>
        <div class="stat-box">
          <h3>Total Impuestos</h3>
          <p>${formatearMoneda(totalImpuestos)}</p>
        </div>
      </div>

      <h2 style="color: #00d4ff; margin-top: 30px;">Detalle de Ventas</h2>
      <table>
        <thead>
          <tr>
            <th>Número Venta</th>
            <th>Fecha</th>
            <th>Vendedor</th>
            <th>Subtotal</th>
            <th>Impuestos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${ventasFiltradas
            .map(
              (v) => `
            <tr>
              <td>${v.numeroVenta || v.id}</td>
              <td>${new Date(v.fechaVenta).toLocaleString("es-CO")}</td>
              <td>${v.vendedor || "N/A"}</td>
              <td>${formatearMoneda(v.subtotal || 0)}</td>
              <td>${formatearMoneda(v.impuestos || 0)}</td>
              <td><strong>${formatearMoneda(v.total || 0)}</strong></td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <p>Este reporte fue generado automáticamente por Ice Vibe POS</p>
      </div>
    </body>
    </html>
  `

  // Crear blob y descargar
  const blob = new Blob([contenidoHTML], { type: "text/html" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Reporte_${tipo}_${new Date().toISOString().split("T")[0]}.html`
  a.click()
  window.URL.revokeObjectURL(url)
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor)
}

function logout() {
  if (confirm("¿Está seguro de cerrar sesión?")) {
    localStorage.removeItem("session")
    window.location.href = "index.html"
  }
}
