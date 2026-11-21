// PR 16 en pantalla (jsdom): Perfil (partes sin salirse, aria-current, grupos de radio, aria-pressed, textos),
// el editor de «Mis sesiones» (crear, errores junto al campo, añadir con el buscador, subir y bajar, quitar,
// editar, borrar con confirmación), Ejercicios (filtros y «Añadir a una de mis sesiones») y Progreso (vacío,
// vasos con el denominador del plan y «Ver como tabla»).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, semanaRef } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'perfil' });
after(() => a.cerrar());
const $ = s => a.doc.querySelector(s);
const $$ = s => [...a.doc.querySelectorAll(s)];
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('hoy'); await a.ir('perfil');
}
const tecla = (el, key) => el.dispatchEvent(new a.w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const grupo = async g => { a.clic(`[data-act="perfil.grupo"][data-v="${g}"]`); await a.tic(); };

test('Perfil: partes con aria-current, todas en una lista que baja de línea, y resumen con concordancia', async () => {
  const b = estadoBase();
  b.perfil.lesiones = [{ id: 'l1', zona: 'rodilla', dolor: 3, activa: true }, { id: 'l2', zona: 'lumbar', dolor: 0, activa: false }];
  await reiniciar(b);
  const partes = $$('.grupos-perfil [data-act="perfil.grupo"]');
  assert.equal(partes.length, 7);
  assert.equal(partes.filter(x => x.getAttribute('aria-current') === 'true').length, 1);
  assert.equal($('.grupos-perfil').tagName, 'NAV');
  assert.match($('.perfil-resumen').textContent, /1 lesión activa$/);
  await grupo('lesiones');
  assert.equal($('[data-act="perfil.grupo"][data-v="lesiones"]').getAttribute('aria-current'), 'true');
  assert.equal($('[data-act="perfil.grupo"][data-v="objetivos"]').hasAttribute('aria-current'), false);
  assert.match(a.vista().textContent, /Rodilla/);
  assert.match(a.vista().textContent, /Dolor 3 de 10/);
  for (const g of ['objetivos', 'lesiones', 'salud', 'entreno', 'datos', 'copias', 'ajustes']) { await grupo(g); assert.ok(!a.pantallaRota(), g); }
});

test('Perfil: nivel, minutos y uso de la IA son grupos de radio; objetivos y lugares, chips con aria-pressed', async () => {
  await reiniciar(estadoBase());
  await grupo('objetivos');
  const nivel = $('[role="radiogroup"][aria-label="Nivel"]');
  assert.ok(nivel);
  const radios = [...nivel.querySelectorAll('[role="radio"]')];
  assert.deepEqual(radios.map(r => r.getAttribute('aria-checked')), ['true', 'false', 'false']);
  assert.deepEqual(radios.map(r => r.tabIndex), [0, -1, -1]);
  assert.equal($('[data-act="perfil.objetivo"][data-v="musculo"]').getAttribute('aria-pressed'), 'true');
  // Con las flechas cambia el nivel y el foco se queda en el elegido
  radios[0].focus();
  tecla(radios[0], 'ArrowRight'); await a.tic();
  assert.equal(a.estado.estado().perfil.nivel, 2);
  assert.equal(a.doc.activeElement, $('[data-act="perfil.nivel"][data-v="2"]'));
  await grupo('entreno');
  assert.ok($('[role="radiogroup"][aria-label="Minutos por sesión"] [aria-checked="true"][data-v="60"]'));
  assert.ok($('[role="radiogroup"][aria-label="Uso del entrenador IA"]'));
  assert.equal($('[data-act="perfil.lugar"][data-v="gym"]').getAttribute('aria-pressed'), 'true');
  // Días por semana: selector ± (spinbutton) con flechas e Inicio/Fin
  const dias = $('#p-dias');
  assert.equal(dias.getAttribute('role'), 'spinbutton');
  dias.focus(); tecla(dias, 'ArrowUp'); await a.tic();
  assert.equal(a.estado.estado().perfil.disponibilidad.dias, 4);
  assert.equal(a.doc.activeElement, $('#p-dias'), 'el foco sigue en el selector tras repintar');
  tecla($('#p-dias'), 'End'); await a.tic();
  assert.equal(a.estado.estado().perfil.disponibilidad.dias, 7);
  assert.equal($('#p-dias').getAttribute('aria-valuetext'), '7 días por semana');
  assert.equal($('#p-dias').closest('[data-selector]').querySelector('[data-paso="1"]').getAttribute('aria-disabled'), 'true');
});

test('Ajustes: ayuda del código sin jerga, aviso de datos de salud en la copia y versión visible', async () => {
  await reiniciar(estadoBase());
  await grupo('ajustes');
  const v = a.vista().textContent;
  assert.match(v, /El mismo que te ha dado Víctor para usar el entrenador IA/);
  assert.doesNotMatch(v, /APP_CODE|Vercel/);
  assert.match($('.aviso-salud').textContent, /Lleva tus datos de salud/);
  assert.ok($('[data-version-app]'));
  // Cada campo con su etiqueta
  assert.equal($('label[for="a-codigo"]').textContent, 'Código de acceso a la IA');
  await grupo('datos');
  for (const id of ['d-sexo', 'd-altura', 'd-nac', 'd-notas']) assert.ok($(`label[for="${id}"]`), id);
});

test('editor de Mis sesiones: crear, errores junto al campo, añadir, subir, bajar, quitar y guardar', async () => {
  const b = estadoBase(); b.perfil.lugares = ['casa']; b.perfil.nivel = 2;
  await reiniciar(b);
  await grupo('entreno');
  assert.match($('.mis-sesiones').textContent, /0 de 30/);
  a.clic('[data-act="perfil.crearMia"]'); await a.esperar(() => a.w.location.hash === '#mia/nueva');
  await a.tic();
  assert.equal($('#vista h1').textContent, 'Nueva sesión');
  assert.equal($('[data-act="mia.lugar"][aria-checked="true"]').dataset.v, 'casa');
  a.clic('[data-act="mia.guardar"]'); await a.tic();
  assert.match($('#mia-nombre-error').textContent, /Ponle un nombre/);
  assert.equal($('#mia-nombre').getAttribute('aria-invalid'), 'true');
  assert.equal(a.doc.activeElement, $('#mia-nombre'));
  // Al escribir, el error se va sin esperar a guardar
  $('#mia-nombre').value = 'Abdos'; $('#mia-nombre').dispatchEvent(new a.w.Event('input', { bubbles: true }));
  assert.equal($('#mia-nombre-error'), null);
  // Añadir con el buscador (filtro de lugar puesto en el de la sesión)
  a.clic('[data-act="mia.buscar"]'); await a.esperar(() => $('.hoja #mia-buscar'));
  assert.equal($('.hoja [data-act="mia.filtro"][data-k="lugar"][data-v="casa"]').getAttribute('aria-pressed'), 'true');
  a.clic('.hoja [data-act="mia.filtro"][data-k="musculo"][data-v="core"]');
  assert.equal($('.hoja [data-act="mia.filtro"][data-k="musculo"][data-v="core"]').getAttribute('aria-pressed'), 'true');
  assert.ok($$('.hoja [data-act="mia.anadir"]').length > 3);
  for (const id of ['crunch', 'plancha']) a.clic(`.hoja [data-act="mia.anadir"][data-id="${id}"]`);
  a.clic('.hoja [data-act="mia.filtro"][data-k="musculo"][data-v=""]');
  a.clic('.hoja [data-act="mia.anadir"][data-id="flexiones"]');
  assert.equal($('.hoja [data-act="mia.anadir"][data-id="flexiones"]').getAttribute('aria-disabled'), 'true');
  assert.match($('.hoja .meta-lista').textContent, /3 en la sesión/);
  a.clic('[data-act="mia.listo"]'); await a.espera(60);
  const orden = () => $$('.mia-ej').map(x => x.dataset.ej);
  assert.deepEqual(orden(), ['crunch', 'plancha', 'flexiones']);
  // La propuesta respeta el tope de D-B (intermedio: 4)
  assert.equal($('[id="mia-crunch-series"]').getAttribute('aria-valuemax'), '4');
  assert.equal($('[id="mia-plancha-reps-et"]').textContent, 'Tiempo');
  // Subir y bajar (con aria-disabled en los extremos)
  assert.equal($('[data-act="mia.subir"][data-id="crunch"]').getAttribute('aria-disabled'), 'true');
  a.clic('[data-act="mia.subir"][data-id="flexiones"]'); await a.tic();
  a.clic('[data-act="mia.subir"][data-id="flexiones"]'); await a.tic();
  assert.deepEqual(orden(), ['flexiones', 'crunch', 'plancha']);
  a.clic('[data-act="mia.subir"][data-id="flexiones"]'); await a.tic(); // ya arriba: no hace nada
  assert.deepEqual(orden(), ['flexiones', 'crunch', 'plancha']);
  a.clic('[data-act="mia.bajar"][data-id="crunch"]'); await a.tic();
  assert.deepEqual(orden(), ['flexiones', 'plancha', 'crunch']);
  // Quitar: el foco pasa al siguiente
  a.clic('[data-act="mia.quitar"][data-id="plancha"]'); await a.tic();
  assert.deepEqual(orden(), ['flexiones', 'crunch']);
  assert.equal(a.doc.activeElement, $('[data-act="mia.quitar"][data-id="crunch"]'));
  // Series de las flexiones con el botón + y con la flecha (no pasa de 4)
  const spin = () => $('[id="mia-flexiones-series"]');
  const antes = +spin().getAttribute('aria-valuenow');
  tecla(spin(), 'End'); await a.tic();
  assert.equal(spin().getAttribute('aria-valuenow'), '4');
  tecla(spin(), 'ArrowUp'); await a.tic();
  assert.equal(spin().getAttribute('aria-valuenow'), '4');
  assert.ok(antes <= 4);
  a.clic('[data-act="mia.guardar"]'); await a.esperar(() => a.w.location.hash === '#perfil');
  const [m] = a.estado.estado().misSesiones;
  assert.equal(m.nombre, 'Abdos');
  assert.equal(m.lugar, 'casa');
  assert.deepEqual(m.ejercicios.map(x => [x.id, x.series]), [['flexiones', 4], ['crunch', m.ejercicios[1].series]]);
  await a.tic();
  assert.equal($('[data-act="perfil.grupo"][data-v="entreno"]').getAttribute('aria-current'), 'true');
  assert.match($('.mis-sesiones').textContent, /Abdos/);
  assert.match($('.mis-sesiones').textContent, /1 de 30/);
  assert.match($('[data-act="perfil.editarMia"]').textContent, /Editar «Abdos»/);
});

test('editor: editar conserva el id; borrar pide confirmación nombrándola', async () => {
  const b = estadoBase(); b.perfil.lugares = ['casa'];
  b.misSesiones = [{ id: 'm1', nombre: 'Abdos', lugar: 'casa', minutos: 30, creada: '2026-11-01T10:00:00.000Z', ejercicios: [
    { id: 'flexiones-rodillas', rol: 'principal', series: 3, reps: '8-12', descanso: 60 }, { id: 'dead-bug', rol: 'principal', series: 3, reps: '10 c/lado', descanso: 45 }] }];
  await reiniciar(b);
  await grupo('entreno');
  a.clic('[data-act="perfil.editarMia"][data-id="m1"]'); await a.esperar(() => a.w.location.hash === '#mia/m1');
  await a.tic();
  assert.equal($('#vista h1').textContent, 'Editar sesión');
  assert.equal($('#mia-nombre').value, 'Abdos');
  // «10 c/lado»: la escala conserva el lado
  assert.match($('[id="mia-dead-bug-reps"]').getAttribute('aria-valuetext'), /10 repeticiones por lado/);
  $('#mia-nombre').value = 'Core en casa'; $('#mia-nombre').dispatchEvent(new a.w.Event('input', { bubbles: true }));
  a.clic('[data-act="mia.guardar"]'); await a.esperar(() => a.w.location.hash === '#perfil');
  assert.equal(a.estado.estado().misSesiones[0].id, 'm1');
  assert.equal(a.estado.estado().misSesiones[0].nombre, 'Core en casa');
  await a.tic();
  a.clic('[data-act="perfil.editarMia"][data-id="m1"]'); await a.esperar(() => a.w.location.hash === '#mia/m1');
  await a.tic();
  a.clic('[data-act="mia.borrar"]'); await a.esperar(() => $('.hoja [data-r="1"]'));
  assert.match($('.hoja').textContent, /¿Borrar «Core en casa» de tus sesiones\?/);
  assert.equal($('.hoja [data-r="1"]').textContent, 'Borrar «Core en casa»');
  a.clic('.hoja [data-r="1"]'); await a.esperar(() => a.w.location.hash === '#perfil');
  assert.equal((a.estado.estado().misSesiones || []).length, 0);
});

test('Ejercicios: filtros con aria-pressed sin perder el foco, búsqueda y «Añadir a una de mis sesiones»', async () => {
  const b = estadoBase(); b.perfil.lugares = ['casa'];
  b.misSesiones = [{ id: 'm1', nombre: 'Abdos', lugar: 'casa', minutos: 30, creada: '2026-11-01T10:00:00.000Z', ejercicios: [{ id: 'crunch', rol: 'principal', series: 3, reps: '15-20', descanso: 45 }] }];
  await reiniciar(b);
  await a.ir('ejercicios');
  const total = $$('[data-act="ejercicios.ficha"]').length;
  const piscina = $('[data-act="ejercicios.filtro"][data-k="lugar"][data-v="piscina"]');
  piscina.focus(); a.clic(piscina); await a.tic();
  assert.equal(a.doc.activeElement, piscina, 'el foco sigue en el chip');
  assert.equal(piscina.getAttribute('aria-pressed'), 'true');
  assert.equal($('[data-act="ejercicios.filtro"][data-k="lugar"][data-v=""]').getAttribute('aria-pressed'), 'false');
  assert.ok($$('[data-act="ejercicios.ficha"]').length < total);
  assert.match($('.meta-lista').textContent, /^\d+ ejercicios$/);
  a.clic('[data-act="ejercicios.filtro"][data-k="lugar"][data-v=""]');
  // La ficha: valoración con chips y el atajo a Mis sesiones
  a.clic('[data-act="ejercicios.ficha"][data-id="plancha"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.equal($$('.hoja [data-act="ejercicios.gustoFicha"]').length, 3);
  assert.ok($$('.hoja [data-act="ejercicios.gustoFicha"]').every(x => x.getAttribute('aria-pressed') === 'false'));
  a.clic('.hoja [data-act="ejercicios.aMia"]'); await a.esperar(() => $('.hoja [data-act="ejercicios.aMiaOk"]'));
  a.clic('.hoja [data-act="ejercicios.aMiaOk"][data-mia="m1"]'); await a.espera(60);
  assert.deepEqual(a.estado.estado().misSesiones[0].ejercicios.map(x => x.id), ['crunch', 'plancha']);
  assert.match($('#aviso').textContent, /Añadido a «Abdos»/);
  // Otra vez: ya lo tiene
  a.clic('[data-act="ejercicios.ficha"][data-id="plancha"]'); await a.esperar(() => $('.hoja .ficha'));
  a.clic('.hoja [data-act="ejercicios.aMia"]'); await a.esperar(() => $('.hoja [data-act="ejercicios.aMiaOk"]'));
  assert.equal($('.hoja [data-act="ejercicios.aMiaOk"][data-mia="m1"]').getAttribute('aria-disabled'), 'true');
  // Nueva desde la ficha: el editor empieza con ese ejercicio
  a.clic('.hoja [data-act="ejercicios.aMiaNueva"]'); await a.esperar(() => a.w.location.hash === '#mia/nueva');
  await a.tic();
  assert.deepEqual($$('.mia-ej').map(x => x.dataset.ej), ['plancha']);
  a.clic('[data-act="mia.volver"]'); await a.esperar(() => a.w.location.hash === '#perfil');
});

test('Progreso: vacío con sus dos acciones; con datos, vasos con el denominador del plan y «Ver como tabla»', async () => {
  await reiniciar(estadoBase());
  await a.ir('progreso');
  assert.match(a.vista().textContent, /Tu progreso empieza con tu primera sesión/);
  assert.ok($('#vista a.boton[href="#hoy"]'));
  assert.ok($('#vista [data-act="progreso.medida"]'));
  // Con sesiones de varias semanas y un plan de 4 días esta semana (1 hecho)
  const b = estadoBase();
  const hoy = new Date(), hace = n => { const d = new Date(hoy); d.setDate(d.getDate() - n); return d; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (let k = 0; k < 20; k++) {
    const d = hace(3 + k * 3), id = 's' + k;
    b.sesiones[id] = { id, fecha: iso(d), creada: d.toISOString(), fuente: 'reglas', nombre: 'Torso', lugar: 'gym', minutos: 50, estado: 'hecha', terminada: d.toISOString(), empezada: d.toISOString(), checkin: null, cierre: { esfuerzo: 3, dolor: {}, comentario: '' }, calentamiento: [], vuelta: [],
      ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 1, reps: '8-12', descanso: 90, sets: [{ kg: 40 + (20 - k), valor: '10', hecha: true }], comentario: '' }] };
  }
  const ds = new Date().getDay() || 7;
  b.plan = { semana: semanaRef(new Date()), creado: new Date().toISOString(), fuente: 'reglas', resumen: '', criterios: '', progresion: '', hechos: {},
    dias: [1, 2, 3, 4].map(n => ({ diaSemana: ((ds + n) % 7) + 1, nombre: 'Día ' + n, foco: '', lugar: 'gym', minutos: 60, tipo: 'fullA', explicacion: [], calentamiento: [], ejercicios: [], vuelta: [] })) };
  b.medidas = [{ fecha: iso(hace(30)), peso: 80, cintura: 90 }, { fecha: iso(hace(2)), peso: 79, cintura: 89 }];
  await reiniciar(b);
  await a.ir('progreso');
  const vasos = $$('.vasos .vaso');
  assert.equal(vasos.length, 8);
  assert.match(vasos[7].getAttribute('aria-label'), /\(esta\): \d de 4 sesiones/);
  const tablas = $$('.ver-tabla');
  assert.ok(tablas.length >= 3, 'cada gráfico con su tabla');
  assert.equal(tablas[0].querySelectorAll('tbody tr').length, 8);
  // Los gráficos son una parada de Tab con nombre, y las flechas recorren los puntos
  const svg = $('.grafico svg[tabindex="0"]');
  assert.match(svg.getAttribute('aria-label'), /Flechas para recorrer/);
  tecla(svg, 'End'); await a.tic();
  assert.ok(!svg.closest('.grafico').querySelector('.burbuja').hidden);
  assert.match(svg.closest('.grafico').querySelector('[aria-live]').textContent, /:/);
  assert.match(a.vista().textContent, /Fuerza/);
  assert.match(a.vista().textContent, /Cintura \/ altura/);
});
