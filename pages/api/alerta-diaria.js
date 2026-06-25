// pages/api/alerta-diaria.js
// Este endpoint lo ejecuta Vercel Cron automáticamente cada mañana.
// Consulta las oportunidades de transporte del día y te envía un RESUMEN
// a tu WhatsApp usando CallMeBot (servicio gratuito para mensajes propios).

import {
  diasRestantes,
  calcularUrgencia,
  filtrarLicitaciones,
} from '../../lib/filtros';

export default async function handler(req, res) {
  // Seguridad: si configuraste CRON_SECRET, solo Vercel Cron puede ejecutar esto
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }
  }

  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  const phone = process.env.WHATSAPP_PHONE;     // ej: 56912345678 (sin +)
  const apikey = process.env.WHATSAPP_APIKEY;   // clave que te da CallMeBot

  if (!ticket) {
    return res.status(500).json({ error: 'Falta el ticket de Mercado Público.' });
  }
  if (!phone || !apikey) {
    return res.status(500).json({ error: 'Falta configurar WHATSAPP_PHONE o WHATSAPP_APIKEY.' });
  }

  try {
    // 1. Consultar oportunidades activas
    const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket=${ticket}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API respondió ${resp.status}`);

    const datos = await resp.json();
    const listado = datos.Listado || [];
    const filtradas = filtrarLicitaciones(listado, { soloRegion: true });

    const oportunidades = filtradas
      .map(lic => {
        const dias = diasRestantes(lic.FechaCierre);
        return {
          nombre: lic.Nombre || 'Sin nombre',
          organismo: lic.NombreOrganismo || '',
          comuna: lic.ComunaUnidad || '',
          diasRestantes: dias,
          urgencia: calcularUrgencia(dias),
        };
      })
      .filter(o => o.urgencia !== 'cerrada')
      .sort((a, b) => {
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
      });

    // 2. Construir el mensaje
    let mensaje;
    if (oportunidades.length === 0) {
      mensaje = '🚌 Radar de Transporte\n\nHoy no hay nuevas oportunidades de transporte en Biobío/Ñuble. Te aviso mañana.';
    } else {
      const urgentes = oportunidades.filter(o => o.urgencia === 'critica');
      const top = oportunidades.slice(0, 5);

      mensaje = `🚌 Radar de Transporte — ${new Date().toLocaleDateString('es-CL')}\n\n`;
      mensaje += `Hay ${oportunidades.length} oportunidad${oportunidades.length !== 1 ? 'es' : ''} activa${oportunidades.length !== 1 ? 's' : ''} en Biobío/Ñuble.`;

      if (urgentes.length > 0) {
        mensaje += `\n⚠️ ${urgentes.length} cierra${urgentes.length !== 1 ? 'n' : ''} en menos de 48h.`;
      }

      mensaje += `\n\nLas más próximas a cerrar:\n`;
      top.forEach((o, i) => {
        const plazo = o.diasRestantes === null
          ? 'sin fecha'
          : o.diasRestantes <= 0
            ? 'cierra hoy'
            : `${o.diasRestantes} día${o.diasRestantes !== 1 ? 's' : ''}`;
        mensaje += `\n${i + 1}. ${o.nombre} (${o.comuna || o.organismo}) — ${plazo}`;
      });

      mensaje += `\n\nRevisa el detalle en tu dashboard.`;
    }

    // 3. Enviar por WhatsApp vía CallMeBot
    const urlWhatsApp = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(mensaje)}&apikey=${encodeURIComponent(apikey)}`;
    const envio = await fetch(urlWhatsApp);
    const respuestaEnvio = await envio.text();

    return res.status(200).json({
      enviado: true,
      oportunidades: oportunidades.length,
      respuestaWhatsApp: respuestaEnvio.slice(0, 200),
    });

  } catch (error) {
    console.error('Error en alerta diaria:', error);
    return res.status(500).json({ error: 'No se pudo enviar la alerta.', detalle: error.message });
  }
}
