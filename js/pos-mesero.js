// Get the actual session from localStorage (set by auth.js)
function getSession() {
  const sessionData = localStorage.getItem("session")
  if (!sessionData) {
    console.error("[v0] No session found. Redirecting to login.")
    window.location.href = "index.html"
    return null
  }
  return JSON.parse(sessionData)
}

const session = getSession()

if (!session || (session.rol !== "VENDEDOR" && session.rol !== "ADMIN")) {
  window.location.href = "index.html"
}

if (!window.API_CONFIG) {
  console.error("[v0] API_CONFIG no definido. Verifica que config.js esté cargado")
  alert("Error de configuración. Por favor recarga la página.")
  window.location.href = "index.html"
}

document.getElementById("userName").textContent = session.nombre

let productos = []
let carrito = []
let productoSeleccionado = null
let categoriaActual = "TODAS"
let refreshInterval = null
let mesaNumero = null
let historialVentas = []
let ventaDetalleActual = null
let productoEditandoIndex = null
let detallesVentaEditando = null

document.addEventListener("DOMContentLoaded", () => {
  pedirNumeroDeMesa()
  cargarProductos()

  refreshInterval = setInterval(() => {
    console.log("[v0] Auto-refreshing products for price updates...")
    cargarProductos()
  }, 30000)

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log("[v0] Tab is visible, refreshing products...")
      cargarProductos()
    }
  })
})

function pedirNumeroDeMesa() {
  const mesa = prompt("¿Cuál es el número de mesa?", "1")
  if (mesa === null || mesa.trim() === "") {
    pedirNumeroDeMesa()
    return
  }
  mesaNumero = mesa.trim()
  document.getElementById("mesaDisplay").textContent = mesaNumero
  console.log("[v0] Mesa asignada:", mesaNumero)
}

function cambiarMesa() {
  const nuevaMesa = prompt("Ingresa el nuevo número de mesa:", mesaNumero)
  if (nuevaMesa !== null && nuevaMesa.trim() !== "") {
    mesaNumero = nuevaMesa.trim()
    document.getElementById("mesaDisplay").textContent = mesaNumero
    console.log("[v0] Mesa cambiada a:", mesaNumero)
  }
}

async function cargarProductos() {
  try {
    console.log("[v0] Loading products from API...")
    const response = await window.apiRequest("/productos/activos")

    console.log("[v0] Products response:", response)

    if (response && response.success === false) {
      throw new Error(response.message || "Error al cargar productos")
    }

    productos = Array.isArray(response) ? response : response.data || []
    console.log("[v0] Products loaded:", productos.length)
    mostrarProductos()
  } catch (error) {
    console.error("[v0] Error al cargar productos:", error)
    const grid = document.getElementById("productGrid")
    if (grid) {
      grid.innerHTML =
        '<p style="color: #ff3366; text-align: center; grid-column: 1/-1; padding: 40px;">Error al cargar productos. Verifica que el backend esté corriendo.</p>'
    }
  }
}

function mostrarProductos() {
  const grid = document.getElementById("productGrid")
  if (!grid) return

  let productosFiltrados = productos

  if (categoriaActual !== "TODAS") {
    productosFiltrados = productos.filter((p) => {
      const categoria = (p.categoria || "").toUpperCase()
      return categoria === categoriaActual.toUpperCase()
    })
  }

  if (productosFiltrados.length === 0) {
    grid.innerHTML =
      '<p style="color: var(--text-gray); text-align: center; grid-column: 1/-1;">No hay productos en esta categoría</p>'
    return
  }

  grid.innerHTML = productosFiltrados
    .map(
      (p) => `
        <div class="product-card" onclick="abrirModalAgregar(${p.id})">
            <div class="product-icon">
              ${p.nombre.includes("Cerveza") ? "🍺" : p.nombre.includes("Shot") ? "🥃" : p.nombre.includes("Granizado") ? "🧊" : "🥤"}
            </div>
            <h3 class="product-name">${p.nombre}</h3>
            ${p.descripcion ? `<p class="product-description">${p.descripcion}</p>` : ""}
            <p class="product-price">${formatearMoneda(p.precio)}</p>
            <p style="color: #00ff88; font-size: 0.9em; margin-top: 8px;">Stock: ${p.stock || 0}</p>
        </div>
    `,
    )
    .join("")
}

function filtrarCategoria(element, categoria) {
  categoriaActual = categoria

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active")
  })
  element.classList.add("active")

  mostrarProductos()
}

// ==================== MODAL AGREGAR PRODUCTO ====================

function abrirModalAgregar(productoId) {
  productoSeleccionado = productos.find((p) => p.id === productoId)
  if (!productoSeleccionado) return

  const modal = document.getElementById("modalAgregar")
  if (!modal) return

  const titulo = modal.querySelector("h2")
  const cantidadDisplay = modal.querySelector("#cantidadDisplay")
  const notasInput = modal.querySelector("#notasProducto")

  const specs = modal.querySelectorAll(".spec-checkbox")
  specs.forEach((spec) => (spec.checked = false))

  if (titulo) titulo.textContent = `Agregar ${productoSeleccionado.nombre}`
  if (cantidadDisplay) cantidadDisplay.textContent = "1"
  if (notasInput) notasInput.value = ""

  modal.classList.add("show")
}

function cerrarModal() {
  const modal = document.getElementById("modalAgregar")
  if (modal) modal.classList.remove("show")
  productoSeleccionado = null
}

function cambiarCantidadModal(delta) {
  const modal = document.getElementById("modalAgregar")
  if (!modal) return

  const cantidadDisplay = modal.querySelector("#cantidadDisplay")
  if (!cantidadDisplay) return

  let cantidad = Number.parseInt(cantidadDisplay.textContent) || 1
  cantidad = Math.max(1, Math.min(productoSeleccionado.stock || 999, cantidad + delta))
  cantidadDisplay.textContent = cantidad
}

function confirmarAgregar() {
  const modal = document.getElementById("modalAgregar")
  if (!modal || !productoSeleccionado) return

  const cantidadDisplay = modal.querySelector("#cantidadDisplay")
  const notasInput = modal.querySelector("#notasProducto")

  const specsChecked = modal.querySelectorAll(".spec-checkbox:checked")
  const especificaciones = Array.from(specsChecked)
    .map((spec) => spec.value)
    .join(", ")

  const cantidad = Number.parseInt(cantidadDisplay?.textContent || 1)
  const notas = notasInput?.value.trim() || ""

  const notasCompletas = [especificaciones, notas].filter(Boolean).join(" | ")

  const itemExistente = carrito.find(
    (item) => item.producto.id === productoSeleccionado.id && item.notas === notasCompletas,
  )

  if (itemExistente) {
    itemExistente.cantidad += cantidad
  } else {
    carrito.push({
      producto: productoSeleccionado,
      cantidad: cantidad,
      notas: notasCompletas,
    })
  }

  actualizarCarrito()
  cerrarModal()
}

// ==================== CARRITO ====================

function actualizarCarrito() {
  const orderItems = document.getElementById("orderItems")
  const btnCompleteOrder = document.getElementById("btnCompleteOrder")

  if (!orderItems) return

  if (carrito.length === 0) {
    orderItems.innerHTML = '<p class="empty-order">No hay productos en la orden</p>'
    if (btnCompleteOrder) btnCompleteOrder.disabled = true
  } else {
    orderItems.innerHTML = carrito
      .map(
        (item, index) => `
            <div class="order-item">
                <div class="order-item-info">
                    <div class="order-item-name">${item.producto.nombre}</div>
                    <div class="order-item-price">${formatearMoneda(item.producto.precio * item.cantidad)}</div>
                    ${item.notas ? `<p class="order-item-notes">📝 ${item.notas}</p>` : ""}
                </div>
                <div class="order-item-qty">
                    <button class="qty-btn" onclick="cambiarCantidad(${index}, -1)">−</button>
                    <span class="qty-number">${item.cantidad}</span>
                    <button class="qty-btn" onclick="cambiarCantidad(${index}, 1)">+</button>
                </div>
            </div>
        `,
      )
      .join("")
    if (btnCompleteOrder) btnCompleteOrder.disabled = false
  }

  calcularTotal()
}

function cambiarCantidad(index, delta) {
  const item = carrito[index]
  item.cantidad = Math.max(1, Math.min(item.producto.stock || 999, item.cantidad + delta))
  actualizarCarrito()
}

function eliminarItem(index) {
  carrito.splice(index, 1)
  actualizarCarrito()
}

function calcularTotal() {
  const subtotal = carrito.reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0)
  const impuestos = subtotal * 0.15
  const total = subtotal + impuestos

  const subtotalEl = document.getElementById("subtotalAmount")
  const impuestosEl = document.getElementById("taxAmount")
  const totalEl = document.getElementById("totalAmount")

  if (subtotalEl) subtotalEl.textContent = formatearMoneda(subtotal)
  if (impuestosEl) impuestosEl.textContent = formatearMoneda(impuestos)
  if (totalEl) totalEl.textContent = formatearMoneda(total)

  console.log("[v0] Total calculado - Subtotal:", subtotal, "Impuestos:", impuestos, "Total:", total)
}

// ==================== FINALIZAR PEDIDO ====================

function completeOrder() {
  if (carrito.length === 0) {
    alert("El carrito está vacío")
    return
  }

  confirmarPedidoAuto()
}

function cerrarModalFinalizar() {
  const modal = document.getElementById("modalFinalizar")
  if (modal) modal.classList.remove("show")
}

async function confirmarPedidoAuto() {
  try {
    const subtotal = carrito.reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0)
    const impuestos = subtotal * 0.15
    const total = subtotal + impuestos

    if (!mesaNumero || mesaNumero === "undefined") {
      alert("Por favor asigna un número de mesa")
      return
    }

    const ventaData = {
      usuarioId: session.id,
      subtotal: subtotal,
      impuestos: impuestos,
      descuento: 0,
      total: total,
      numeroMesa: Number.parseInt(mesaNumero, 10), // Convert string to integer
      numeroWhatsapp: window.API_CONFIG.WHATSAPP_NUMBER,
      nombreCliente: "Cliente",
      observaciones: `Mesa: ${mesaNumero}`,
      detalles: carrito.map((item) => ({
        productoId: item.producto.id,
        cantidad: item.cantidad,
        precioUnitario: item.producto.precio,
        subtotal: item.producto.precio * item.cantidad,
        notas: item.notas || "",
      })),
    }

    console.log("[v0] Sending sale data:", ventaData)

    const ventaResponse = await window.apiRequest("/ventas", {
      method: "POST",
      body: JSON.stringify(ventaData),
    })

    console.log("[v0] Sale response:", ventaResponse)

    if (!ventaResponse || !ventaResponse.success) {
      throw new Error(ventaResponse?.message || "Error al registrar la venta")
    }

    let mensaje = "🧊 *PEDIDO ICE VIBE* 🧊\n\n"
    mensaje += `📋 Pedido: ${ventaResponse.id || "Nuevo"}\n`
    mensaje += `🪑 Mesa: ${mesaNumero}\n`
    mensaje += `👨‍💼 Atendido por: ${session.nombre}\n\n`
    mensaje += "*PRODUCTOS:*\n"

    carrito.forEach((item) => {
      mensaje += `\n• ${item.producto.nombre}\n`
      mensaje += `  Cantidad: ${item.cantidad}\n`
      mensaje += `  Precio: ${formatearMoneda(item.producto.precio)}\n`
      if (item.notas) {
        mensaje += `  📝 Especificaciones: ${item.notas}\n`
      }
      mensaje += `  Subtotal: ${formatearMoneda(item.producto.precio * item.cantidad)}\n`
    })

    mensaje += `\n━━━━━━━━━━━━━━━━\n`
    mensaje += `💰 *TOTAL: ${formatearMoneda(total)}*\n\n`
    mensaje += "¡Gracias por tu pedido! 🎉"

    const telefonoConfig = window.API_CONFIG.WHATSAPP_NUMBER
    const telefonoLimpio = telefonoConfig.replace(/\D/g, "")

    if (!telefonoLimpio || telefonoLimpio.length < 10) {
      throw new Error("El número de WhatsApp en config no es válido")
    }

    const urlWhatsapp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`
    console.log("[v0] WhatsApp URL:", urlWhatsapp)
    window.open(urlWhatsapp, "_blank")

    carrito = []
    actualizarCarrito()

    alert("✅ Pedido registrado y enviado a WhatsApp!")

    cargarProductos()
  } catch (error) {
    console.error("[v0] Error al confirmar pedido:", error)
    alert("Error al procesar el pedido: " + error.message)
  }
}

async function confirmarPedido() {
  const modal = document.getElementById("modalFinalizar")
  if (!modal) return

  const whatsappInput = modal.querySelector("#whatsappNumber")
  const clientNameInput = modal.querySelector("#clientName")
  const whatsapp = whatsappInput?.value.trim() || ""
  const nombreCliente = clientNameInput?.value.trim() || ""

  if (!whatsapp) {
    alert("Por favor ingresa un número de WhatsApp")
    return
  }

  try {
    const subtotal = carrito.reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0)
    const impuestos = subtotal * 0.15
    const total = subtotal + impuestos

    const ventaData = {
      usuarioId: session.id,
      subtotal: subtotal,
      impuestos: impuestos,
      descuento: 0,
      total: total,
      observaciones: nombreCliente ? `Cliente: ${nombreCliente}` : "Venta desde POS",
      detalles: carrito.map((item) => ({
        productoId: item.producto.id,
        cantidad: item.cantidad,
        precioUnitario: item.producto.precio,
        subtotal: item.producto.precio * item.cantidad,
        notas: item.notas || "",
      })),
    }

    console.log("[v0] Sending sale data:", ventaData)

    const ventaResponse = await window.apiRequest("/ventas", {
      method: "POST",
      body: JSON.stringify(ventaData),
    })

    console.log("[v0] Sale response:", ventaResponse)

    if (!ventaResponse || !ventaResponse.success) {
      throw new Error(ventaResponse?.message || "Error al registrar la venta")
    }

    let mensaje = "🧊 *PEDIDO ICE VIBE* 🧊\n\n"
    mensaje += `📋 Pedido: ${ventaResponse.id || "Nuevo"}\n`
    if (nombreCliente) {
      mensaje += `👤 Cliente: ${nombreCliente}\n`
    }
    mensaje += `👨‍💼 Atendido por: ${session.nombre}\n\n`
    mensaje += "*PRODUCTOS:*\n"

    carrito.forEach((item) => {
      mensaje += `\n• ${item.producto.nombre}\n`
      mensaje += `  Cantidad: ${item.cantidad}\n`
      mensaje += `  Precio: ${formatearMoneda(item.producto.precio)}\n`
      if (item.notas) {
        mensaje += `  📝 Especificaciones: ${item.notas}\n`
      }
      mensaje += `  Subtotal: ${formatearMoneda(item.producto.precio * item.cantidad)}\n`
    })

    mensaje += `\n━━━━━━━━━━━━━━━━\n`
    mensaje += `💰 *TOTAL: ${formatearMoneda(total)}*\n\n`
    mensaje += "¡Gracias por tu pedido! 🎉"

    const telefonoLimpio = whatsapp.replace(/\D/g, "")
    if (!telefonoLimpio || telefonoLimpio.length < 10) {
      throw new Error("El número de WhatsApp no es válido")
    }

    const urlWhatsapp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`
    console.log("[v0] WhatsApp URL:", urlWhatsapp)
    window.open(urlWhatsapp, "_blank")

    carrito = []
    actualizarCarrito()
    cerrarModalFinalizar()

    alert("✅ Pedido registrado exitosamente!")

    cargarProductos()
  } catch (error) {
    console.error("[v0] Error al confirmar pedido:", error)
    alert("Error al procesar el pedido: " + error.message)
  }
}

// ==================== HISTORIAL ====================

function irAlHistorial() {
  cargarHistorial()
  const modal = document.getElementById("modalHistorialMesas")
  if (modal) modal.classList.add("show")
}

function cerrarModalHistorialMesas() {
  const modal = document.getElementById("modalHistorialMesas")
  if (modal) modal.classList.remove("show")
}

async function cargarHistorial() {
  try {
    console.log("[v0] Loading active tables...")

    const response = await window.apiRequest("/ventas")

    console.log("[v0] All sales response:", response)

    historialVentas = Array.isArray(response) ? response : response.data || []
    console.log("[v0] Total sales loaded:", historialVentas.length)

    mostrarHistorialMesas()
  } catch (error) {
    console.error("[v0] Error al cargar historial:", error)
    const container = document.getElementById("mesasContainer")
    if (container) {
      container.innerHTML =
        '<p style="color: #ff3366; text-align: center; padding: 40px;">Error al cargar mesas activas</p>'
    }
  }
}

function mostrarHistorialMesas() {
  const container = document.getElementById("mesasContainer")
  if (!container) return

  const mesasMap = {}

  historialVentas.forEach((venta) => {
    const numeroMesa = venta.numeroMesa || venta.numero_mesa || "N/A"

    if (!mesasMap[numeroMesa]) {
      mesasMap[numeroMesa] = venta
    } else {
      const fechaNueva = new Date(venta.fechaVenta)
      const fechaAnterior = new Date(mesasMap[numeroMesa].fechaVenta)
      if (fechaNueva > fechaAnterior) {
        mesasMap[numeroMesa] = venta
      }
    }
  })

  const mesas = Object.entries(mesasMap)
    .map(([numeroMesa, venta]) => ({ numeroMesa, venta }))
    .sort((a, b) => new Date(b.venta.fechaVenta) - new Date(a.venta.fechaVenta))

  if (mesas.length === 0) {
    container.innerHTML =
      '<p style="color: var(--text-gray); text-align: center; padding: 40px;">No hay mesas activas</p>'
    return
  }

  container.innerHTML = mesas
    .map(({ numeroMesa, venta }) => {
      const fecha = new Date(venta.fechaVenta)
      const horaFormato = fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })

      const tiempoTranscurrido = Math.floor((Date.now() - fecha.getTime()) / 1000 / 60)
      const tiempoTexto = tiempoTranscurrido < 1 ? "Hace poco" : `Hace ${tiempoTranscurrido}m`

      return `
        <div class="historial-item">
          <div class="historial-header">
            <div>
              <strong style="font-size: 1.3em; color: #00ffff;">🪑 MESA ${numeroMesa}</strong>
              <span class="historial-date">${tiempoTexto}</span>
            </div>
            <span class="historial-total">${formatearMoneda(venta.total)}</span>
          </div>
          <div class="historial-details">
            <p><strong>Atendido por:</strong> ${venta.vendedor || session.nombre || "N/A"}</p>
            <p><strong>Hora:</strong> ${horaFormato}</p>
            <p><strong>Estado:</strong> <span class="badge badge-success">ACTIVA</span></p>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn-view-details" onclick="verDetallesVentaMesa(${venta.id})" style="flex: 1;">Ver Detalles</button>
            <button class="btn-view-details" style="background-color: #ff3366; flex: 1;" onclick="marcarMesaComoPaga('${numeroMesa}', ${venta.id})">Mesa Pagó</button>
          </div>
        </div>
      `
    })
    .join("")
}

async function verDetallesVentaMesa(ventaId) {
  try {
    const response = await window.apiRequest(`/ventas/${ventaId}`)

    if (!response || !response.success) {
      throw new Error("No se pudieron cargar los detalles del pedido")
    }

    const venta = response.venta
    const detalles = response.detalles || []

    ventaDetalleActual = venta
    detallesVentaEditando = JSON.parse(JSON.stringify(detalles))

    const numeroMesa = venta.numeroMesa || venta.numero_mesa || "N/A"

    // Llenar la información del modal
    document.getElementById("mesaDetalleNumero").textContent = numeroMesa
    document.getElementById("detalleAtendidoPor").textContent = venta.vendedor || "N/A"

    const fecha = new Date(venta.fechaVenta)
    const horaFormato = fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    document.getElementById("detalleHora").textContent = horaFormato

    document.getElementById("detalleTelefono").textContent = venta.numeroWhatsapp || "-"

    const tiempoTranscurrido = Math.floor((Date.now() - fecha.getTime()) / 1000 / 60)
    const tiempoTexto = tiempoTranscurrido < 1 ? "Hace poco" : `Hace ${tiempoTranscurrido}m`
    document.getElementById("detalleTiempoActiva").textContent = tiempoTexto

    // Mostrar productos
    mostrarProductosDelPedido({ detalles: detalles })

    // Actualizar totales
    const subtotal = venta.subtotal || 0
    const impuestos = venta.impuestos || 0
    const total = venta.total || 0

    document.getElementById("detalleSubtotal").textContent = formatearMoneda(subtotal)
    document.getElementById("detalleImpuestos").textContent = formatearMoneda(impuestos)
    document.getElementById("detalleTotal").textContent = formatearMoneda(total)

    const modal = document.getElementById("modalDetallesPedido")
    if (modal) {
      modal.classList.add("show")
    }
  } catch (error) {
    console.error("[v0] Error al obtener detalles:", error)
    alert("Error al cargar los detalles del pedido: " + error.message)
  }
}

function mostrarProductosDelPedido(venta) {
  const container = document.getElementById("detalleProductos")
  if (!container) return

  const detalles = venta.detalles || venta.items || []

  if (detalles.length === 0) {
    container.innerHTML = '<p style="color: var(--text-gray); text-align: center;">No hay productos</p>'
    return
  }

  container.innerHTML = detalles
    .map(
      (detalle, index) => `
      <div style="background: rgba(0, 102, 255, 0.1); padding: 12px; border-radius: 8px; border-left: 3px solid var(--ice-cyan); display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <p style="color: var(--ice-cyan); font-weight: bold; margin-bottom: 4px;">${detalle.productoNombre || detalle.producto_nombre || "Producto"}</p>
          <p style="color: var(--text-gray); font-size: 12px;">Cantidad: ${detalle.cantidad} x ${formatearMoneda(detalle.precioUnitario || detalle.precio_unitario || 0)}</p>
          ${detalle.notas ? `<p style="color: #ffaa00; font-size: 12px;">📝 ${detalle.notas}</p>` : ""}
          <p style="color: var(--ice-cyan); font-weight: bold; margin-top: 4px;">${formatearMoneda(detalle.subtotal || detalle.cantidad * (detalle.precioUnitario || detalle.precio_unitario || 0))}</p>
        </div>
        <button onclick="abrirModalEditarProducto(${index})" style="background: #0066ff; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-left: 10px; font-weight: bold;">Editar</button>
      </div>
    `,
    )
    .join("")
}

function abrirModalEditarProducto(index) {
  if (!detallesVentaEditando || !detallesVentaEditando[index]) return

  productoEditandoIndex = index
  const detalle = detallesVentaEditando[index]

  document.getElementById("editProductoNombre").textContent =
    detalle.productoNombre || detalle.producto_nombre || "Producto"
  document.getElementById("editCantidadDisplay").textContent = detalle.cantidad

  const modal = document.getElementById("modalEditarProducto")
  if (modal) modal.classList.add("show")
}

function cerrarModalEditarProducto() {
  const modal = document.getElementById("modalEditarProducto")
  if (modal) modal.classList.remove("show")
  productoEditandoIndex = null
}

function cerrarModalDetallesPedido() {
  const modal = document.getElementById("modalDetallesPedido")
  if (modal) modal.classList.remove("show")
  ventaDetalleActual = null
  detallesVentaEditando = null
}

function cambiarCantidadEditar(delta) {
  const cantidadDisplay = document.getElementById("editCantidadDisplay")
  if (!cantidadDisplay) return

  let cantidad = Number.parseInt(cantidadDisplay.textContent) || 1
  cantidad = Math.max(1, cantidad + delta)
  cantidadDisplay.textContent = cantidad
}

function eliminarProductoDelPedido() {
  if (productoEditandoIndex === null || !detallesVentaEditando) return

  if (confirm("¿Está seguro que desea eliminar este producto del pedido?")) {
    detallesVentaEditando.splice(productoEditandoIndex, 1)
    cerrarModalEditarProducto()
    mostrarProductosDelPedido({ detalles: detallesVentaEditando })
    recalcularTotales()
  }
}

function guardarCambiosProducto() {
  if (productoEditandoIndex === null || !detallesVentaEditando) return

  const cantidadDisplay = document.getElementById("editCantidadDisplay")
  const nuevaCantidad = Number.parseInt(cantidadDisplay?.textContent || 1)

  detallesVentaEditando[productoEditandoIndex].cantidad = nuevaCantidad

  cerrarModalEditarProducto()
  mostrarProductosDelPedido({ detalles: detallesVentaEditando })
  recalcularTotales()
}

function recalcularTotales() {
  if (!detallesVentaEditando) return

  const subtotal = detallesVentaEditando.reduce((sum, det) => {
    return sum + det.cantidad * (det.precioUnitario || det.precio_unitario || 0)
  }, 0)

  const impuestos = subtotal * 0.15
  const total = subtotal + impuestos

  document.getElementById("detalleSubtotal").textContent = formatearMoneda(subtotal)
  document.getElementById("detalleImpuestos").textContent = formatearMoneda(impuestos)
  document.getElementById("detalleTotal").textContent = formatearMoneda(total)
}

function agregarProductosAlPedido() {
  if (!ventaDetalleActual) return

  const numeroMesa = ventaDetalleActual.numeroMesa || ventaDetalleActual.numero_mesa || mesaNumero

  mesaNumero = numeroMesa
  document.getElementById("mesaDisplay").textContent = mesaNumero

  cerrarModalDetallesPedido()
  cerrarModalHistorialMesas()

  alert("Mesa cambiada a " + numeroMesa + ". Ahora puedes agregar productos a este pedido.")
}

async function enviarPedidoActualizadoWhatsApp() {
  if (!ventaDetalleActual || !detallesVentaEditando) return

  try {
    const numeroMesa = ventaDetalleActual.numeroMesa || ventaDetalleActual.numero_mesa || "N/A"
    const subtotal = detallesVentaEditando.reduce((sum, det) => {
      return sum + det.cantidad * (det.precioUnitario || det.precio_unitario || 0)
    }, 0)
    const impuestos = subtotal * 0.15
    const total = subtotal + impuestos

    let mensaje = "🧊 *PEDIDO ICE VIBE - ACTUALIZADO* 🧊\n\n"
    mensaje += `📋 Pedido: ${ventaDetalleActual.id}\n`
    mensaje += `🪑 Mesa: ${numeroMesa}\n`
    mensaje += `👨‍💼 Atendido por: ${ventaDetalleActual.vendedor || session.nombre || "N/A"}\n\n`
    mensaje += "*PRODUCTOS:*\n"

    detallesVentaEditando.forEach((detalle) => {
      const nombreProducto = detalle.productoNombre || detalle.producto_nombre || "Producto"
      const precioUnitario = detalle.precioUnitario || detalle.precio_unitario || 0
      mensaje += `\n• ${nombreProducto}\n`
      mensaje += `  Cantidad: ${detalle.cantidad}\n`
      mensaje += `  Precio: ${formatearMoneda(precioUnitario)}\n`
      if (detalle.notas) {
        mensaje += `  📝 Especificaciones: ${detalle.notas}\n`
      }
      mensaje += `  Subtotal: ${formatearMoneda(detalle.cantidad * precioUnitario)}\n`
    })

    mensaje += `\n━━━━━━━━━━━━━━━━\n`
    mensaje += `💰 *TOTAL: ${formatearMoneda(total)}*\n\n`
    mensaje += "¡Gracias por tu pedido! 🎉"

    const telefono =
      ventaDetalleActual.numeroWhatsapp || ventaDetalleActual.numero_whatsapp || window.API_CONFIG.WHATSAPP_NUMBER
    const telefonoLimpio = telefono.replace(/\D/g, "")

    if (!telefonoLimpio || telefonoLimpio.length < 10) {
      alert("No hay número de WhatsApp válido configurado")
      return
    }

    const urlWhatsapp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`
    console.log("[v0] WhatsApp URL:", urlWhatsapp)
    window.open(urlWhatsapp, "_blank")
  } catch (error) {
    console.error("[v0] Error al enviar WhatsApp:", error)
    alert("Error al enviar por WhatsApp: " + error.message)
  }
}

async function marcarMesaComoPaga(numeroMesa, ventaId) {
  if (confirm(`¿La mesa ${numeroMesa} ya pagó y se fue?`)) {
    console.log(`[v0] Mesa ${numeroMesa} marcada como pagada (Venta ID: ${ventaId})`)
    alert(`✅ Mesa ${numeroMesa} marcada como pagada.`)
    cargarHistorial()
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

function irANuevaOrden() {
  carrito = []
  actualizarCarrito()
  categoriaActual = "TODAS"
  const btns = document.querySelectorAll(".category-btn")
  if (btns.length > 0) {
    btns[0].click()
  }
}

function logout() {
  if (confirm("¿Está seguro de cerrar sesión?")) {
    localStorage.removeItem("session")
    window.location.href = "index.html"
  }
}

// ==================== ADDED FUNCTIONS ====================

function marcarMesaComoPagaConfirm() {
  if (!ventaDetalleActual) {
    alert("No hay detalles de pedido cargados")
    return
  }

  const numeroMesa = ventaDetalleActual.numeroMesa || ventaDetalleActual.numero_mesa || "N/A"
  const ventaId = ventaDetalleActual.id

  if (confirm(`¿La mesa ${numeroMesa} ya pagó y se fue?`)) {
    console.log(`[v0] Mesa ${numeroMesa} marcada como pagada (Venta ID: ${ventaId})`)
    alert(`✅ Mesa ${numeroMesa} marcada como pagada.`)
    cerrarModalDetallesPedido()
    cargarHistorial()
  }
}

async function enviarPedidoWhatsApp() {
  await enviarPedidoActualizadoWhatsApp()
}

function filtrarMesas(filtro) {
  const botones = document.querySelectorAll(".btn-filter")
  botones.forEach((btn) => btn.classList.remove("active"))

  event.target.classList.add("active")

  if (filtro === "TODAS") {
    mostrarHistorialMesas()
  } else if (filtro === "ACTIVAS") {
    const container = document.getElementById("mesasContainer")
    if (!container) return

    const mesasMap = {}
    historialVentas.forEach((venta) => {
      const numeroMesa = venta.numeroMesa || venta.numero_mesa || "N/A"
      if (!mesasMap[numeroMesa]) {
        mesasMap[numeroMesa] = venta
      } else {
        const fechaNueva = new Date(venta.fechaVenta)
        const fechaAnterior = new Date(mesasMap[numeroMesa].fechaVenta)
        if (fechaNueva > fechaAnterior) {
          mesasMap[numeroMesa] = venta
        }
      }
    })

    const mesas = Object.entries(mesasMap)
      .map(([numeroMesa, venta]) => ({ numeroMesa, venta }))
      .sort((a, b) => new Date(b.venta.fechaVenta) - new Date(a.venta.fechaVenta))

    container.innerHTML = mesas
      .map(({ numeroMesa, venta }) => {
        const fecha = new Date(venta.fechaVenta)
        const horaFormato = fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
        const tiempoTranscurrido = Math.floor((Date.now() - fecha.getTime()) / 1000 / 60)
        const tiempoTexto = tiempoTranscurrido < 1 ? "Hace poco" : `Hace ${tiempoTranscurrido}m`

        return `
          <div class="historial-item">
            <div class="historial-header">
              <div>
                <strong style="font-size: 1.3em; color: #00ffff;">🪑 MESA ${numeroMesa}</strong>
                <span class="historial-date">${tiempoTexto}</span>
              </div>
              <span class="historial-total">${formatearMoneda(venta.total)}</span>
            </div>
            <div class="historial-details">
              <p><strong>Atendido por:</strong> ${venta.vendedor || session.nombre || "N/A"}</p>
              <p><strong>Hora:</strong> ${horaFormato}</p>
              <p><strong>Estado:</strong> <span class="badge badge-success">ACTIVA</span></p>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button class="btn-view-details" onclick="verDetallesVentaMesa(${venta.id})" style="flex: 1;">Ver Detalles</button>
              <button class="btn-view-details" style="background-color: #ff3366; flex: 1;" onclick="marcarMesaComoPaga('${numeroMesa}', ${venta.id})">Mesa Pagó</button>
            </div>
          </div>
        `
      })
      .join("")
  }
}
