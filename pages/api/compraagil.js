// pages/api/compraagil.js
// Consulta las COMPRAS ÁGILES de transporte publicadas en Biobío (región 8)
// y Ñuble (región 16). Compra Ágil son compras bajo 100 UTM, más rápidas y
// con menos requisitos: el terreno ideal para un microempresario.
//
// OJO: la API de Compra Ágil es distinta a la de licitaciones:
//  - Servidor: https://api2.mercadopublico.cl
//  - El ticket va en la CABECERA (header), no en la URL
//  - La región se filtra con códigos numéricos (Biobío=8, Ñuble=16)

import { contieneTransporte, calcularUrgencia, diasRestantes } from '../../lib/filtros';

export const config = { maxDuration: 30 };

const BASE = 'https://api2.mercadopublico.cl';
// La documentación oficial usa ambas variantes; probamos las dos.
const RUTAS = ['/v2/compra-agil', '/v2/compraagil'];

// Trae una página de resultados probando ambas rutas posibles
async function traerPagina(ticket, regiones, pagina) {
  let ultimoError = null;
  for (const ruta of RUTAS) {
    const url = `${BASE}${ruta}?${regiones}estado=publicada&tamano_pagina=50&numero_pagina=${pagina}&ordenar_por=FechaPublicacion`;
    try {
      const resp = await fetch(url, { headers: { ticket } });
      if (resp.status === 404) {
        // Esta ruta no existe; probamos la otra
        ultimoError = { status: 404, ruta, cuerpo: '' };
        continue;
      }
      const texto = await resp.text();
      if (!resp.ok) {
        ultimoError = { status: resp.status, ruta, cuerpo: texto.slice(0, 300) };
        // 401/403/429 no se arreglan cambiando de ruta: cortamos
        if ([401, 403, 429].includes(resp.status)) break;
        continue;
      }
      let datos;
      try { datos = JSON.parse(texto); }
      catch { ultimoError = { status: resp.status, ruta, cuerpo: 'Respuesta no es JSON: ' + texto.slice(0, 200) }; continue; }
      return { ok: true, datos };
    } catch (e) {
      ultimoError = { status: 'fetch_error', ruta, cuerpo: e.message };
    }
  }
  return { ok: false, error: ultimoError };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo se aceptan peticiones GET' });
  }

  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  if (!ticket || ticket === 'AQUI-VA-TU-TICKET-DE-MERCADO-PUBLICO') {
    return res.status(500).json({ error: 'Falta configurar el ticket de Mercado Público.' });
  }

  const { soloRegion } = req.query;
  const regiones = soloRegion === 'false' ? '' : 'region=8,16&';

  try {
    const items = [];
    let pagina = 1;
    let totalPaginas = 1;
    const MAX_PAGINAS = 10;

    do {
      const resultado = await traerPagina(ticket, regiones, pagina);

      if (!resultado.ok) {
        const e = resultado.error || {};
        let pista = '';
        if (e.status === 401 || e.status === 403) {
          pista = ' Tu ticket no fue aceptado por la API de Compra Ágil (que es un servidor distinto). Verifica que el ticket esté bien pegado.';
        } else if (e.status === 404) {
          pista = ' Ninguna de las dos rutas conocidas respondió. Puede que la API haya cambiado de dirección.';
        } else if (e.status === 429) {
          pista = ' Se alcanzó el límite diario de consultas. Intenta mañana.';
        }
        return res.status(502).json({
          error: 'No se pudo consultar la API de Compra Ágil.',
          detalle: `Código ${e.status} en ruta ${e.ruta || '?'}.${pista} Respuesta: ${e.cuerpo || '(vacía)'}`,
        });
      }

      const datos = resultado.datos;
      if (datos.success && datos.success !== 'OK') {
        const msg = datos.errors && datos.errors[0] ? datos.errors[0].mensaje : 'respuesta NOK';
        return res.status(502).json({
          error: 'La API de Compra Ágil devolvió un error.',
          detalle: msg,
        });
      }

      const payload = datos.payload || {};
      const lote = payload.items || [];
      items.push(...lote);

      const pag = payload.paginacion || {};
      totalPaginas = pag.total_paginas || 1;
      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= MAX_PAGINAS);

    const transporte = items.filter(it => contieneTransporte(it.nombre || ''));

    const oportunidades = transporte.map(it => {
      const fechaCierre = it.fechas?.fecha_cierre || null;
      const dias = diasRestantes(fechaCierre);
      return {
        codigo: it.codigo || '',
        nombre: it.nombre || 'Sin nombre',
        organismo: it.institucion?.organismo_comprador || 'No especificado',
        region: it.institucion?.nombre_region || '',
        estado: it.estado?.glosa || it.estado?.codigo || '',
        montoDisponible: it.montos?.monto_disponible_clp ?? it.montos?.monto_disponible ?? null,
        fechaPublicacion: it.fechas?.fecha_publicacion || null,
        fechaCierre,
        ofertasRecibidas: it.resumen?.total_ofertas_recibidas ?? null,
        diasRestantes: dias,
        urgencia: calcularUrgencia(dias),
        url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${it.codigo || ''}`,
      };
    });

    oportunidades.sort((a, b) => {
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });

    return res.status(200).json({
      oportunidades,
      total: oportunidades.length,
      totalRevisadas: items.length,
      ultimaActualizacion: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error consultando Compra Ágil:', error);
    return res.status(500).json({
      error: 'No se pudo consultar la API de Compra Ágil.',
      detalle: error.message,
    });
  }
}
