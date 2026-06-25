// lib/filtros.js
// Lógica de filtrado compartida entre la página, la alerta de WhatsApp
// y el análisis de competencia. Así, si cambias las palabras clave,
// se actualizan en todos lados a la vez.

// Palabras clave para filtrar licitaciones de transporte
export const PALABRAS_CLAVE = [
  // Transporte escolar (reforzado)
  'transporte escolar',
  'traslado escolar',
  'furgón escolar',
  'furgon escolar',
  'transporte de alumnos',
  'traslado de alumnos',
  'transporte de estudiantes',
  'movilización escolar',
  'movilizacion escolar',
  // Transporte de pasajeros general
  'transporte de pasajeros',
  'servicio de transporte',
  'transporte terrestre',
  'transporte de personas',
  // Traslado de personal / funcionarios
  'traslado de personal',
  'traslado de funcionarios',
  'transporte de funcionarios',
  'transporte de personal',
  'acercamiento',
  // Salud
  'traslado de pacientes',
  'transporte de pacientes',
  'rondas médicas',
  'rondas medicas',
  // Arriendo de vehículos
  'arriendo de buses',
  'arriendo de minibuses',
  'arriendo de vehículos',
  'arriendo de vehiculos',
  'arriendo de vehículo',
  'arriendo de vehiculo',
  'buses con chofer',
  'vehículo con chofer',
  'vehiculo con chofer',
  'minibus',
  'minibús',
  // Vehículo particular
  'vehículo particular',
  'vehiculo particular',
  // Genéricos
  'movilización',
  'movilizacion',
];

// Términos para identificar la región del Biobío y Ñuble
export const TERMINOS_REGION = [
  'biobío', 'biobio', 'bio-bío', 'bio-bio', 'bio bío', 'bio bio',
  'ñuble', 'nuble',
  'región del biobío', 'region del biobio',
  'región de ñuble', 'region de nuble',
  'viii región', 'viii region',
  'xvi región', 'xvi region',
  // Comunas del Biobío
  'concepción', 'concepcion', 'talcahuano', 'hualpén', 'hualpen',
  'san pedro de la paz', 'chiguayante', 'penco', 'tomé', 'tome',
  'coronel', 'lota', 'santa juana', 'hualqui', 'florida',
  'los ángeles', 'los angeles', 'cabrero', 'yumbel', 'laja',
  'nacimiento', 'mulchén', 'mulchen', 'negrete', 'quilaco',
  'quilleco', 'san rosendo', 'santa bárbara', 'santa barbara',
  'tucapel', 'antuco', 'alto biobío', 'alto biobio',
  'arauco', 'curanilahue', 'lebu', 'los álamos', 'los alamos',
  'cañete', 'canete', 'contulmo', 'tirúa', 'tirua',
  // Comunas de Ñuble
  'chillán', 'chillan', 'chillán viejo', 'chillan viejo',
  'bulnes', 'quillón', 'quillon', 'san ignacio', 'el carmen',
  'pemuco', 'yungay', 'pinto', 'coihueco',
  'san carlos', 'ñiquén', 'niquen', 'san fabián', 'san fabian',
  'san nicolás', 'san nicolas', 'ñipas', 'nipas', 'ránquil', 'ranquil',
  'coelemu', 'trehuaco', 'portezuelo', 'cobquecura', 'quirihue',
];

// Convierte código de estado numérico a texto legible
export function estadoTexto(codigo) {
  const estados = {
    '5': 'Publicada',
    '6': 'Cerrada',
    '7': 'Desierta',
    '8': 'Adjudicada',
    '18': 'Revocada',
    '19': 'Suspendida',
  };
  return estados[String(codigo)] || String(codigo);
}

// Calcula cuántos días faltan para el cierre
export function diasRestantes(fechaCierre) {
  if (!fechaCierre) return null;
  const cierre = new Date(fechaCierre);
  if (isNaN(cierre.getTime())) return null;
  const hoy = new Date();
  const diff = cierre - hoy;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Determina el nivel de urgencia según los días restantes
export function calcularUrgencia(dias) {
  if (dias === null) return 'desconocida';
  if (dias <= 0) return 'cerrada';
  if (dias <= 2) return 'critica';
  if (dias <= 5) return 'alta';
  if (dias <= 10) return 'media';
  return 'baja';
}

// Verifica si el texto contiene alguna palabra clave de transporte
export function contieneTransporte(texto) {
  if (!texto) return false;
  const lower = texto.toLowerCase();
  return PALABRAS_CLAVE.some(palabra => lower.includes(palabra));
}

// Verifica si el texto menciona la región del Biobío o Ñuble
export function esRegionObjetivo(texto) {
  if (!texto) return false;
  const lower = texto.toLowerCase();
  return TERMINOS_REGION.some(termino => lower.includes(termino));
}

// Extrae el texto relevante de una licitación para buscar coincidencias
export function textoLicitacion(lic) {
  return [
    lic.Nombre,
    lic.Descripcion,
    lic.NombreOrganismo,
    lic.RegionUnidad,
    lic.CiudadUnidad,
    lic.ComunaUnidad,
  ].filter(Boolean).join(' ');
}

// Filtra un listado de licitaciones por transporte y (opcionalmente) región
export function filtrarLicitaciones(listado, { soloRegion = true } = {}) {
  return listado.filter(lic => {
    const texto = textoLicitacion(lic);
    if (!contieneTransporte(texto)) return false;
    if (soloRegion && !esRegionObjetivo(texto)) return false;
    return true;
  });
}

// ============================================================
// CLASIFICACIÓN POR CATEGORÍA DE SERVICIO
// Se usa para el estimador de precios competitivo.
// ============================================================

export const CATEGORIAS = [
  {
    clave: 'escolar',
    etiqueta: 'Transporte escolar',
    terminos: ['transporte escolar', 'traslado escolar', 'furgón escolar', 'furgon escolar',
      'transporte de alumnos', 'traslado de alumnos', 'transporte de estudiantes',
      'movilización escolar', 'movilizacion escolar'],
  },
  {
    clave: 'pacientes',
    etiqueta: 'Traslado de pacientes / salud',
    terminos: ['traslado de pacientes', 'transporte de pacientes', 'rondas médicas', 'rondas medicas'],
  },
  {
    clave: 'personal',
    etiqueta: 'Traslado de personal',
    terminos: ['traslado de personal', 'traslado de funcionarios', 'transporte de funcionarios',
      'transporte de personal', 'acercamiento'],
  },
  {
    clave: 'arriendo',
    etiqueta: 'Arriendo de buses / vehículos',
    terminos: ['arriendo de buses', 'arriendo de minibuses', 'arriendo de vehículos',
      'arriendo de vehiculos', 'arriendo de vehículo', 'arriendo de vehiculo',
      'buses con chofer', 'vehículo con chofer', 'vehiculo con chofer', 'minibus', 'minibús',
      'vehículo particular', 'vehiculo particular'],
  },
  {
    clave: 'general',
    etiqueta: 'Transporte de pasajeros (general)',
    terminos: ['transporte de pasajeros', 'servicio de transporte', 'transporte terrestre',
      'transporte de personas', 'movilización', 'movilizacion'],
  },
];

// Devuelve la clave de categoría que mejor calza con el texto
export function clasificarCategoria(texto) {
  if (!texto) return 'general';
  const lower = texto.toLowerCase();
  for (const cat of CATEGORIAS) {
    if (cat.terminos.some(t => lower.includes(t))) return cat.clave;
  }
  return 'general';
}

export function etiquetaCategoria(clave) {
  const cat = CATEGORIAS.find(c => c.clave === clave);
  return cat ? cat.etiqueta : 'Otros';
}
