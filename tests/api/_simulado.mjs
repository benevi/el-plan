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
