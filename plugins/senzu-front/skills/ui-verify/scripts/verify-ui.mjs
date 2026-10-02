#!/usr/bin/env node
/**
 * Senzu · ui-verify: verificación automática de una URL en 375/768/1440.
 *
 * Uso:  node verify-ui.mjs <url> [--viewports 375,768,1440] [--out senzu/ui-verify] [--no-screenshots]
 * Requiere Playwright en el proyecto:  npm i -D playwright && npx playwright install chromium
 *
 * Comprueba por viewport: scroll horizontal (y qué elementos lo causan), errores de consola,
 * meta viewport, nº de h1, imágenes sin alt/dimensiones, tap targets < 44px (solo móvil),
 * texto < 12px, inputs sin label, y GEOMETRÍA en píxeles (geometria.mjs): centrado real de lo que el
 * contenedor centra, loaders centrados y alineados entre sí, spinners que se desplazan al girar, dibujos de
 * SVG descentrados en su caja y hermanos «casi» alineados. En MÓVIL (movil.mjs): contenido solo con hover, campos
 * < 16 px, fijos que tapan, fondos fijos, cursor propio, título que se come la pantalla, sin movimiento reducido,
 * navegación que no cabe, y el menú burger usado de verdad: lo pulsa, mide el menú abierto, lo captura y prueba
 * Escape. Capturas: <out>/<ancho>.png, <ancho>-anotada.png (cada aviso numerado sobre su elemento) y <ancho>-menu.png.
 * --tolerancia <px> (por defecto 1).
 * Sale con código 1 si hay problemas (para CI y para que el agente no pueda ignorarlo).
 */
const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('Uso: node verify-ui.mjs <url> [--viewports 375,768,1440] [--out senzu/ui-verify]');
  process.exit(2);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const viewports = opt('viewports', '375,768,1440').split(',').map((v) => parseInt(v, 10));
const { existsSync: existeRuta } = await import('node:fs');
// senzu/ui-verify; .ui-verify en proyectos antiguos sin migrar
const outDir = opt('out', existeRuta('senzu') && !existeRuta('.ui-verify') ? 'senzu/ui-verify' : '.ui-verify');
const screenshots = !args.includes('--no-screenshots');
const tolerancia = parseFloat(opt('tolerancia', '1')) || 1;
const { auditarGeometria } = await import('./geometria.mjs');
const { auditarMovil, resumenMovil, buscarMenu, estadoMenu, marcarAvisos } = await import('./movil.mjs');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('[ui-verify] Falta Playwright. Instala en el proyecto:');
  console.error('  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

// Auditoría que corre DENTRO de la página. mobile=true añade checks táctiles.
const audit = (mobile) => {
  const problems = [];
  const vw = window.innerWidth;
  const doc = document.scrollingElement || document.documentElement;

  if (doc.scrollWidth > vw + 1) {
    problems.push(`SCROLL HORIZONTAL: contenido de ${doc.scrollWidth}px en viewport de ${vw}px`);
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && (r.right > vw + 1 || r.left < -1) && offenders.length < 5) {
        const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : '';
        offenders.push(`<${el.tagName.toLowerCase()}${cls}> (left ${Math.round(r.left)}, right ${Math.round(r.right)})`);
      }
    });
    if (offenders.length) problems.push(`  culpables: ${offenders.join(' · ')}`);
  }

  if (!document.querySelector('meta[name="viewport"]')) problems.push('Falta <meta name="viewport">');

  const h1s = document.querySelectorAll('h1').length;
  if (h1s !== 1) problems.push(`Hay ${h1s} <h1> (debe haber exactamente 1)`);

  const noAlt = [...document.querySelectorAll('img:not([alt])')].length;
  if (noAlt) problems.push(`${noAlt} <img> sin atributo alt`);
  const noDims = [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('width') && !i.style.aspectRatio && !getComputedStyle(i).aspectRatio.match(/\d/)).length;
  if (noDims) problems.push(`${noDims} <img> sin width/height ni aspect-ratio (riesgo de CLS)`);

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };

  if (mobile) {
    const small = [...document.querySelectorAll('a,button,[role="button"],input[type="checkbox"],input[type="radio"]')]
      .filter(visible)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (r.width < 44 || r.height < 44) && !(r.width >= 44 && el.closest('p,li,td')); // enlaces en línea de texto se toleran
      });
    if (small.length) {
      const sample = small.slice(0, 4).map((el) => `"${(el.textContent || el.ariaLabel || el.tagName).trim().slice(0, 24)}"`).join(', ');
      problems.push(`${small.length} tap targets < 44px en móvil (p. ej. ${sample})`);
    }
  }

  const broken = [...document.querySelectorAll('a,button,[role="button"],h1,h2,h3,label,th')]
    .filter(visible)
    .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).textOverflow !== 'ellipsis');
  if (broken.length) {
    const sample = broken.slice(0, 4).map((el) => `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 24)}"`).join(', ');
    problems.push(`${broken.length} elementos con texto que DESBORDA su caja (botones/títulos rotos): ${sample}`);
  }

  const tiny = [...document.querySelectorAll('p,span,a,li,label,td,dt,dd')]
    .filter(visible)
    .filter((el) => el.textContent.trim().length > 2 && parseFloat(getComputedStyle(el).fontSize) < 12).length;
  if (tiny) problems.push(`${tiny} elementos de texto < 12px`);

  const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]),select,textarea')]
    .filter(visible)
    .filter((el) => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length;
  if (unlabeled) problems.push(`${unlabeled} campos de formulario sin label ni aria-label`);

  return problems;
};

const browser = await chromium.launch();
let totalProblems = 0;
try {
  const { mkdirSync, existsSync, writeFileSync } = await import('node:fs');
  if (screenshots) {
    mkdirSync(outDir, { recursive: true });
    // Las capturas son evidencia local: nunca deben acabar en un commit
    if (!existsSync(`${outDir}/.gitignore`)) writeFileSync(`${outDir}/.gitignore`, '*\n');
  }

  for (const width of viewports) {
    const mobile = width < 500;
    const page = await browser.newPage({ viewport: { width, height: mobile ? 720 : 900 } });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.error(`\n== ${width}px ==\n  FALLO al cargar ${url}: ${String(e).slice(0, 160)}`);
      totalProblems++;
      await page.close();
      continue;
    }
    await page.waitForTimeout(600); // fuentes/animaciones de entrada
    // scroll hasta el fondo y vuelta: dispara lazy load y efectos, y destapa overflows tardíos
    await page.evaluate(async () => {
      const d = document.scrollingElement;
      for (let y = 0; y <= d.scrollHeight; y += window.innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    const problems = await page.evaluate(audit, mobile);
    // Geometría medida en píxeles (no a ojo): centrado, loaders, spinners, SVG y alineación entre hermanos
    const geo = await page.evaluate(auditarGeometria, { tolerancia });
    problems.push(...geo.map((g) => `${g.marca ? `[${g.marca}] ` : ''}GEOMETRÍA (${g.tipo}, ${g.px} px): ${g.mensaje}`));
    let resumen = [], menuCaptura = null;
    if (mobile) {
      // Móvil pensado como móvil: táctil, sin hover, tamaños reales y el menú usado de verdad
      const mov = await page.evaluate(auditarMovil);
      problems.push(...mov.map((m) => `${m.marca ? `[${m.marca}] ` : ''}MÓVIL (${m.tipo}): ${m.mensaje}`));
      resumen = await page.evaluate(resumenMovil);
      const menu = await page.evaluate(buscarMenu);
      problems.push(...menu.problemas.map((p) => `[menú] MENÚ: ${p}`));
      if (menu.encontrado) {
        try {
          await page.click('[data-senzu-menu]', { timeout: 3000 });
          await page.waitForTimeout(500); // transición de apertura
          const abierto = await page.evaluate(estadoMenu, true);
          problems.push(...abierto.problemas.map((p) => `MENÚ: ${p}`));
          if (abierto.enlaces) resumen.push(`menú abierto: ${abierto.enlaces} enlaces visibles`);
          if (screenshots) { menuCaptura = `${outDir}/${width}-menu.png`; await page.screenshot({ path: menuCaptura }); }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
          const cerrado = await page.evaluate(estadoMenu, false);
          problems.push(...cerrado.problemas.map((p) => `MENÚ: ${p}`));
          // si Escape no lo cerró, se cierra con el botón para que la captura final sea la de la página
          if (cerrado.problemas.length) { await page.click('[data-senzu-menu]', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
        } catch (e) {
          problems.push(`MENÚ: no se pudo pulsar el botón del menú (${String(e).split('\n')[0].slice(0, 100)}): ¿lo tapa otro elemento?`);
        }
      }
    }
    const marcados = screenshots ? await page.evaluate(marcarAvisos) : 0;
    const uniqueConsole = [...new Set(consoleErrors)].slice(0, 6);
    if (uniqueConsole.length) problems.push(...uniqueConsole.map((e) => `Consola: ${e}`));

    console.log(`\n== ${width}px ${mobile ? '(MÓVIL — lo primero que hay que mirar)' : ''} ==`);
    if (problems.length) {
      problems.forEach((p) => console.log(`  ✗ ${p}`));
      totalProblems += problems.length;
    } else {
      console.log('  ✓ sin problemas detectados');
    }
    if (resumen.length) console.log(`  tamaños: ${resumen.join(' · ')}`);
    if (screenshots) {
      const path = `${outDir}/${width}.png`;
      // primero la limpia, luego la anotada (recuadro y número de cada aviso sobre su elemento)
      await page.evaluate(() => { const c = document.getElementById('senzu-anotaciones'); if (c) c.style.display = 'none'; });
      await page.screenshot({ path, fullPage: true });
      console.log(`  captura: ${path}`);
      if (marcados) {
        await page.evaluate(() => { document.getElementById('senzu-anotaciones').style.display = ''; });
        await page.screenshot({ path: `${outDir}/${width}-anotada.png`, fullPage: true });
        console.log(`  anotada: ${outDir}/${width}-anotada.png (${marcados} elemento(s) con el número de su aviso)`);
      }
      if (menuCaptura) console.log(`  menú abierto: ${menuCaptura}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n[ui-verify] Problemas: ${totalProblems}`);
if (totalProblems) {
  console.log('Esto NO sustituye mirar las capturas: abre las ANOTADAS (cada [número] es un aviso de la lista) y la del');
  console.log('menú abierto, y revisa jerarquía, espaciados, tamaños y dark mode. Cifra + imagen: cada aviso se confirma mirándolo.');
  process.exit(1);
}
process.exit(0);
