(() => {
  // ====== CONFIG ======
  const WHATSAPP_NUMBER = "573122090057"; // 3122090057 (CO)

  const STORAGE_KEY = "dulce_encanto_bookings_v1";

  // ====== Helpers ======
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const pad2 = (n) => String(n).padStart(2, "0");
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const prettyDate = (iso) => {
    if (!iso) return "Ninguna";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const loadBookings = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  };

  const saveBookings = (bookings) => localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));

  const buildWaLink = (message) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  const setYear = () => {
    const y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  };

  // ====== Mobile Nav ======
  const initMobileNav = () => {
    const toggle = document.getElementById("navToggle");
    const overlay = document.getElementById("navOverlay");
    const drawer = document.getElementById("mobileNav");

    // Si no existen en esta página, salimos sin error
    if (!toggle || !overlay || !drawer) return;

  // DEBUG: indicar que init se ejecutó y elementos encontrados
  console.debug('[DE] initMobileNav — found:', { toggle: !!toggle, overlay: !!overlay, drawer: !!drawer });

  // Asegurar estado inicial cerrado
  try { drawer.hidden = true; } catch (e) { console.debug('[DE] drawer.hidden init error', e); }
  try { overlay.hidden = true; } catch (e) { console.debug('[DE] overlay.hidden init error', e); }
  try { toggle.setAttribute("aria-expanded", "false"); } catch (e) { /* ignore */ }

  // Media query para decidir si el modo móvil está activo
  const mql = window.matchMedia('(max-width: 980px)');

    const openMenu = () => {
      // Sólo abrir si estamos en modo móvil
      if (!mql.matches) return;
      drawer.hidden = false;
      overlay.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
      drawer.hidden = true;
      overlay.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      console.debug('[DE] toggle click — expanded', expanded, 'mql.matches', mql.matches);
      expanded ? closeMenu() : openMenu();
    });

    overlay.addEventListener("click", () => {
      console.debug('[DE] overlay click — closing');
      closeMenu();
    });

    // Todos los botones con clase .nav-close (incluye el del drawer)
    document.querySelectorAll(".nav-close").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.debug('[DE] nav-close clicked');
        closeMenu();
      });
    });

    // Cerrar al pulsar cualquier enlace dentro del drawer
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => closeMenu()));

    // Escape para cerrar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        console.debug('[DE] Escape pressed — closing drawer');
        closeMenu();
      }
    });

    // Delegación adicional por si los listeners directos no se engancharon
    document.addEventListener('click', (e) => {
      // botón de cierre
      if (e.target.closest && e.target.closest('.nav-close')) {
        console.debug('[DE] delegated nav-close click');
        closeMenu();
        return;
      }

      // overlay
      if (e.target.id === 'navOverlay' || e.target.closest('#navOverlay')) {
        console.debug('[DE] delegated overlay click');
        closeMenu();
        return;
      }

      // enlaces dentro del drawer
      if (e.target.closest && e.target.closest('#mobileNav a')) {
        console.debug('[DE] delegated drawer link click');
        closeMenu();
        return;
      }
    }, { capture: true });

    // Si cambiamos a desktop, forzamos cerrado
    const updateMode = () => {
      if (!mql.matches) {
        closeMenu();
      }
    };

  // Llamada inicial para forzar estado correcto según tamaño
  console.debug('[DE] initMobileNav — initial mql.matches =', mql.matches);
  updateMode();
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', updateMode);
    else if (typeof mql.addListener === 'function') mql.addListener(updateMode);
  };


  // ====== WhatsApp Buttons ======
  const wireWhatsAppButtons = () => {
    const baseMsg =
`Hola ✨ Quiero agendar una cita en *Dulce Encanto Stetic*.
¿Me compartes disponibilidad para hoy o esta semana?
📍 Barrio Miraflores`;

    const headerBtn = $("#waHeaderBtn");
    const headerBtnMobile = $("#waHeaderBtnMobile");
    const floatBtn = $("#waFloatBtn");

    if (headerBtn) headerBtn.href = buildWaLink(baseMsg);
    if (headerBtnMobile) headerBtnMobile.href = buildWaLink(baseMsg);
    if (floatBtn) floatBtn.href = buildWaLink(baseMsg);
  };

  // ====== Calendar (solo si existe en la página) ======
  const initCalendar = () => {
    const grid = $("#calendarGrid");
    const monthLabel = $("#monthLabel");
    const selectedDateLabel = $("#selectedDateLabel");

    if (!grid || !monthLabel || !selectedDateLabel) return;

    const weekdays = $("#weekdays");
    if (weekdays && weekdays.childElementCount === 0) {
      ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(d => {
        const el = document.createElement("div");
        el.textContent = d;
        weekdays.appendChild(el);
      });
    }

    let view = new Date();
    view.setDate(1);

    let selectedISO = "";
    const bookings = loadBookings();

    const render = () => {
      const year = view.getFullYear();
      const month = view.getMonth();

      monthLabel.textContent = view.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
      grid.innerHTML = "";

      // Semana empieza lunes
      const firstDay = new Date(year, month, 1);
      let startDow = firstDay.getDay(); // 0 dom..6 sáb
      startDow = (startDow === 0) ? 7 : startDow; // 1..7
      const offset = startDow - 1;

      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < offset; i++) {
        const cell = document.createElement("div");
        cell.className = "day disabled";
        grid.appendChild(cell);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const iso = toISODate(date);

        const cell = document.createElement("div");
        cell.className = "day";
        cell.dataset.iso = iso;

        const n = document.createElement("div");
        n.className = "n";
        n.textContent = d;
        cell.appendChild(n);

        const hasBooking = bookings.some(b => b.date === iso);
        if (hasBooking) {
          const dot = document.createElement("div");
          dot.className = "dot";
          cell.appendChild(dot);
        }

        if (iso === selectedISO) cell.classList.add("selected");

        cell.addEventListener("click", () => {
          selectedISO = iso;
          selectedDateLabel.textContent = prettyDate(selectedISO);
          $$(".day.selected").forEach(x => x.classList.remove("selected"));
          cell.classList.add("selected");
        });

        grid.appendChild(cell);
      }

      // default: hoy si está en el mes
      if (!selectedISO) {
        const todayISO = toISODate(new Date());
        if (todayISO.startsWith(`${year}-${pad2(month + 1)}`)) {
          selectedISO = todayISO;
          const dayEl = $(`.day[data-iso="${selectedISO}"]`);
          if (dayEl) dayEl.classList.add("selected");
        }
      }

      selectedDateLabel.textContent = selectedISO ? prettyDate(selectedISO) : "Ninguna";
    };

    $("#prevMonth")?.addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      render();
    });

    $("#nextMonth")?.addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      render();
    });

    $("#todayBtn")?.addEventListener("click", () => {
      view = new Date();
      view.setDate(1);
      render();
      const todayISO = toISODate(new Date());
      const dayEl = $(`.day[data-iso="${todayISO}"]`);
      if (dayEl) dayEl.click();
    });

    render();
    window.__DE_SELECTED_DATE__ = () => selectedISO;
  };

  // ====== Booking Form ======
  const initBookingForm = () => {
    const form = $("#bookingForm");
    if (!form) return;

    const list = $("#bookingsList");
    const clearAllBtn = $("#clearAllBookings");
    const clearBtn = $("#clearBtn");

    const renderBookings = () => {
      if (!list) return;

      const bookings = loadBookings();
      if (bookings.length === 0) {
        list.innerHTML = `<div class="muted">Aún no hay reservas guardadas.</div>`;
        return;
      }

      bookings.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));

      list.innerHTML = bookings.map(b => `
        <div class="booking-item">
          <strong>${b.service}</strong>
          <div class="booking-meta">
            ${prettyDate(b.date)} • ${b.time}<br/>
            ${b.name} • ${b.phone}
            ${b.notes ? `<br/>📝 ${b.notes}` : ""}
          </div>
        </div>
      `).join("");
    };

    renderBookings();

    clearAllBtn?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      renderBookings();
    });

    clearBtn?.addEventListener("click", () => {
      form.reset();
    });

    $("#goToFormBtn")?.addEventListener("click", () => {
      $("#bookingCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const phone = String(data.get("phone") || "").trim();
      const service = String(data.get("service") || "").trim();
      const time = String(data.get("time") || "").trim();
      const notes = String(data.get("notes") || "").trim();
      const saveLocal = Boolean(data.get("saveLocal"));

      const selectedDate = (window.__DE_SELECTED_DATE__ && window.__DE_SELECTED_DATE__()) || "";
      if (!selectedDate) {
        alert("Por favor selecciona una fecha en el calendario.");
        return;
      }

      // Mensaje de RESERVA (cliente -> negocio)
      const msgLines = [
        `Hola 😊 Soy *${name}*.`,
        `Quisiera agendar una cita en *Dulce Encanto Stetic*.`,
        ``,
        `📅 *Fecha:* ${prettyDate(selectedDate)}`,
        `⏰ *Hora:* ${time}`,
        `💆‍♀️ *Servicio:* ${service}`,
        `📞 *Teléfono:* ${phone}`
      ];
      if (notes) msgLines.push(`📝 *Notas:* ${notes}`);
      msgLines.push("", "¿Hay disponibilidad? ¡Gracias! ✨");

      const message = msgLines.join("\n");

      // ✅ Mensaje AUTOMÁTICO de CONFIRMACIÓN (negocio -> cliente)
      const confirmLines = [
        `Hola ✨`,
        `Gracias por agendar tu cita en *Dulce Encanto Stetic* 💆‍♀️🌿`,
        ``,
        `Te confirmamos tu cita con los siguientes detalles:`,
        ``,
        `📅 *Fecha:* ${prettyDate(selectedDate)}`,
        `⏰ *Hora:* ${time}`,
        `💆‍♀️ *Servicio:* ${service}`,
        ``,
        `📍 *Ubicación:* Barrio Miraflores, Dg16c#1-35`,
        ``,
        `Si tienes alguna duda o necesitas reprogramar, escríbenos con confianza 💛`
      ];
      const confirmMessage = confirmLines.join("\n");

      // Pinta confirmación en la web
      const confirmBox = $("#confirmMsg");
      if (confirmBox) confirmBox.value = confirmMessage;

      // Link WhatsApp con confirmación
      const openConfirmBtn = $("#openConfirmWaBtn");
      if (openConfirmBtn) openConfirmBtn.href = buildWaLink(confirmMessage);

      // Copiar confirmación
      const copyBtn = $("#copyConfirmBtn");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(confirmMessage);
            copyBtn.textContent = "¡Copiado! ✅";
            setTimeout(() => (copyBtn.textContent = "Copiar confirmación"), 1500);
          } catch {
            alert("No se pudo copiar automáticamente. Selecciona el texto y copia manual.");
          }
        };
      }

      // Guardar en localStorage
      if (saveLocal) {
        const bookings = loadBookings();
        bookings.push({ name, phone, service, time, notes, date: selectedDate, createdAt: Date.now() });
        saveBookings(bookings);
        renderBookings();
      }

      // Abre WhatsApp con mensaje de reserva
      window.open(buildWaLink(message), "_blank", "noopener,noreferrer");
    });
  };

  // ====== Lightbox (Galería) ======
  const initLightbox = () => {
    const lb = $("#lightbox");
    const lbImg = $("#lightboxImg");
    const lbCap = $("#lightboxCap");
    const closeBtn = $("#lightboxClose");

    if (!lb || !lbImg || !lbCap) return;

    const items = $$(".gallery-item");
    if (items.length === 0) return;

    const open = (src, cap) => {
      lbImg.src = src;
      lbCap.textContent = cap || "";
      lb.classList.add("show");
      lb.setAttribute("aria-hidden", "false");
    };

    const close = () => {
      lb.classList.remove("show");
      lb.setAttribute("aria-hidden", "true");
      lbImg.src = "";
      lbCap.textContent = "";
    };

    items.forEach(fig => {
      fig.addEventListener("click", () => {
        const img = fig.querySelector("img");
        const cap = fig.querySelector("figcaption")?.textContent || "";
        if (img) open(img.src, cap);
      });
    });

    closeBtn?.addEventListener("click", close);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  };

  // ====== Init ======
  setYear();
  initMobileNav();
  wireWhatsAppButtons();
  initCalendar();
  initBookingForm();
  initLightbox();
})();
