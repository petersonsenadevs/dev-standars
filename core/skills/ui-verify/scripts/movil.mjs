/**
 * Senzu · ui-verify: comprobaciones de MÓVIL que se ejecutan dentro de la página (page.evaluate).
 * Ninguna función usa nada de fuera.
 *
 *  auditarMovil()  → [{ tipo, mensaje, marca }] contenido solo con hover, campos < 16 px (zoom en iOS),
 *                    fijos que tapan > 20 % de la pantalla, background-attachment: fixed, cursor propio,
 *                    h1 que ocupa media pantalla, animaciones sin prefers-reduced-motion, navegación que
 *                    desborda o desaparece sin botón.
 *  resumenMovil()  → líneas informativas con los tamaños reales (h1, h2, párrafo, cabecera, primer CTA).
 *  buscarMenu()    → { encontrado, problemas[] } localiza el botón del menú y lo marca con data-senzu-menu.
 *  estadoMenu(abierto) → { problemas[] } tras pulsar (o cerrar) el menú: qué se ve y si es usable.
 *  marcarAvisos(n) → dibuja un recuadro rojo numerado en cada elemento con data-senzu-aviso (captura anotada).
 */
export function auditarMovil() {
    const out = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const nombre = el => { if (!el || !el.tagName) return '?'; const c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${c}>`; };
    const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    let n = 0;
    const marcar = el => { if (!el) return null; if (!el.hasAttribute('data-senzu-aviso')) el.setAttribute('data-senzu-aviso', 'm' + (++n)); return el.getAttribute('data-senzu-aviso'); };
    const reglas = [];
    const recorrer = (lista, media) => { for (const r of lista) { try {
        if (r.type === 1) reglas.push({ sel: r.selectorText || '', estilo: r.style, media });
        else if (r.cssRules) recorrer(r.cssRules, (media ? media + ' ' : '') + (r.conditionText || (r.media && r.media.mediaText) || ''));
    } catch {} } };
    for (const h of document.styleSheets) { try { recorrer(h.cssRules, ''); } catch {} }   // hojas de otro origen: no legibles

    // 1. Contenido que solo aparece con hover (en móvil no hay hover): reglas «X:hover Y» que muestran Y
    const revela = s => ['opacity', 'visibility', 'display', 'max-height', 'height', 'transform', 'clip-path'].some(p => s.getPropertyValue(p));
    // equivalentes de teclado/toque, también en la misma regla («.a:hover .b, .a:focus-within .b»)
    const conFoco = new Set(reglas.flatMap(r => r.sel.split(',')).filter(s => /:focus(-within|-visible)?/.test(s)).map(s => s.trim().replace(/:focus(-within|-visible)?/g, ':X')));
    const vistosHover = new Set();
    for (const r of reglas) {
        if (!/:hover/.test(r.sel) || /\(hover:\s*hover\)|pointer:\s*fine/.test(r.media || '')) continue;
        for (const parte of r.sel.split(',')) {
            const m = /^(.*?):hover([\s>+~].+)$/.exec(parte.trim());   // :hover en un elemento y cambia OTRO (descendiente o hermano)
            if (!m || !revela(r.estilo)) continue;
            const equivalente = conFoco.has(parte.trim().replace(/:hover/, ':X'));
            if (equivalente) continue;
            let objetivo = null; try { objetivo = document.querySelector(m[1] + m[2]); } catch {}
            if (!objetivo) continue;
            const s = getComputedStyle(objetivo);
            const oculto = s.opacity === '0' || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.maxHeight) === 0;
            if (!oculto || vistosHover.has(parte)) continue;
            vistosHover.add(parte);
            out.push({ tipo: 'solo-hover', mensaje: `Contenido que solo aparece con hover (${parte.trim()}): en móvil no hay hover y no se verá nunca. Hazlo visible en táctil, dale un equivalente con :focus-within o un toque, o limita el efecto a @media (hover: hover).`, marca: marcar(objetivo.closest('a,button,article,li,div') || objetivo) });
            if (vistosHover.size >= 5) break;
        }
    }

    // 2. Campos de formulario con texto < 16 px: iOS hace zoom al enfocarlos y descoloca la página
    const pequenos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=range]),select,textarea')]
        .filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16);
    if (pequenos.length) out.push({ tipo: 'input-zoom', mensaje: `${pequenos.length} campo(s) de formulario con texto de ${parseFloat(getComputedStyle(pequenos[0]).fontSize)} px (< 16 px): en iPhone la página hace zoom al tocarlos. Pon font-size: 16px (1rem) en móvil.`, marca: marcar(pequenos[0]) });

    // 3. Elementos fijos o pegajosos que tapan demasiada pantalla (cabecera, banner, cookies)
    for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (!['fixed', 'sticky'].includes(s.position) || !visible(el)) continue;
        const r = el.getBoundingClientRect();
        // tapa si está pegado a un borde de la pantalla; un sticky que aún no ha llegado arriba (tarjetas apiladas) no
        const pegado = (r.top <= 1 && r.bottom > 0) || (r.bottom >= vh - 1 && r.top < vh);
        if (!pegado) continue;
        if (r.width < vw * 0.6 || r.height >= vh * 0.95) continue;   // botones flotantes pequeños y capas completas (menú abierto, loader) no cuentan
        const ocupa = r.height / vh;
        if (ocupa > 0.2) out.push({ tipo: 'fijo-tapa', mensaje: `${nombre(el)} (${s.position}) ocupa ${Math.round(r.height)} px, el ${Math.round(ocupa * 100)} % de la pantalla de ${vh} px: en móvil tapa el contenido. Cabecera fija ≤ 64 px; banners y avisos, compactos o que se puedan cerrar.`, marca: marcar(el) });
    }

    // 4. background-attachment: fixed (iOS no lo soporta y en Android hace tirones al hacer scroll)
    const fijoFondo = [...document.querySelectorAll('body *')].filter(el => getComputedStyle(el).backgroundAttachment.split(',').some(v => v.trim() === 'fixed') && visible(el));
    if (fijoFondo.length) out.push({ tipo: 'fondo-fijo', mensaje: `${nombre(fijoFondo[0])}${fijoFondo.length > 1 ? ` y ${fijoFondo.length - 1} más` : ''} usa background-attachment: fixed: en iPhone no funciona y en Android da tirones. En móvil, fondo normal (scroll) o una imagen fija sin efecto.`, marca: marcar(fijoFondo[0]) });

    // 5. Animaciones sin versión para movimiento reducido
    let animadas = 0; try { animadas = document.getAnimations().length; } catch {}
    const reducido = reglas.some(r => /prefers-reduced-motion/.test(r.media || ''));
    if (animadas && !reducido) out.push({ tipo: 'sin-movimiento-reducido', mensaje: `Hay ${animadas} animación(es) y ninguna regla @media (prefers-reduced-motion: reduce): quien tiene activado «reducir movimiento» las verá igual (y en móvil gastan batería).`, marca: null });

    // 5b. Efectos de ratón que en táctil no existen: cursor propio (cursor: none + un círculo que sigue al ratón)
    const sinCursor = [document.documentElement, document.body].some(el => getComputedStyle(el).cursor === 'none');
    const seguidor = [...document.querySelectorAll('[class*="cursor" i]')].find(el => { const s = getComputedStyle(el); return s.position === 'fixed' && s.pointerEvents === 'none' && visible(el); });
    if (sinCursor || seguidor) out.push({ tipo: 'efecto-raton', mensaje: `Cursor personalizado${seguidor ? ` (${nombre(seguidor)})` : ''} visible en móvil: no hay ratón, se queda quieto en una esquina o tapa contenido. Muéstralo solo con @media (hover: hover) and (pointer: fine).`, marca: marcar(seguidor) });

    // 5c. Título que se come la primera pantalla
    const h1 = document.querySelector('h1');
    if (h1 && visible(h1)) {
        const r = h1.getBoundingClientRect();
        if (r.height > vh * 0.5) out.push({ tipo: 'titulo-enorme', mensaje: `El <h1> ocupa ${Math.round(r.height)} px (${Math.round(r.height / vh * 100)} % de la pantalla) a ${parseFloat(getComputedStyle(h1).fontSize)} px: en móvil empuja todo lo demás fuera. Usa clamp() (p. ej. clamp(2rem, 8vw, 4.5rem)) o menos palabras.`, marca: marcar(h1) });
    }

    // 6. Navegación principal en móvil: que no desborde y que no desaparezca sin botón
    // solo la de arriba (la principal): las del pie o las de dentro de un menú cerrado no cuentan
    const arriba = el => el.getBoundingClientRect().top + window.scrollY < vh * 1.5 && !el.closest('footer,[role=contentinfo]');
    const navs = [...document.querySelectorAll('header nav, nav[aria-label], body > nav, [role=navigation]')].filter(arriba);
    // cualquier botón visible arriba sirve para abrirla (burger, «Menú», un icono con aria-controls…)
    const hayBoton = [...document.querySelectorAll('button,[role=button],[aria-controls],[aria-expanded],label[for]')].some(b => visible(b) && b.getBoundingClientRect().top + window.scrollY < vh * 0.25);
    for (const nav of navs.slice(0, 2)) {
        const enlaces = [...nav.querySelectorAll('a')];
        const enPantalla = a => { const q = a.getBoundingClientRect(); return q.right > 0 && q.left < vw; };
        const vis = enlaces.filter(a => visible(a) && enPantalla(a));
        if (!enlaces.length) continue;
        if (!vis.length && !hayBoton) { out.push({ tipo: 'nav-desaparece', mensaje: `La navegación ${nombre(nav)} se oculta en móvil y no hay ningún botón visible para abrirla: en móvil no se puede navegar.`, marca: marcar(nav) }); continue; }
        if (vis.length) {
            const filas = new Set(vis.map(a => Math.round(a.getBoundingClientRect().top / 8))).size;
            // una fila de pestañas que se desliza (overflow-x: auto) es un patrón móvil válido, no un desborde
            const desliza = [nav, ...nav.querySelectorAll('*')].some(e => /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1);
            if (desliza) continue;
            const desborda = nav.scrollWidth > nav.clientWidth + 1 || vis.some(a => a.getBoundingClientRect().right > vw + 1);
            if (vis.length >= 5 && (filas > 1 || desborda)) out.push({ tipo: 'nav-no-cabe', mensaje: `La navegación ${nombre(nav)} muestra ${vis.length} enlaces en móvil ${desborda ? 'y se sale de la pantalla' : `repartidos en ${filas} filas`}: con 5 o más enlaces, menú desplegable (botón burger ☰) o barra inferior si es una app.`, marca: marcar(nav) });
        }
    }
    return out;
}

// Tamaños reales en móvil (informativo, no falla): para comparar con la captura y con el plan móvil de la maqueta
export function resumenMovil() {
    const vh = window.innerHeight;
    const px = el => el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const p = [...document.querySelectorAll('main p, article p, p')].find(e => visible(e) && e.textContent.trim().length > 40);
    const cab = [...document.querySelectorAll('header')].find(visible);
    const ctas = [...document.querySelectorAll('a,button')].filter(visible).filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.backgroundColor !== 'rgba(0, 0, 0, 0)' && e.textContent.trim().length > 2 && !e.closest('header,nav,[role=dialog],[class*="cookie" i],[id*="cookie" i],[class*="consent" i]') && !/skip|saltar|ir al contenido/i.test(e.textContent) && r.width >= 24 && r.height >= 24 && s.position !== 'fixed'; });
    const cta = ctas[0];
    const lineas = [];
    lineas.push(`h1 ${px(document.querySelector('h1')) ?? '—'} px · h2 ${px(document.querySelector('h2')) ?? '—'} px · párrafo ${px(p) ?? '—'} px${p ? ` (${Math.round(p.getBoundingClientRect().width / (parseFloat(getComputedStyle(p).fontSize) * 0.5))} car./línea aprox.)` : ''}`);
    if (cab) lineas.push(`cabecera ${Math.round(cab.getBoundingClientRect().height)} px (${getComputedStyle(cab).position})`);
    if (cta) { const r = cta.getBoundingClientRect(); lineas.push(`primer CTA «${cta.textContent.trim().slice(0, 24)}» ${Math.round(r.width)}×${Math.round(r.height)} px, ${r.top + window.scrollY < vh ? 'visible sin hacer scroll' : `a ${Math.round(r.top + window.scrollY)} px (fuera de la primera pantalla de ${vh})`}`); }
    return lineas;
}

export function buscarMenu() {
    const vh = window.innerHeight;
    const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const texto = el => [el.getAttribute('aria-label'), el.textContent, el.getAttribute('title'), el.id, typeof el.className === 'string' ? el.className : ''].join(' ').slice(0, 300);
    // Puntuación: señales de «menú de navegación» a favor; buscador, carrito, cuenta, logo, idioma o tema en contra
    const puntos = el => {
        const t = texto(el);
        if (/search|busca|cart|carrito|cesta|\bbag\b|bolsa|account|cuenta|login|sign.?in|acceder|logo|idioma|language|theme|tema|dark|close|cerrar|cookie/i.test(t)) return -1;
        let p = 0;
        if (/men[uú]|navigation|navegaci|burger|hamburg|nav.?toggle|drawer|☰|≡|⋮|kebab|more|más/i.test(t)) p += 5;
        const id = el.getAttribute('aria-controls'), panel = id && document.getElementById(id);
        if (panel && (panel.matches('nav,[role=navigation]') || panel.querySelector('nav') || panel.querySelectorAll('a').length >= 3)) p += 3;
        if (el.hasAttribute('aria-expanded')) p += 1;
        if (el.tagName === 'BUTTON') p += 1;
        return p;
    };
    const candidatos = [...document.querySelectorAll('button,[role=button],a[aria-controls],a[aria-expanded],[class*="burger" i],[class*="hamburg" i],[class*="toggle" i]')]
        .filter(visible).filter(el => el.getBoundingClientRect().top < vh * 0.3)
        .map(el => ({ el, p: puntos(el) })).filter(x => x.p >= 3).sort((a, b) => b.p - a.p);
    const boton = candidatos[0] && candidatos[0].el;
    if (!boton) return { encontrado: false, problemas: [] };
    document.querySelectorAll('[data-senzu-menu]').forEach(e => e.removeAttribute('data-senzu-menu'));
    boton.setAttribute('data-senzu-menu', '1');
    // lo que ya se ve antes de pulsar: después, lo NUEVO visible es el menú
    const aLaVista = el => { const q = el.getBoundingClientRect(); return visible(el) && parseFloat(getComputedStyle(el).opacity) > 0.05 && q.bottom > 0 && q.right > 0 && q.left < window.innerWidth && q.top < vh; };
    document.querySelectorAll('a,button').forEach(e => { if (aLaVista(e)) e.setAttribute('data-senzu-antes', ''); else e.removeAttribute('data-senzu-antes'); });
    const r = boton.getBoundingClientRect(), problemas = [];
    const nombreAcc = (boton.getAttribute('aria-label') || boton.textContent.trim() || boton.getAttribute('title') || '').trim();
    if (r.width < 44 || r.height < 44) problemas.push(`El botón del menú mide ${Math.round(r.width)}×${Math.round(r.height)} px: mínimo 44×44 para el dedo (el icono puede ser de 24; el área táctil, no).`);
    if (!nombreAcc) problemas.push('El botón del menú no tiene nombre accesible (aria-label="Menú" o texto): un lector de pantalla no sabe qué es.');
    if (!boton.hasAttribute('aria-expanded')) problemas.push('El botón del menú no tiene aria-expanded: no informa de si está abierto o cerrado.');
    if (/⋮|kebab|more|más opciones/i.test(texto(boton)) && document.querySelectorAll('nav a').length >= 3)
        problemas.push('El menú principal se abre con un icono kebab (⋮): el ⋮ se reserva para acciones secundarias de un elemento; la navegación va con burger (☰).');
    if (problemas.length && !boton.hasAttribute('data-senzu-aviso')) boton.setAttribute('data-senzu-aviso', 'menú');   // recuadrado en la anotada
    return { encontrado: true, problemas, boton: `${boton.tagName.toLowerCase()} «${nombreAcc.slice(0, 30)}»` };
}

export function estadoMenu(abierto) {
    const vw = window.innerWidth, vh = window.innerHeight, problemas = [];
    const boton = document.querySelector('[data-senzu-menu]');
    if (!boton) return { problemas };
    // recortado: un ancestro con overflow distinto de visible lo deja fuera (acordeón cerrado, panel deslizado)
    const recortado = el => { const r = el.getBoundingClientRect(); for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue; const q = p.getBoundingClientRect(); if (Math.min(r.right, q.right) - Math.max(r.left, q.left) < 2 || Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) < 2) return true; } return false; };
    const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.left < vw && r.top < vh && !recortado(el); };
    const exp = boton.getAttribute('aria-expanded');
    // el menú = los enlaces que han aparecido al pulsar (y los del panel de aria-controls, si lo hay)
    const id = boton.getAttribute('aria-controls'), panel = id && document.getElementById(id);
    const nuevos = new Set([...document.querySelectorAll('a,button')].filter(e => e !== boton && !e.hasAttribute('data-senzu-antes') && visible(e)));
    if (panel) panel.querySelectorAll('a,button').forEach(e => { if (visible(e) && e !== boton) nuevos.add(e); });
    // sin anidados, y solo lo que el dedo tocaría: en su centro está él (no un panel que lo tapa)
    const encima = e => { const q = e.getBoundingClientRect(); return document.elementFromPoint(Math.min(Math.max(q.left + q.width / 2, 0), vw - 1), Math.min(Math.max(q.top + q.height / 2, 0), vh - 1)); };
    const alAlcance = e => { const t = encima(e); return !!t && (t === e || e.contains(t)); };   // un contenedor encima que lo «contiene» no vale: es el panel cerrado
    const todos = [...nuevos].filter(e => ![...nuevos].some(o => o !== e && o.contains(e)));
    // raíz del menú = ancestro común de lo que ha aparecido; si tapa algo de FUERA de ella, es la página tapando el menú
    let raiz = todos[0] ? todos[0].parentElement : null;
    while (raiz && !todos.every(e => raiz.contains(e))) raiz = raiz.parentElement;
    const tapados = todos.filter(e => e.matches('a[href]')).filter(e => { const t = encima(e); return t && !alAlcance(e) && raiz && !raiz.contains(t) && !t.contains(raiz) && t !== boton && !boton.contains(t); });
    const enlaces = todos.filter(alAlcance);
    if (abierto) {
        if (exp !== null && exp !== 'true') problemas.push('Tras pulsar el botón del menú, aria-expanded sigue en "false".');
        if (!enlaces.length) { problemas.push('Tras pulsar el botón del menú no aparece ningún enlace nuevo visible: el menú no se abre (o se abre fuera de la pantalla).'); return { problemas, enlaces: 0 }; }
        if (tapados.length) { const t = encima(tapados[0]); problemas.push(`${tapados.length} enlace(s) del menú abierto quedan TAPADOS por contenido de la página (<${t.tagName.toLowerCase()}${typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/s+/)[0] : ''}> encima): se ven pero no se pueden tocar. Sube el z-index del menú (y crea su contexto de apilamiento).`); }
        const fuera = enlaces.filter(a => { const r = a.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; });
        if (fuera.length) problemas.push(`${fuera.length} enlace(s) del menú abierto se salen de la pantalla por los lados.`);
        const bajos = enlaces.filter(a => a.getBoundingClientRect().height < 44);
        if (bajos.length) problemas.push(`${bajos.length} de ${enlaces.length} enlaces del menú abierto miden menos de 44 px de alto: difíciles de tocar (recomendado 48 px).`);
        const caja = a => a.getBoundingClientRect();
        const solapados = enlaces.filter((a, i) => enlaces.some((b, j) => j > i && (() => { const x = caja(a), y = caja(b); const ix = Math.min(x.right, y.right) - Math.max(x.left, y.left), iy = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top); return ix > 0 && iy > 0 && ix * iy > 0.3 * Math.min(x.width * x.height, y.width * y.height); })()));
        if (solapados.length) problemas.push(`${solapados.length} enlace(s) del menú abierto se solapan entre sí.`);
        return { problemas, enlaces: enlaces.length };
    }
    if (exp === 'true' || (exp === null && enlaces.length)) problemas.push('El menú no se cierra con Escape: quien navega con teclado se queda atrapado (cierra con Escape y devuelve el foco al botón).');
    return { problemas };
}

export function marcarAvisos() {
    const viejo = document.getElementById('senzu-anotaciones'); if (viejo) viejo.remove();
    const els = [...document.querySelectorAll('[data-senzu-aviso]')];
    const capa = document.createElement('div');
    capa.id = 'senzu-anotaciones';
    capa.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    for (const el of els) {
        const r = el.getBoundingClientRect();
        const caja = document.createElement('div');
        caja.style.cssText = `position:absolute;left:${r.left + window.scrollX - 2}px;top:${r.top + window.scrollY - 2}px;width:${r.width + 4}px;height:${r.height + 4}px;outline:2px solid #e11d48;background:rgba(225,29,72,.08)`;
        const etq = document.createElement('div');
        etq.textContent = el.getAttribute('data-senzu-aviso');
        etq.style.cssText = 'position:absolute;left:-2px;top:-20px;background:#e11d48;color:#fff;font:700 12px/18px system-ui;padding:0 6px;border-radius:3px';
        caja.appendChild(etq); capa.appendChild(caja);
    }
    document.body.appendChild(capa);
    return els.length;
}
