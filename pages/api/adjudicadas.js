// pages/api/adjudicadas.js
// Analiza la COMPETENCIA: busca licitaciones de transporte adjudicadas
// en un rango de días, consulta el detalle de cada una para saber QUIÉN ganó
// y por CUÁNTO, y entrega un resumen de competidores.
//
// Nota: este análisis hace varias consultas a la API (una por día + una por
// licitación adjudicada). Por eso puede tardar unos segundos. El límite de la
// API es de 10.000 consultas diarias, muy por encima de lo que usa esto.

import {
  diasRestantes,
  filtrarLicitaciones,
  clasificarCategoria,
  etiquetaCategoria,
} from '../../lib/filtros';

// Calcula la mediana de un arreglo de números
function mediana(nums) {
  if (!nums.length) return 0;
  const ord = [...nums].sort((a, b) => a - b);
  const mitad = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[mitad] : Math.round((ord[mitad - 1] + ord[mitad]) / 2);
}

// Calcula un percentil (0-100) de un arreglo de números
function percentil(nums, p) {
  if (!nums.length) return 0;
  const ord = [...nums].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * ord.length) - 1;
  return ord[Math.max(0, Math.min(idx, ord.length - 1))];
}

// Permite que la función corra hasta 60 segundos (análisis de varios días)
export const config = {
  maxDuration: 60,
};

// Formatea una fecha Date a ddmmaaaa (formato que pide la API)
function formatoFechaAPI(fecha) {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const aaaa = fecha.getFullYear();
  return `${dd}${mm}${aaaa}`;
}

// Procesa una lista en lotes pequeños para no saturar la API
async function enLotes(items, tamanoLote, funcion) {
  const resultados = [];
  for (let i = 0; i < items.length; i += tamanoLote) {
    const lote = items.slice(i, i + tamanoLote);
    const procesados = await Promise.all(lote.map(funcion));
    resultados.push(...procesados);
  }
  return resultados;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo se aceptan peticiones GET' });
  }

  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  if (!ticket || ticket === 'AQUI-VA-TU-TICKET-DE-MERCADO-PUBLICO') {
    return res.status(500).json({ error: 'Falta configurar el ticket de Mercado Público.' });
  }

  // Rango de días a analizar (por defecto 15, máximo 30 para no demorar demasiado)
  let dias = parseInt(req.query.dias, 10) || 15;
  if (dias > 30) dias = 30;
  if (dias < 1) dias = 1;

  const { soloRegion } = req.query;
  const filtrarRegion = soloRegion !== 'false';

  try {
    // 1. Recolectar licitaciones adjudicadas día por día
    const hoy = new Date();
    const fechas = [];
    for (let i = 0; i < dias; i++) {
      const f = new Date(hoy);
      f.setDate(hoy.getDate() - i);
      fechas.push(formatoFechaAPI(f));
    }

    const listadosPorDia = await enLotes(fechas, 5, async (fecha) => {
      try {
        const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fecha}&estado=adjudicada&ticket=${ticket}`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const datos = await resp.json();
        return datos.Listado || [];
      } catch {
        return [];
      }
    });

    // Aplanar y filtrar por transporte + región
    const todas = listadosPorDia.flat();
    const adjudicadasTransporte = filtrarLicitaciones(todas, { soloRegion: filtrarRegion });

    // Quitar duplicados por código
    const vistas = new Set();
    const unicas = adjudicadasTransporte.filter(lic => {
      const cod = lic.CodigoExterno || lic.Codigo;
      if (!cod || vistas.has(cod)) return false;
      vistas.add(cod);
      return true;
    });

    // 2. Consultar el detalle de cada licitación para saber quién ganó
    const detalles = await enLotes(unicas, 4, async (lic) => {
      const cod = lic.CodigoExterno || lic.Codigo;
      try {
        const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${cod}&ticket=${ticket}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const datos = await resp.json();
        return (datos.Listado && datos.Listado[0]) || null;
      } catch {
        return null;
      }
    });

    // 3. Extraer ganadores y montos de cada licitación
    const competidores = {}; // nombreProveedor -> { contratos, montoTotal, organismos:Set }
    const licitacionesDetalle = [];
    const preciosPorCategoria = {}; // categoria -> [montoTotalLicitacion, ...]

    for (const detalle of detalles) {
      if (!detalle) continue;

      const nombreLic = detalle.Nombre || 'Sin nombre';
      const organismo = detalle.NombreOrganismo || 'No especificado';
      const oferentes = detalle.Adjudicacion?.NumeroOferentes ?? null;
      const fechaAdj = detalle.Adjudicacion?.Fecha || null;

      // Recorrer los ítems adjudicados
      const items = detalle.Items?.Listado || [];
      const ganadoresLic = {}; // por licitación
      let montoTotalLic = 0;   // valor total adjudicado de esta licitación

      for (const item of items) {
        const adj = item.Adjudicacion;
        if (!adj || !adj.NombreProveedor) continue;

        const proveedor = adj.NombreProveedor.trim();
        const cantidad = Number(adj.Cantidad) || 0;
        const montoUnitario = Number(adj.MontoUnitario) || 0;
        const montoItem = cantidad * montoUnitario;
        montoTotalLic += montoItem;

        // Acumular por proveedor (global)
        if (!competidores[proveedor]) {
          competidores[proveedor] = { contratos: 0, montoTotal: 0, organismos: new Set() };
        }
        competidores[proveedor].montoTotal += montoItem;
        competidores[proveedor].organismos.add(organismo);

        // Acumular por licitación
        if (!ganadoresLic[proveedor]) ganadoresLic[proveedor] = 0;
        ganadoresLic[proveedor] += montoItem;
      }

      // Contar un "contrato ganado" por cada proveedor que ganó algo en esta licitación
      Object.keys(ganadoresLic).forEach(prov => {
        competidores[prov].contratos += 1;
      });

      // Clasificar la licitación por categoría y guardar su monto total (para el estimador)
      if (montoTotalLic > 0) {
        const categoria = clasificarCategoria(`${nombreLic} ${detalle.Descripcion || ''}`);
        if (!preciosPorCategoria[categoria]) preciosPorCategoria[categoria] = [];
        preciosPorCategoria[categoria].push(montoTotalLic);
      }

      licitacionesDetalle.push({
        codigo: detalle.CodigoExterno || detalle.Codigo || '',
        nombre: nombreLic,
        organismo,
        oferentes,
        fechaAdjudicacion: fechaAdj,
        ganadores: Object.entries(ganadoresLic).map(([nombre, monto]) => ({ nombre, monto })),
        url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${detalle.CodigoExterno || ''}`,
      });
    }

    // Construir el estimador de precios por categoría
    const estimadorPrecios = Object.entries(preciosPorCategoria)
      .map(([categoria, montos]) => ({
        categoria,
        etiqueta: etiquetaCategoria(categoria),
        contratos: montos.length,
        mediana: mediana(montos),
        minimo: Math.min(...montos),
        maximo: Math.max(...montos),
        rangoBajo: percentil(montos, 25),
        rangoAlto: percentil(montos, 75),
      }))
      .sort((a, b) => b.contratos - a.contratos);

    // 4. Convertir a lista ordenada por monto total ganado
    const ranking = Object.entries(competidores)
      .map(([nombre, datos]) => ({
        nombre,
        contratos: datos.contratos,
        montoTotal: Math.round(datos.montoTotal),
        organismos: datos.organismos.size,
      }))
      .sort((a, b) => b.montoTotal - a.montoTotal);

    // Estadísticas generales
    const totalAdjudicado = ranking.reduce((s, c) => s + c.montoTotal, 0);
    const oferentesValidos = licitacionesDetalle
      .map(l => l.oferentes)
      .filter(o => o !== null && o !== undefined && !isNaN(Number(o)))
      .map(Number);
    const promedioOferentes = oferentesValidos.length
      ? (oferentesValidos.reduce((s, o) => s + o, 0) / oferentesValidos.length)
      : null;

    return res.status(200).json({
      ranking,
      estimadorPrecios,
      licitaciones: licitacionesDetalle,
      estadisticas: {
        diasAnalizados: dias,
        licitacionesAdjudicadas: licitacionesDetalle.length,
        competidoresUnicos: ranking.length,
        totalAdjudicado: Math.round(totalAdjudicado),
        promedioOferentes: promedioOferentes !== null ? Math.round(promedioOferentes * 10) / 10 : null,
      },
      ultimaActualizacion: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error en análisis de competencia:', error);
    return res.status(500).json({
      error: 'No se pudo completar el análisis de competencia.',
      detalle: error.message,
    });
  }
}
