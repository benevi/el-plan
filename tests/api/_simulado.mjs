// Petición, respuesta y cliente de Anthropic simulados para probar api/entrenador.js sin red.
import { EventEmitter } from 'node:events';

export class Respuesta extends EventEmitter {
  constructor() { super(); this.codigo = null; this.cuerpo = undefined; this.cabeceras = {}; this.writableFinished = false; this.writableEnded = false; this.destroyed = false; }
  setHeader(k, v) { this.cabeceras[k.toLowerCase()] = v; return this; }
  status(c) { this.codigo = c; return this; }
  json(b) {
    this.cuerpo = JSON.parse(JSON.stringify(b));
    this.writableEnded = this.writableFinished = true;
    this.emit('finish'); this.emit('close'); // como en Node: «close» también llega al terminar bien
    return this;
  }
  // Respuesta binaria (p. ej. api/copia.js al bajar una copia).
  end(b) {
    this.bytes = b == null ? Buffer.alloc(0) : Buffer.from(b);
    this.writableEnded = this.writableFinished = true;
    this.emit('finish'); this.emit('close');
    return this;
  }
  // Respuesta en vivo (text/event-stream): cada write() se guarda; eventos() los devuelve ya leídos.
  write(trozo) { if (this.writableEnded || this.destroyed) throw new Error('escritura tras cerrar'); (this.trozos ||= []).push(String(trozo)); return true; }
  flushHeaders() { this.cabecerasEnviadas = true; }
  eventos() { return (this.trozos || []).join('').split('\n\n').filter(Boolean).map(b => JSON.parse(b.replace(/^data: /, ''))); }
  // El móvil se va antes de que respondamos.
  cortar() { this.destroyed = true; this.emit('close'); }
}

// Como en Node: complete = cuerpo leído entero; socket.destroyed = el móvil se ha ido.
export class Peticion extends EventEmitter {
  constructor(method, headers, body) { super(); this.method = method; this.headers = headers; this.body = body; this.complete = true; this.socket = { destroyed: false }; }
}

export function peticion({ metodo = 'POST', codigo = 'secreto', tipo = 'application/json', cuerpo = {}, cabeceras = {} } = {}) {
  const h = { ...cabeceras };
  if (tipo) h['content-type'] = tipo;
  if (codigo != null) h['x-app-code'] = codigo;
  if (cuerpo !== undefined && h['content-length'] == null) h['content-length'] = String(Buffer.byteLength(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)));
  return new Peticion(metodo, h, cuerpo);
}

export function mensaje(datos, extra = {}) {
  return {
    id: 'msg_prueba', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn',
    usage: { input_tokens: 1234, output_tokens: 567 },
    content: [{ type: 'text', text: typeof datos === 'string' ? datos : JSON.stringify(datos) }],
    ...extra,
  };
}

// responder: (params, opciones) => mensaje | Promise<mensaje> | lanza.
export function clienteSimulado(responder) {
  const llamadas = [];
  return {
    llamadas,
    beta: { messages: { stream(params, opciones = {}) {
      llamadas.push({ params, opciones });
      return { finalMessage: async () => responder(params, opciones) };
    } } },
  };
}

// Cliente simulado con stream de verdad: guion(emitir, signal) recibe una función para mandar eventos del
// stream de Claude (como «streamEvent» del SDK) y devuelve el mensaje final (o lanza). Si la señal se aborta,
// finalMessage rechaza como el SDK (APIUserAbortError), aunque el guion siga colgado.
export function clienteEnVivo(guion, ErrorAborto) {
  const llamadas = [];
  return {
    llamadas,
    beta: { messages: { stream(params, opciones = {}) {
      const oyentes = {};
      llamadas.push({ params, opciones });
      const emitir = ev => (oyentes.streamEvent || []).forEach(f => f(ev, {}));
      const resultado = new Promise((resolver, rechazar) => {
        const s = opciones.signal;
        if (s) s.addEventListener('abort', () => rechazar(new ErrorAborto()), { once: true });
        Promise.resolve().then(() => { (oyentes.connect || []).forEach(f => f()); return guion(emitir, s); }).then(resolver, rechazar);
      });
      return { on(ev, f) { (oyentes[ev] ||= []).push(f); return this; }, finalMessage: () => resultado };
    } } },
  };
}
export const espera = ms => new Promise(r => setTimeout(r, ms));
export const delta = text => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
