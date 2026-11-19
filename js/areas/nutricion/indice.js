// Área NUTRICIÓN (pendiente, la construye su hilo). Lo único compartido entre los dos móviles.
//
// Contrato previsto:
// - Pantalla en #nutricion con su pestaña: pestaña({ ruta: 'nutricion', nombre: 'Comida', icono: ICONOS.nutricion, orden: 25 })
// - Datos locales en estado().nutricion (caché sin conexión); lo compartido va por un backend pequeño
//   (Supabase) a través de funciones en /api/nutricion*.js, nunca con claves en el móvil.
// - Puede leer el perfil (objetivos, datos, medidas) y el plan de la semana para ajustar menús.
//
// No se registra ninguna pantalla hasta que tenga función real.
export {};
