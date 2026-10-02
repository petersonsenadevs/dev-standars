/**
 * Senzu · ui-verify: auditoría GEOMÉTRICA (en píxeles, no a ojo). Se ejecuta DENTRO de la página
 * (page.evaluate(auditarGeometria, opciones)): la función no puede usar nada de fuera.
 *
 * Mide, con una tolerancia en px (por defecto 1):
 *  1. Centrado real: hijos de contenedores que centran (flex/grid centrados, margin auto, text-align center,
 *     left:50% + translate) frente al centro de la caja de contenido del contenedor.
 *  2. Loaders (spinner, progressbar, progress, skeleton, aria-busy, animación infinita): centrados en su capa;
 *     en una capa a pantalla completa, centrados en el viewport; loader y barra del mismo bloque, mismo eje.
 *  3. Spinner que «baila»: el centro de un elemento con animación infinita no debe moverse al girar.
 *  4. Dibujo de un SVG descentrado dentro de su propia caja (hueco en el viewBox).
 *  5. Hermanos «casi» alineados en una fila/columna flex o grid (diferencias pequeñas = un margin o top sobrante).
 * Devuelve [{ tipo, px, mensaje }].
 */
export function auditarGeometria(opciones) {
    const tol = (opciones && opciones.tolerancia) || 1;
    const max = (opciones && opciones.max) || 25;
    const out = [];
    const vistos = new Set();
    const vw = window.innerWidth, vh = window.innerHeight;
    const r1 = n => Math.round(n * 10) / 10;
    const nombre = el => {
        if (!el || !el.tagName) return '?';
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : (el.className && el.className.baseVal ? '.' + el.className.baseVal.trim().split(/\s+/)[0] : '');
        return `<${el.tagName.toLowerCase()}${id}${cls}>`;
    };
    const visible = el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0.5 && r.height > 0.5;
    };
    const caja = el => {   // caja de contenido (sin borde ni padding) en coordenadas de la página
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        const n = k => parseFloat(s[k]) || 0;
        const left = r.left + n('borderLeftWidth') + n('paddingLeft');
        const right = r.right - n('borderRightWidth') - n('paddingRight') - (el.offsetWidth - el.clientWidth - n('borderLeftWidth') - n('borderRightWidth'));   // sin la barra de scroll
        const top = r.top + n('borderTopWidth') + n('paddingTop');
        const bottom = r.bottom - n('borderBottomWidth') - n('paddingBottom');
        return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left, h: bottom - top };
    };
    const centro = el => { const r = el.getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width, h: r.height, r }; };
    const pista = el => {   // causa probable de un desplazamiento
        const s = getComputedStyle(el), p = [];
        for (const k of ['marginLeft', 'marginRight', 'marginTop', 'marginBottom']) { const v = parseFloat(s[k]); if (v && s[k] !== 'auto' && Math.abs(v) < 40) p.push(`${k.replace('margin', 'margin-').toLowerCase()}: ${s[k]}`); }
        if (s.position === 'relative' && ((parseFloat(s.top) || 0) || (parseFloat(s.left) || 0))) p.push(`position: relative con top/left (${s.top}/${s.left})`);
        if (s.transform && s.transform !== 'none' && !soloGira(el)) p.push('transform');   // la rotación de un spinner no desplaza
        if (s.alignSelf && !['auto', 'normal', 'stretch'].includes(s.alignSelf)) p.push(`align-self: ${s.alignSelf}`);
        const pl = parseFloat(getComputedStyle(el.parentElement || el).paddingLeft) || 0, pr = parseFloat(getComputedStyle(el.parentElement || el).paddingRight) || 0;
        if (Math.abs(pl - pr) > 0.5) p.push(`padding del contenedor asimétrico (${pl}/${pr}px)`);
        return p.length ? ` Causa probable: ${p.slice(0, 2).join(', ')}.` : '';
    };
    // Un mismo fallo, un solo aviso: el elemento culpable que ya tiene aviso no se vuelve a señalar por otra vía
    const culpables = new Set();
    const anotar = (clave, tipo, px, mensaje, els = []) => {
        if (vistos.has(clave) || out.length >= max || els.some(e => culpables.has(e))) return;
        vistos.add(clave); els.forEach(e => culpables.add(e)); out.push({ tipo, px: r1(px), mensaje });
    };
    const esLoader = el => {
        const id = `${el.id} ${typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''}`;
        return el.tagName === 'PROGRESS' || el.getAttribute('role') === 'progressbar' || el.getAttribute('aria-busy') === 'true'
            || /(^|[\s_-])(loader|loading|spinner|spin|progress|progressbar|skeleton|preloader|cargando|carga)([\s_-]|$)/i.test(id);
    };
    // Los fallos de alineación reales son CASI aciertos (un margin, un top, un translate mal puesto): 1-8 px.
    // Un desplazamiento grande suele ser diseño intencionado (decoración, composición asimétrica) y además se
    // ve en la captura; avisar de él sería ruido.
    const casi = (d, tam) => Math.abs(d) > tol && Math.abs(d) <= Math.min(12, Math.max(8, 0.2 * tam));
    // Un elemento que es parte de una línea de texto (hay texto suelto a su lado) no se centra solo: se ignora
    const enLineaDeTexto = el => [...(el.parentElement ? el.parentElement.childNodes : [])].some(n => n.nodeType === 3 && n.textContent.trim());
    const giraSinMoverse = a => { try { const k = a.effect.getKeyframes ? a.effect.getKeyframes() : []; const t = k.map(f => String(f.transform || '')).join(' '); return /rotate/.test(t) && !/translate|scale/.test(t); } catch { return false; } };
    const soloGira = el => { try { return el.getAnimations().some(giraSinMoverse); } catch { return false; } };
    // en movimiento = animación infinita que DESPLAZA (carrusel, marquesina); un spinner gira en su sitio y sí se mide
    const enMovimiento = el => { for (let x = el; x && x !== document.body; x = x.parentElement) { try { if (x.getAnimations().some(a => a.effect && a.effect.getComputedTiming().iterations === Infinity && !giraSinMoverse(a))) return true; } catch {} } return false; };
    const animacionInfinita = el => { try { return el.getAnimations().some(a => a.effect && a.effect.getComputedTiming().iterations === Infinity); } catch { return false; } };
    // Congelar animaciones en su estado inicial para medir posiciones estables
    const animaciones = (() => { try { return document.getAnimations(); } catch { return []; } })();
    const estado = animaciones.map(a => ({ a, play: a.playState === 'running', t: a.currentTime }));
    // Finitas (entradas, transiciones): a su estado FINAL, que es la posición de reposo. Infinitas (spinners,
    // carruseles): pausadas al inicio.
    animaciones.forEach(a => { try { const inf = a.effect && a.effect.getComputedTiming().iterations === Infinity; if (inf) { a.pause(); a.currentTime = 0; } else a.finish(); } catch {} });

    // data-geometria="ignorar" (en el elemento o un antecesor): desplazamiento INTENCIONADO, p. ej. un ajuste óptico
    // de 1 px; quien lo pone lo justifica en el devlog
    const todos = [...document.querySelectorAll('body *')].filter(el => !['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD', 'BR', 'WBR'].includes(el.tagName) && visible(el) && !el.closest('[data-geometria="ignorar"]'));

    // ---------------------------------------------------------------- 1 y 2: centrado
    for (const el of todos) {
        const p = el.parentElement;
        if (!p || p === document.documentElement) continue;
        const sp = getComputedStyle(p), se = getComputedStyle(el);
        // getComputedStyle da left en px, nunca «50%»: se compara con la mitad del bloque contenedor
        const mitad = se.position === 'absolute' && Math.abs((parseFloat(se.left) || 0) - p.clientWidth / 2) < 1;
        if (se.position === 'fixed' || (se.position === 'absolute' && !mitad)) continue;
        if (p.scrollWidth > p.clientWidth + 1 && sp.overflowX !== 'visible') continue;
        const c = caja(p), e = centro(el);
        const hermanos = [...p.children].filter(x => x !== el && visible(x) && !['absolute', 'fixed'].includes(getComputedStyle(x).position));
        const solo = hermanos.length === 0;
        const flex = sp.display.includes('flex'), grid = sp.display.includes('grid');
        const fila = flex && !sp.flexDirection.startsWith('column');
        if (enMovimiento(el) || enLineaDeTexto(el)) continue;   // carruseles/animaciones; trozos de una línea de texto
        // flex con varias líneas (wrap): el eje cruzado se centra por línea, no en todo el contenedor
        const varias = flex && sp.flexWrap !== 'nowrap' && [...p.children].some(x => x !== el && visible(x) && (fila ? Math.abs(x.getBoundingClientRect().top - el.getBoundingClientRect().top) > el.getBoundingClientRect().height / 2 : Math.abs(x.getBoundingClientRect().left - el.getBoundingClientRect().left) > el.getBoundingClientRect().width / 2));
        let ejeX = false, ejeY = false, motivo = '';
        if (flex) {
            const just = sp.justifyContent, ali = sp.alignItems, self = se.alignSelf;
            const aliEf = self && !['auto', 'normal'].includes(self) ? self : ali;
            if (fila) { if (just === 'center' && solo) { ejeX = true; motivo = 'justify-content: center'; } if (aliEf === 'center') { ejeY = true; motivo = motivo || 'align-items: center'; } }
            else { if (aliEf === 'center') { ejeX = true; motivo = 'align-items: center'; } if (just === 'center' && solo) { ejeY = true; motivo = motivo || 'justify-content: center'; } }
        } else if (grid && solo) {
            const ji = sp.justifyItems, ai = sp.alignItems, jc = sp.justifyContent, ac = sp.alignContent;
            if (/center/.test(ji) || /center/.test(jc)) { ejeX = true; motivo = 'grid centrado'; }
            if (/center/.test(ai) || /center/.test(ac)) { ejeY = true; motivo = motivo || 'grid centrado'; }
        } else if (!flex && !grid) {
            const ml = se.marginLeft, mr = se.marginRight;
            const autoM = el.style.marginLeft === 'auto' || (Math.abs(parseFloat(ml) - parseFloat(mr)) < 0.6 && parseFloat(ml) > 0.5 && se.display === 'block' && e.w < c.w - 1);
            if (autoM && solo) { ejeX = true; motivo = 'margin: auto'; }
            if (sp.textAlign === 'center' && /inline/.test(se.display) && solo) { ejeX = true; motivo = 'text-align: center'; }
            if (mitad) { ejeX = true; motivo = 'left: 50% + translate'; }
        }
        if (e.w >= c.w - 1) ejeX = false;
        if (e.h >= c.h - 1) ejeY = false;
        if (varias) { if (fila) ejeY = false; else ejeX = false; }
        if (ejeX) { const d = e.cx - c.cx; if (casi(d, e.w)) anotar('cx' + nombre(el) + Math.round(e.r.top), esLoader(el) ? 'loader-descentrado' : 'descentrado', Math.abs(d), `${nombre(el)} está ${r1(Math.abs(d))} px a la ${d > 0 ? 'derecha' : 'izquierda'} del centro de ${nombre(p)} (centro esperado x=${r1(c.cx)}, real x=${r1(e.cx)}; el contenedor centra con ${motivo}).${pista(el)}`, [el]); }
        if (ejeY) { const d = e.cy - c.cy; if (casi(d, e.h)) anotar('cy' + nombre(el) + Math.round(e.r.left), esLoader(el) ? 'loader-descentrado' : 'descentrado', Math.abs(d), `${nombre(el)} está ${r1(Math.abs(d))} px ${d > 0 ? 'por debajo' : 'por encima'} del centro vertical de ${nombre(p)} (esperado y=${r1(c.cy)}, real y=${r1(e.cy)}; ${motivo}).${pista(el)}`, [el]); }
    }

    // Loaders en capas a pantalla completa: centrados en el viewport
    const loaders = todos.filter(esLoader);
    for (const el of loaders) {
        let capa = el.parentElement;
        while (capa && capa !== document.body) {
            const s = getComputedStyle(capa), r = capa.getBoundingClientRect();
            if ((s.position === 'fixed' || s.position === 'absolute') && r.width >= vw - 2 && r.height >= vh - 2) break;
            capa = capa.parentElement;
        }
        if (!capa || capa === document.body) continue;
        // Lo que se centra en la pantalla es el GRUPO de contenido de la capa (p. ej. spinner + barra + texto), no
        // cada pieza: se mide la caja que envuelve todo lo visible de la capa. La posición de cada pieza dentro
        // del grupo ya la mide el centrado de contenedores (apartado 1).
        const piezas = [...capa.children].filter(x => visible(x) && !['absolute', 'fixed'].includes(getComputedStyle(x).position));
        if (!piezas.length) continue;
        const rs = piezas.map(x => x.getBoundingClientRect());
        const g = { cx: (Math.min(...rs.map(r => r.left)) + Math.max(...rs.map(r => r.right))) / 2, cy: (Math.min(...rs.map(r => r.top)) + Math.max(...rs.map(r => r.bottom))) / 2 };
        const desc = piezas.length > 1 ? `el grupo de carga (${piezas.length} piezas)` : `el loader ${nombre(el)}`;
        const quien = piezas.length > 1 ? null : piezas[0];
        const dx = g.cx - vw / 2, dy = g.cy - vh / 2;
        if (Math.abs(dx) > tol + 0.5) anotar('vx' + nombre(capa), 'loader-descentrado', Math.abs(dx), `En la capa a pantalla completa ${nombre(capa)}, ${desc} está ${r1(Math.abs(dx))} px a la ${dx > 0 ? 'derecha' : 'izquierda'} del centro de la pantalla.${quien ? pista(quien) : ''}`, quien ? [quien] : []);
        if (Math.abs(dy) > Math.max(tol + 0.5, 2)) anotar('vy' + nombre(capa), 'loader-descentrado', Math.abs(dy), `En la capa a pantalla completa ${nombre(capa)}, ${desc} está ${r1(Math.abs(dy))} px ${dy > 0 ? 'por debajo' : 'por encima'} del centro vertical de la pantalla.${quien ? pista(quien) : ''}`, quien ? [quien] : []);
    }
    // Loader y barra del mismo bloque: mismo eje vertical (centros x)
    for (let i = 0; i < loaders.length; i++) for (let j = i + 1; j < loaders.length; j++) {
        const a = loaders[i], b = loaders[j];
        if (a.contains(b) || b.contains(a)) continue;
        const comun = (() => { let x = a.parentElement; while (x && !x.contains(b)) x = x.parentElement; return x; })();
        if (!comun || comun === document.body) continue;
        const ca = centro(a), cb = centro(b);
        const apilados = ca.r.bottom <= cb.r.top + 1 || cb.r.bottom <= ca.r.top + 1;
        if (!apilados) continue;
        const d = Math.abs(ca.cx - cb.cx);
        // el culpable probable: el que tiene una causa visible (margin, top, transform); si no, se nombran los dos
        const culpable = pista(a) ? a : pista(b) ? b : null;
        if (d > tol && d < Math.max(ca.w, cb.w) / 2) anotar('par' + nombre(a) + nombre(b), 'loaders-desalineados', d, `${nombre(a)} y ${nombre(b)} (apilados en ${nombre(comun)}) no comparten eje: centros x=${r1(ca.cx)} y x=${r1(cb.cx)} (${r1(d)} px).${culpable ? pista(culpable) : ''}`, [a, b]);
    }

    // ---------------------------------------------------------------- 3: spinner que baila
    // solo lo que GIRA (spinner): rotate sin translate/scale, y que sea un loader o casi cuadrado
    for (const el of todos.filter(x => animacionInfinita(x) && soloGira(x) && (esLoader(x) || Math.abs(x.getBoundingClientRect().width - x.getBoundingClientRect().height) < 2))) {
        const anims = el.getAnimations();
        const dur = Math.max(...anims.map(a => a.effect.getComputedTiming().duration || 0));
        if (!dur || !isFinite(dur)) continue;
        const pts = [];
        for (const f of [0, 0.25, 0.5, 0.75]) { anims.forEach(a => { a.currentTime = dur * f; }); const c = centro(el); pts.push(c); }
        anims.forEach(a => { a.currentTime = 0; });
        const dx = Math.max(...pts.map(p => p.cx)) - Math.min(...pts.map(p => p.cx));
        const dy = Math.max(...pts.map(p => p.cy)) - Math.min(...pts.map(p => p.cy));
        const d = Math.max(dx, dy);
        if (d > tol + 0.5) anotar('baila' + nombre(el), 'spinner-baila', d, `${nombre(el)} se desplaza ${r1(d)} px mientras se anima (su centro no es fijo): revisa transform-origin (debe ser center) o que la caja sea cuadrada.`);
    }

    // ---------------------------------------------------------------- 4: dibujo del SVG descentrado
    for (const svg of todos.filter(el => el.tagName === 'svg' || el.tagName === 'SVG')) {
        try {
            const bb = svg.getBBox(); const vb = svg.viewBox && svg.viewBox.baseVal;
            if (!vb || !vb.width || !bb.width || svg.querySelector('text')) continue;
            // Dibujo que se sale de su propia caja: es a propósito (flecha que se desliza al pasar el ratón, etc.)
            if (bb.x < vb.x - 0.5 || bb.y < vb.y - 0.5 || bb.x + bb.width > vb.x + vb.width + 0.5 || bb.y + bb.height > vb.y + vb.height + 0.5) continue;
            const dx = (bb.x + bb.width / 2) - (vb.x + vb.width / 2), dy = (bb.y + bb.height / 2) - (vb.y + vb.height / 2);
            const r = svg.getBoundingClientRect(), escala = Math.min(r.width / vb.width, r.height / vb.height);
            const px = Math.max(Math.abs(dx), Math.abs(dy)) * escala;
            if (px > tol + 0.5 && (esLoader(svg) || esLoader(svg.parentElement || svg) || animacionInfinita(svg) || r.width <= 64)) anotar('svg' + nombre(svg) + Math.round(r.left), 'svg-descentrado', px, `El dibujo de ${nombre(svg)} está ${r1(px)} px descentrado dentro de su caja (viewBox ${vb.x} ${vb.y} ${vb.width} ${vb.height}, dibujo en x=${r1(bb.x)} y=${r1(bb.y)} ${r1(bb.width)}×${r1(bb.height)}): ajusta el viewBox al dibujo.`);
        } catch {}
    }

    // ---------------------------------------------------------------- 5: hermanos «casi» alineados (flex/grid)
    const padres = new Set(todos.map(el => el.parentElement).filter(Boolean));
    for (const p of padres) {
        const sp = getComputedStyle(p);
        if (!sp.display.includes('flex') && !sp.display.includes('grid')) continue;
        const hijos = [...p.children].filter(x => visible(x) && !['absolute', 'fixed'].includes(getComputedStyle(x).position));
        if (hijos.length < 2) continue;
        const R = hijos.map(h => ({ h, r: h.getBoundingClientRect() }));
        const enFila = R.every(({ r }) => Math.abs(r.top - R[0].r.top) < Math.max(12, R[0].r.height / 2) || r.top < R[0].r.bottom);
        const fila = sp.display.includes('flex') ? !sp.flexDirection.startsWith('column') && enFila : enFila;
        const ali = sp.alignItems;
        const medida = fila
            ? (ali === 'center' ? ({ r }) => (r.top + r.bottom) / 2 : ali === 'flex-end' || ali === 'end' ? ({ r }) => r.bottom : ali === 'baseline' ? null : ({ r }) => r.top)
            // en columna solo se compara si el contenedor centra: con start/stretch, 1-2 px de sangría suelen ser intencionados
            : (ali === 'center' ? ({ r }) => (r.left + r.right) / 2 : null);
        if (!medida) continue;
        // filas de un grid o flex con wrap: comparar solo dentro de la misma línea
        const lineas = [];
        for (const x of R) { const l = lineas.find(L => fila ? Math.abs(L[0].r.top - x.r.top) < L[0].r.height / 2 : true); if (l) l.push(x); else lineas.push([x]); }
        for (const L of lineas) {
            if (L.length < 2) continue;
            const vals = L.map(medida);
            const ref = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
            // Con solo dos hermanos la «mediana» no dice cuál está mal: culpable = el que tiene una causa visible
            const con2 = L.length === 2 && Math.abs(vals[0] - vals[1]) > tol && Math.abs(vals[0] - vals[1]) <= 6;
            const elegido = con2 ? (L.find(x => pista(x.h)) || null) : undefined;
            L.forEach((x, k) => {
                if (con2 && elegido && x !== elegido) return;
                const d = con2 ? vals[0] - vals[1] : vals[k] - ref;
                // un hijo con align-self propio se coloca distinto a propósito: no se compara
                const sinAlignSelfPropio = ['auto', 'normal', 'stretch', ali].includes(getComputedStyle(x.h).alignSelf);
                if (Math.abs(d) > tol && Math.abs(d) <= 6 && sinAlignSelfPropio) {
                    const quien = con2 && !elegido ? `${nombre(L[0].h)} y ${nombre(L[1].h)} están` : `${nombre(x.h)} está`;
                    anotar('her' + nombre(x.h) + Math.round(x.r.left) + Math.round(x.r.top), 'casi-alineado', Math.abs(d), `${quien} ${r1(Math.abs(d))} px fuera de línea ${con2 && !elegido ? 'entre sí' : 'respecto a sus hermanos'} en ${nombre(p)} (${fila ? 'fila' : 'columna'}, align-items: ${ali}).${pista(x.h)}`, con2 && !elegido ? L.map(y => y.h) : [x.h]);
                    if (con2) return;
                }
            });
        }
    }

    // restaurar animaciones
    estado.forEach(({ a, play, t }) => { try { a.currentTime = t; if (play) a.play(); } catch {} });
    // El mismo fallo repetido (un icono o componente que se usa 30 veces) se agrupa en un solo aviso
    const grupos = new Map();
    for (const x of out) {
        const clave = x.tipo + '|' + x.mensaje.replace(/[xy]=\d+(\.\d+)?/g, '');
        if (grupos.has(clave)) grupos.get(clave).veces++; else grupos.set(clave, { ...x, veces: 1 });
    }
    return [...grupos.values()].map(g => ({ tipo: g.tipo, px: g.px, mensaje: g.veces > 1 ? `${g.mensaje} (×${g.veces})` : g.mensaje })).sort((a, b) => b.px - a.px);
}
