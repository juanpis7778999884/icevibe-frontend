// Get session from localStorage (set by auth.js)
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

if (!session || session.rol !== "ADMIN") {
  alert("Acceso denegado. Solo administradores pueden acceder.")
  window.location.href = "index.html"
}

// Verificar que API está disponible
if (!window.apiRequest) {
  console.error("[v0] apiRequest no está disponible. Verifica que config.js está cargado.")
}

let productos = []
let usuarios = []
let ventas = []

// Cargar datos al iniciar
document.addEventListener("DOMContentLoaded", () => {
  const nombreAdmin = document.getElementById("adminName")
  if (nombreAdmin) {
    nombreAdmin.textContent = session.nombre
  }

  cargarEstadisticas()
  cargarProductos()
  cargarUsuarios()
  cargarVentas()

  // Event listeners para búsqueda
  document.getElementById("searchProductos")?.addEventListener("input", filtrarProductos)
  document.getElementById("searchUsuarios")?.addEventListener("input", filtrarUsuarios)
  document.getElementById("searchVentas")?.addEventListener("input", filtrarVentas)

  // Event listeners para reportes
  document.getElementById("generarReporteDiario")?.addEventListener("click", generarReporteDiario)
  document.getElementById("generarReporteSemanal")?.addEventListener("click", generarReporteSemanal)
  document.getElementById("generarReporteMensual")?.addEventListener("click", generarReporteMensual)

  // Event listener para eliminar todas las ventas
  document.getElementById("eliminarTodasLasVentas")?.addEventListener("click", eliminarTodasLasVentas)
})

// ==================== ESTADÍSTICAS ====================

async function cargarEstadisticas() {
  try {
    console.log("[v0] Cargando estadísticas...")

    const [productosRes, ventasRes] = await Promise.all([window.apiRequest("/productos"), window.apiRequest("/ventas")])

    const productos = Array.isArray(productosRes) ? productosRes : productosRes.data || []
    const ventas = Array.isArray(ventasRes) ? ventasRes : ventasRes.data || []

    const hoy = new Date().toISOString().split("T")[0]
    const ventasHoy = ventas.filter((v) => v.fechaVenta && v.fechaVenta.startsWith(hoy))
    const totalHoy = ventasHoy.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)
    const stockBajo = productos.filter((p) => p.stock <= (p.stockMinimo || 5)).length

    document.getElementById("ventasHoy").textContent = ventasHoy.length
    document.getElementById("ingresosHoy").textContent = formatearMoneda(totalHoy)
    document.getElementById("totalProductos").textContent = productos.filter((p) => p.activo).length
    document.getElementById("stockBajo").textContent = stockBajo
  } catch (error) {
    console.error("[v0] Error al cargar estadísticas:", error)
  }
}

// ==================== TABS ====================

function cambiarTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))

  event.target.classList.add("active")
  document.getElementById(`tab-${tab}`)?.classList.add("active")
}

// ==================== PRODUCTOS ====================

async function cargarProductos() {
  try {
    console.log("[v0] Cargando productos...")
    const response = await window.apiRequest("/productos")
    productos = Array.isArray(response) ? response : response.data || []
    console.log("[v0] Productos cargados:", productos.length)
    mostrarProductos(productos)
  } catch (error) {
    console.error("[v0] Error al cargar productos:", error)
    document.getElementById("tablaProductos").innerHTML =
      '<tr><td colspan="7" style="text-align: center; color: #ff3366;">Error al cargar productos</td></tr>'
  }
}

function mostrarProductos(lista) {
  const tbody = document.getElementById("tablaProductos")

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay productos</td></tr>'
    return
  }

  tbody.innerHTML = lista
    .map(
      (p) => `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>${p.categoria}</td>
            <td>${formatearMoneda(p.precio)}</td>
            <td>
                <span class="badge ${p.stock <= (p.stockMinimo || 5) ? "badge-danger" : "badge-success"}">
                    ${p.stock}
                </span>
            </td>
            <td>
                <span class="badge ${p.activo ? "badge-success" : "badge-danger"}">
                    ${p.activo ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="editarProducto(${p.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="eliminarProducto(${p.id})" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `,
    )
    .join("")
}

function filtrarProductos() {
  const busqueda = document.getElementById("searchProductos").value.toLowerCase()
  const filtrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda) ||
      p.codigo.toLowerCase().includes(busqueda) ||
      p.categoria.toLowerCase().includes(busqueda),
  )
  mostrarProductos(filtrados)
}

function abrirModalProducto(id = null) {
  document.getElementById("modalProductoTitulo").textContent = id ? "Editar Producto" : "Nuevo Producto"
  document.getElementById("formProducto").reset()
  document.getElementById("productoId").value = ""
  document.getElementById("productoActivo").checked = true

  if (id) {
    const producto = productos.find((p) => p.id === id)
    if (producto) {
      document.getElementById("productoId").value = producto.id
      document.getElementById("productoCodigo").value = producto.codigo
      document.getElementById("productoNombre").value = producto.nombre
      document.getElementById("productoCategoria").value = producto.categoria
      document.getElementById("productoPrecio").value = producto.precio
      document.getElementById("productoStock").value = producto.stock
      document.getElementById("productoStockMinimo").value = producto.stockMinimo || 5
      document.getElementById("productoDescripcion").value = producto.descripcion || ""
      document.getElementById("productoActivo").checked = producto.activo
      document.getElementById("productoCodigo").readOnly = true
    }
  } else {
    document.getElementById("productoCodigo").readOnly = false
  }

  document.getElementById("modalProducto").classList.add("active")
}

function cerrarModalProducto() {
  document.getElementById("modalProducto").classList.remove("active")
}

async function guardarProducto(event) {
  event.preventDefault()

  const id = document.getElementById("productoId").value
  const data = {
    codigo: document.getElementById("productoCodigo").value,
    nombre: document.getElementById("productoNombre").value,
    categoria: document.getElementById("productoCategoria").value,
    precio: Number.parseFloat(document.getElementById("productoPrecio").value),
    stock: Number.parseInt(document.getElementById("productoStock").value),
    stockMinimo: Number.parseInt(document.getElementById("productoStockMinimo").value),
    descripcion: document.getElementById("productoDescripcion").value,
    activo: document.getElementById("productoActivo").checked,
  }

  try {
    const url = id ? `/productos/${id}` : "/productos"
    const method = id ? "PUT" : "POST"

    const response = await window.apiRequest(url, {
      method: method,
      body: JSON.stringify(data),
    })

    if (response?.success) {
      alert(response.message || "Producto guardado exitosamente")
      cerrarModalProducto()
      cargarProductos()
      cargarEstadisticas()

      console.log("[v0] Producto actualizado. Los precios en POS se sincronizarán automáticamente.")
    } else {
      alert("Error: " + (response?.message || "Error desconocido"))
    }
  } catch (error) {
    console.error("[v0] Error al guardar producto:", error)
    alert("Error al guardar producto: " + error.message)
  }
}

function editarProducto(id) {
  abrirModalProducto(id)
}

async function eliminarProducto(id) {
  if (!confirm("¿Está seguro de eliminar este producto?")) return

  try {
    const response = await window.apiRequest(`/productos/${id}/fuerza`, {
      method: "DELETE",
    })

    if (response?.success) {
      alert(response.message || "Producto eliminado")
      await cargarProductos()
      await cargarEstadisticas()
    } else {
      alert("Error: " + (response?.message || "Error desconocido"))
    }
  } catch (error) {
    console.error("[v0] Error al eliminar producto:", error)
    alert("Error al eliminar producto")
  }
}

// ==================== USUARIOS ====================

async function cargarUsuarios() {
  try {
    console.log("[v0] Cargando usuarios...")
    const response = await window.apiRequest("/usuarios")
    usuarios = Array.isArray(response) ? response : response.data || []
    console.log("[v0] Usuarios cargados:", usuarios.length)
    mostrarUsuarios(usuarios)
  } catch (error) {
    console.error("[v0] Error al cargar usuarios:", error)
    document.getElementById("tablaUsuarios").innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: #ff3366;">Error al cargar usuarios</td></tr>'
  }
}

function mostrarUsuarios(lista) {
  const tbody = document.getElementById("tablaUsuarios")

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay usuarios</td></tr>'
    return
  }

  tbody.innerHTML = lista
    .map(
      (u) => `
        <tr>
            <td>${u.codigo}</td>
            <td>${u.nombre}</td>
            <td>${u.email}</td>
            <td><span class="badge badge-success">${u.rol}</span></td>
            <td>
                <span class="badge ${u.activo ? "badge-success" : "badge-danger"}">
                    ${u.activo ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="editarUsuario(${u.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="cambiarContrasena(${u.id})" title="Cambiar Contraseña">🔐</button>
                <button class="btn-icon" onclick="eliminarUsuario(${u.id})" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `,
    )
    .join("")
}

function filtrarUsuarios() {
  const busqueda = document.getElementById("searchUsuarios").value.toLowerCase()
  const filtrados = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(busqueda) ||
      u.codigo.toLowerCase().includes(busqueda) ||
      u.email.toLowerCase().includes(busqueda),
  )
  mostrarUsuarios(filtrados)
}

function abrirModalUsuario(id = null) {
  document.getElementById("modalUsuarioTitulo").textContent = id ? "Editar Usuario" : "Nuevo Usuario"
  document.getElementById("formUsuario").reset()
  document.getElementById("usuarioId").value = ""
  document.getElementById("usuarioActivo").checked = true

  if (id) {
    const usuario = usuarios.find((u) => u.id === id)
    if (usuario) {
      document.getElementById("usuarioId").value = usuario.id
      document.getElementById("usuarioCodigo").value = usuario.codigo
      document.getElementById("usuarioNombre").value = usuario.nombre
      document.getElementById("usuarioEmail").value = usuario.email
      document.getElementById("usuarioRol").value = usuario.rol
      document.getElementById("usuarioActivo").checked = usuario.activo
      document.getElementById("usuarioCodigo").readOnly = true
      document.getElementById("passwordGroup").style.display = "none"
    }
  } else {
    document.getElementById("usuarioCodigo").readOnly = false
    document.getElementById("passwordGroup").style.display = "block"
  }

  document.getElementById("modalUsuario").classList.add("active")
}

function cerrarModalUsuario() {
  document.getElementById("modalUsuario").classList.remove("active")
}

async function guardarUsuario(event) {
  event.preventDefault()

  const id = document.getElementById("usuarioId").value
  const data = {
    codigo: document.getElementById("usuarioCodigo").value,
    nombre: document.getElementById("usuarioNombre").value,
    email: document.getElementById("usuarioEmail").value,
    rol: document.getElementById("usuarioRol").value,
    activo: document.getElementById("usuarioActivo").checked,
  }

  if (!id) {
    data.password = document.getElementById("usuarioPassword").value
  }

  try {
    const url = id ? `/usuarios/${id}` : "/usuarios"
    const method = id ? "PUT" : "POST"

    const response = await window.apiRequest(url, {
      method: method,
      body: JSON.stringify(data),
    })

    if (response?.success) {
      alert(response.message || "Usuario guardado exitosamente")
      cerrarModalUsuario()
      cargarUsuarios()
      cargarEstadisticas()
    } else {
      alert("Error: " + (response?.message || "Error desconocido"))
    }
  } catch (error) {
    console.error("[v0] Error al guardar usuario:", error)
    alert("Error al guardar usuario: " + error.message)
  }
}

function editarUsuario(id) {
  abrirModalUsuario(id)
}

function cambiarContrasena(id) {
  const usuario = usuarios.find((u) => u.id === id)
  if (usuario) {
    document.getElementById("usuarioIdCambio").value = id
    document.getElementById("nuevaContrasena").value = ""
    document.getElementById("confirmarContrasena").value = ""
    document.getElementById("modalCambiarContrasena").classList.add("active")
  }
}

function cerrarModalCambiarContrasena() {
  document.getElementById("modalCambiarContrasena").classList.remove("active")
}

async function guardarCambioContrasena(event) {
  event.preventDefault()

  const nuevaContrasena = document.getElementById("nuevaContrasena").value
  const confirmarContrasena = document.getElementById("confirmarContrasena").value
  const usuarioId = document.getElementById("usuarioIdCambio").value

  // Validar que las contraseñas coincidan
  if (nuevaContrasena !== confirmarContrasena) {
    alert("Las contraseñas no coinciden")
    return
  }

  // Validar longitud mínima
  if (nuevaContrasena.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres")
    return
  }

  try {
    const response = await window.apiRequest(`/usuarios/${usuarioId}/cambiar-contrasena`, {
      method: "PUT",
      body: JSON.stringify({
        password: nuevaContrasena,
      }),
    })

    if (response?.success) {
      alert(response.message || "Contraseña actualizada exitosamente")
      cerrarModalCambiarContrasena()
      cargarUsuarios()
    } else {
      alert("Error: " + (response?.message || "Error desconocido"))
    }
  } catch (error) {
    console.error("[v0] Error al cambiar contraseña:", error)
    alert("Error al cambiar contraseña: " + error.message)
  }
}

async function eliminarUsuario(id) {
  if (!confirm("¿Está seguro de eliminar este usuario?")) return

  try {
    const response = await window.apiRequest(`/usuarios/${id}/fuerza`, {
      method: "DELETE",
    })

    if (response?.success) {
      alert(response.message || "Usuario eliminado")
      await cargarUsuarios()
      await cargarEstadisticas()
    } else {
      alert("Error: " + (response?.message || "Error desconocido"))
    }
  } catch (error) {
    console.error("[v0] Error al eliminar usuario:", error)
    alert("Error al eliminar usuario")
  }
}

// ==================== VENTAS ====================

async function cargarVentas() {
  try {
    console.log("[v0] Cargando ventas...")
    const response = await window.apiRequest("/ventas")
    ventas = Array.isArray(response) ? response : response.data || []
    console.log("[v0] Ventas cargadas:", ventas.length)
    mostrarVentas(ventas)
  } catch (error) {
    console.error("[v0] Error al cargar ventas:", error)
    document.getElementById("tablaVentas").innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: #ff3366;">Error al cargar ventas</td></tr>'
  }
}

function mostrarVentas(lista) {
  const tbody = document.getElementById("tablaVentas")

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay ventas</td></tr>'
    return
  }

  tbody.innerHTML = lista
    .map(
      (v) => `
        <tr>
            <td>${v.numeroVenta || v.id}</td>
            <td>${new Date(v.fechaVenta).toLocaleString("es-CO")}</td>
            <td>${v.vendedor || "N/A"}</td>
            <td>${formatearMoneda(v.total)}</td>
            <td><span class="badge badge-success">${v.estado || "COMPLETADA"}</span></td>
            <td>
                <button class="btn-icon" onclick="verDetalleVenta(${v.id})" title="Ver detalle">👁️</button>
            </td>
        </tr>
    `,
    )
    .join("")
}

function filtrarVentas() {
  const busqueda = document.getElementById("searchVentas").value.toLowerCase()
  const filtrados = ventas.filter(
    (v) =>
      v.numeroVenta.toLowerCase().includes(busqueda) || (v.vendedor && v.vendedor.toLowerCase().includes(busqueda)),
  )
  mostrarVentas(filtrados)
}

async function verDetalleVenta(id) {
  try {
    const response = await window.apiRequest(`/ventas/${id}`)

    if (response?.success) {
      const venta = response.venta
      const detalles = response.detalles || []

      let mensaje = `VENTA: ${venta.numeroVenta}\n`
      mensaje += `Fecha: ${new Date(venta.fechaVenta).toLocaleString("es-CO")}\n`
      mensaje += `Total: ${formatearMoneda(venta.total)}\n\n`
      mensaje += `PRODUCTOS:\n`
      detalles.forEach((d) => {
        mensaje += `- ${d.productoNombre} x${d.cantidad} = ${formatearMoneda(d.subtotal)}\n`
      })

      alert(mensaje)
    }
  } catch (error) {
    console.error("[v0] Error al ver detalle:", error)
    alert("Error al cargar detalle de venta")
  }
}

// ==================== REPORTES ====================

async function generarReporteDiario() {
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    const hoy = new Date().toLocaleDateString("es-CO")

    doc.setFontSize(16)
    doc.text("Reporte de Ventas - Diario", 20, 20)
    doc.setFontSize(10)
    doc.text(`Fecha: ${hoy}`, 20, 30)

    const ventasHoy = ventas.filter((v) => v.fechaVenta && v.fechaVenta.startsWith(hoy.split("/").reverse().join("-")))
    const totalHoy = ventasHoy.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)

    let y = 45
    doc.text("Resumen:", 20, y)
    y += 10
    doc.text(`Total de ventas: ${ventasHoy.length}`, 20, y)
    y += 5
    doc.text(`Total ingresos: ${formatearMoneda(totalHoy)}`, 20, y)

    if (ventasHoy.length > 0) {
      y += 15
      doc.text("Detalle de ventas:", 20, y)
      y += 10

      ventasHoy.forEach((venta, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.text(`${idx + 1}. ${venta.numeroVenta || venta.id} - ${formatearMoneda(venta.total)}`, 20, y)
        y += 5
      })
    }

    doc.save(`reporte_diario_${new Date().toISOString().split("T")[0]}.pdf`)
    alert("Reporte diario descargado")
  } catch (error) {
    console.error("Error al generar reporte:", error)
    alert("Error al generar reporte: " + error.message)
  }
}

async function generarReporteSemanal() {
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    const hoy = new Date()
    const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)

    doc.setFontSize(16)
    doc.text("Reporte de Ventas - Semanal", 20, 20)
    doc.setFontSize(10)
    doc.text(`Período: ${hace7Dias.toLocaleDateString("es-CO")} - ${hoy.toLocaleDateString("es-CO")}`, 20, 30)

    const ventasSemana = ventas.filter((v) => {
      const fechaVenta = new Date(v.fechaVenta)
      return fechaVenta >= hace7Dias && fechaVenta <= hoy
    })
    const totalSemana = ventasSemana.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)

    let y = 45
    doc.text("Resumen:", 20, y)
    y += 10
    doc.text(`Total de ventas: ${ventasSemana.length}`, 20, y)
    y += 5
    doc.text(`Total ingresos: ${formatearMoneda(totalSemana)}`, 20, y)
    doc.text(`Promedio por venta: ${formatearMoneda(totalSemana / ventasSemana.length || 0)}`, 20, y + 5)

    if (ventasSemana.length > 0) {
      y += 20
      doc.text("Detalle de ventas:", 20, y)
      y += 10

      ventasSemana.forEach((venta, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.text(
          `${idx + 1}. ${venta.numeroVenta || venta.id} - ${new Date(venta.fechaVenta).toLocaleDateString("es-CO")} - ${formatearMoneda(venta.total)}`,
          20,
          y,
        )
        y += 5
      })
    }

    doc.save(`reporte_semanal_${new Date().toISOString().split("T")[0]}.pdf`)
    alert("Reporte semanal descargado")
  } catch (error) {
    console.error("Error al generar reporte:", error)
    alert("Error al generar reporte: " + error.message)
  }
}

async function generarReporteMensual() {
  try {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    const hoy = new Date()
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)

    doc.setFontSize(16)
    doc.text("Reporte de Ventas - Mensual", 20, 20)
    doc.setFontSize(10)
    doc.text(`Período: ${hace30Dias.toLocaleDateString("es-CO")} - ${hoy.toLocaleDateString("es-CO")}`, 20, 30)

    const ventasMes = ventas.filter((v) => {
      const fechaVenta = new Date(v.fechaVenta)
      return fechaVenta >= hace30Dias && fechaVenta <= hoy
    })
    const totalMes = ventasMes.reduce((sum, v) => sum + Number.parseFloat(v.total || 0), 0)

    let y = 45
    doc.text("Resumen:", 20, y)
    y += 10
    doc.text(`Total de ventas: ${ventasMes.length}`, 20, y)
    y += 5
    doc.text(`Total ingresos: ${formatearMoneda(totalMes)}`, 20, y)
    doc.text(`Promedio por venta: ${formatearMoneda(totalMes / ventasMes.length || 0)}`, 20, y + 5)

    if (ventasMes.length > 0) {
      y += 20
      doc.text("Detalle de ventas:", 20, y)
      y += 10

      ventasMes.forEach((venta, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.text(
          `${idx + 1}. ${venta.numeroVenta || venta.id} - ${new Date(venta.fechaVenta).toLocaleDateString("es-CO")} - ${formatearMoneda(venta.total)}`,
          20,
          y,
        )
        y += 5
      })
    }

    doc.save(`reporte_mensual_${new Date().toISOString().split("T")[0]}.pdf`)
    alert("Reporte mensual descargado")
  } catch (error) {
    console.error("Error al generar reporte:", error)
    alert("Error al generar reporte: " + error.message)
  }
}

// ==================== UTILIDADES ====================

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor)
}

async function eliminarTodasLasVentas() {
  // Triple confirmación para seguridad
  const confirmacion1 = confirm("⚠️ ADVERTENCIA: Esto eliminará TODAS las ventas de prueba.\n\n¿Está seguro?")
  if (!confirmacion1) return

  const confirmacion2 = confirm("⚠️ Esta acción NO se puede deshacer.\n\n¿Está REALMENTE seguro?")
  if (!confirmacion2) return

  const inputUser = prompt("⚠️ Escriba 'LIMPIAR' para confirmar:")
  if (inputUser !== "LIMPIAR") {
    alert("Operación cancelada")
    return
  }

  try {
    console.log("[v0] Eliminando todas las ventas...")

    // Eliminar cada venta
    const ventasAEliminar = [...ventas]
    for (const venta of ventasAEliminar) {
      await window.apiRequest(`/ventas/${venta.id}`, {
        method: "DELETE",
      })
    }

    alert("✅ Base de datos limpiada. Todas las ventas han sido eliminadas.")

    // Recargar datos
    await cargarVentas()
    await cargarEstadisticas()
  } catch (error) {
    console.error("[v0] Error al limpiar BD:", error)
    alert("Error al limpiar la base de datos: " + error.message)
  }
}

function cerrarSesion() {
  if (confirm("¿Está seguro de cerrar sesión?")) {
    localStorage.removeItem("session")
    window.location.href = "index.html"
  }
}
