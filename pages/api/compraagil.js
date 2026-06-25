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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo se aceptan peticiones GET' });
  }

  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  if (!ticket || ticket === 'AQUI-VA-TU-TICKET-DE-MERCADO-PUBLICO') {
    return res.status(500).json({ error: 'Falta configurar el ticket de Mercado Público.' });
  }

  // Por defecto Biobío (8) y Ñuble (16); estado "publicada" = abierta a cotizar
  const { soloRegion } = req.query;
  const regiones = soloRegion === 'false' ? '' : 'region=8,16&';

  try {
    const items = [];
    let pagina = 1;
    let totalPaginas = 1;
    const MAX_PAGINAS = 10; // tope de seguridad

    // Recorrer páginas hasta traer todas las Compras Ágiles publicadas
    do {
      const url = `${BASE}/v2/compra-agil?${regiones}estado=publicada&tamano_pagina=50&numero_pagina=${pagina}&ordenar_por=FechaPublicacion`;
      const resp = await fetch(url, { headers: { ticket } });

      if (resp.status === 429) {
        return res.status(429).json({ error: 'Se alcanzó el límite diario de consultas a la API. Intenta mañana.' });
      }
      if (!resp.ok) {
        throw new Error(`La API de Compra Ágil respondió con error: ${resp.status}`);
      }

      const datos = await resp.json();
      if (datos.success !== 'OK' || !datos.payload) {
        throw new Error('La API de Compra Ágil devolvió una respuesta inesperada.');
      }

      const lote = datos.payload.items || [];
      items.push(...lote);

      const pag = datos.payload.paginacion || {};
      totalPaginas = pag.total_paginas || 1;
      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= MAX_PAGINAS);

    // Filtrar por palabras clave de transporte (en nombre)
    const transporte = items.filter(it => contieneTransporte(it.nombre || ''));

    // Transformar a formato limpio
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
        // Enlace directo a la ficha de Compra Ágil en Mercado Público
        url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${it.codigo || ''}`,
      };
    });

    // Ordenar por urgencia
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
      error: 'No se pudo consultar la API de Compra Ágil. Intenta de nuevo en unos minutos.',
      detalle: error.message,
    });
  }
}
