// pages/api/oportunidades.js
// Devuelve las licitaciones de transporte ACTIVAS, filtradas por región.
// Se ejecuta en el servidor (Vercel), por eso es seguro usar el ticket aquí.

import {
  estadoTexto,
  diasRestantes,
  calcularUrgencia,
  filtrarLicitaciones,
} from '../../lib/filtros';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo se aceptan peticiones GET' });
  }

  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  if (!ticket || ticket === 'AQUI-VA-TU-TICKET-DE-MERCADO-PUBLICO') {
    return res.status(500).json({
      error: 'Falta configurar el ticket de Mercado Público. Revisa el README.md',
    });
  }

  const { soloRegion } = req.query;
  const filtrarRegion = soloRegion !== 'false';

  try {
    const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket=${ticket}`;
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      throw new Error(`La API respondió con error: ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    const listado = datos.Listado || [];

    const filtradas = filtrarLicitaciones(listado, { soloRegion: filtrarRegion });

    const oportunidades = filtradas.map(lic => {
      const dias = diasRestantes(lic.FechaCierre);
      return {
        codigo: lic.CodigoExterno || lic.Codigo || '',
        nombre: lic.Nombre || 'Sin nombre',
        descripcion: lic.Descripcion || '',
        organismo: lic.NombreOrganismo || 'No especificado',
        comuna: lic.ComunaUnidad || lic.CiudadUnidad || 'No especificada',
        region: lic.RegionUnidad || '',
        estado: estadoTexto(lic.CodigoEstado || lic.Estado),
        codigoEstado: String(lic.CodigoEstado || lic.Estado || ''),
        fechaCierre: lic.FechaCierre || null,
        fechaPublicacion: lic.FechaPublicacion || null,
        montoEstimado: lic.MontoEstimado || null,
        moneda: lic.Moneda || 'CLP',
        tipo: lic.Tipo || lic.TipoLicitacion || '',
        diasRestantes: dias,
        urgencia: calcularUrgencia(dias),
        url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${lic.CodigoExterno || ''}`,
      };
    });

    // Ordenar por urgencia: las que cierran antes, primero
    oportunidades.sort((a, b) => {
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });

    // Lista de comunas presentes (para el filtro del frontend)
    const comunas = [...new Set(oportunidades.map(o => o.comuna).filter(c => c && c !== 'No especificada'))].sort();

    return res.status(200).json({
      oportunidades,
      comunas,
      total: oportunidades.length,
      totalSinFiltro: listado.length,
      ultimaActualizacion: new Date().toISOString(),
      filtroRegion: filtrarRegion,
    });

  } catch (error) {
    console.error('Error consultando Mercado Público:', error);
    return res.status(500).json({
      error: 'No se pudo consultar la API de Mercado Público. Intenta de nuevo en unos minutos.',
      detalle: error.message,
    });
  }
}
