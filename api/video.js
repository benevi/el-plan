// Busca en YouTube un vídeo real de una receta y lo devuelve ya comprobado.
// GET /api/video?q=lentejas+estofadas+con+verduras+receta
// Respuesta: { videos: [{ id, titulo, canal, duracion, url }], buscar } — "buscar" es el enlace a la búsqueda,
// por si no se encuentra ninguno o se quiere ver otro. No usa clave: lee la página pública de resultados.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function extraer(html) {
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s) || html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/s);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch (e) { return []; }
  const out = [];
  (function recorrer(o) {
    if (!o || typeof o !== 'object' || out.length >= 8) return;
    if (o.videoRenderer && o.videoRenderer.videoId) {
      const v = o.videoRenderer;
      const texto = x => x ? (x.simpleText || (x.runs || []).map(r => r.text).join('')) : '';
      out.push({ id: v.videoId, titulo: texto(v.title), canal: texto(v.ownerText), duracion: texto(v.lengthText) });
      return;
    }
    for (const k in o) recorrer(o[k]);
  })(data);
  return out;
}

// Duración en segundos ("12:34" → 754). Descarta directos, shorts muy cortos y vídeos de más de 40 min.
const segundos = d => (d || '').split(':').reduce((a, b) => a * 60 + (+b || 0), 0);

export default async function handler(req, res) {
  if (process.env.APP_CODE && req.headers['x-app-code'] !== process.env.APP_CODE) return res.status(401).json({ error: 'código de acceso incorrecto' });
  const q = String((req.query && req.query.q) || '').trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: 'falta la búsqueda' });
  const busqueda = /receta/i.test(q) ? q : q + ' receta';
  const buscar = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(busqueda);
  try {
    const r = await fetch(buscar + '&hl=es&gl=ES', { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } });
    if (!r.ok) throw new Error('YouTube ' + r.status);
    const lista = extraer(await r.text()).filter(v => { const s = segundos(v.duracion); return s >= 60 && s <= 2400; });
    // Comprueba que el primero existe y se puede insertar (oEmbed responde 200 solo si el vídeo es público).
    const videos = [];
    for (const v of lista.slice(0, 4)) {
      const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.id));
      if (o.ok) videos.push(Object.assign(v, { url: 'https://www.youtube.com/watch?v=' + v.id }));
      if (videos.length >= 3) break;
    }
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).json({ videos, buscar });
  } catch (e) {
    console.error('video:', e && e.message);
    return res.status(200).json({ videos: [], buscar, aviso: 'no se pudo consultar YouTube ahora' });
  }
}
