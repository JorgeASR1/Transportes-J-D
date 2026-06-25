import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ============================================================
// UTILIDADES DE FORMATO
// ============================================================

function formatearMonto(monto, moneda = 'CLP') {
  if (monto === null || monto === undefined || monto === 0) return null;
  if (moneda === 'CLP') return '$' + Number(monto).toLocaleString('es-CL');
  return Number(monto).toLocaleString('es-CL') + ' ' + moneda;
}

// Versión compacta para montos grandes ($1.250.000 -> $1,3M)
function montoCompacto(monto) {
  if (monto === null || monto === undefined || monto === 0) return '—';
  const n = Number(monto);
  if (n >= 1000000) return '$' + (Math.round(n / 100000) / 10).toLocaleString('es-CL') + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000).toLocaleString('es-CL') + 'K';
  return '$' + n.toLocaleString('es-CL');
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return 'No especificada';
  try {
    return new Date(fechaISO).toLocaleDateString('es-CL', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return fechaISO; }
}

// ============================================================
// COMPONENTES COMPARTIDOS
// ============================================================

function BadgeUrgencia({ urgencia, dias }) {
  const config = {
    critica:     { texto: '¡' + dias + ' día' + (dias === 1 ? '' : 's') + '!', clase: 'badge-critica' },
    alta:        { texto: dias + ' días', clase: 'badge-alta' },
    media:       { texto: dias + ' días', clase: 'badge-media' },
    baja:        { texto: dias + ' días', clase: 'badge-baja' },
    cerrada:     { texto: 'Cerrada', clase: 'badge-cerrada' },
    desconocida: { texto: 'Sin fecha', clase: 'badge-desconocida' },
  };
  const item = config[urgencia] || config.desconocida;
  return <span className={'badge ' + item.clase}>{item.texto}</span>;
}

function EstadoMensaje({ icono, children, detalle }) {
  return (
    <div className="estado-mensaje">
      {icono && <p className="estado-vacio-icono">{icono}</p>}
      <p>{children}</p>
      {detalle && <p className="estado-detalle">{detalle}</p>}
    </div>
  );
}

// ============================================================
// PESTAÑA 1 — OPORTUNIDADES ACTIVAS (LICITACIONES)
// ============================================================

function TarjetaOportunidad({ op }) {
  const monto = formatearMonto(op.montoEstimado, op.moneda);
  return (
    <div className={'tarjeta tarjeta-' + op.urgencia}>
      <div className="tarjeta-header">
        <BadgeUrgencia urgencia={op.urgencia} dias={op.diasRestantes} />
        <span className="tarjeta-estado">{op.estado}</span>
      </div>
      <h3 className="tarjeta-titulo">{op.nombre}</h3>
      <div className="tarjeta-info">
        <div className="tarjeta-campo"><span className="campo-icono">🏛️</span><span className="campo-texto">{op.organismo}</span></div>
        <div className="tarjeta-campo"><span className="campo-icono">📍</span><span className="campo-texto">{op.comuna}</span></div>
        {monto && <div className="tarjeta-campo"><span className="campo-icono">💰</span><span className="campo-texto">{monto}</span></div>}
        <div className="tarjeta-campo"><span className="campo-icono">📅</span><span className="campo-texto">Cierra: {formatearFecha(op.fechaCierre)}</span></div>
        <div className="tarjeta-campo"><span className="campo-icono">📋</span><span className="campo-texto codigo">{op.codigo}</span></div>
      </div>
      <a href={'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=' + op.codigo}
        target="_blank" rel="noopener noreferrer" className="tarjeta-boton">Ver en Mercado Público →</a>
    </div>
  );
}

function VistaOportunidades() {
  const [oportunidades, setOportunidades] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalSinFiltro, setTotalSinFiltro] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const [filtroUrgencia, setFiltroUrgencia] = useState('todas');
  const [filtroComuna, setFiltroComuna] = useState('todas');
  const [filtroRegion, setFiltroRegion] = useState(true);
  const [montoMin, setMontoMin] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch('/api/oportunidades?soloRegion=' + filtroRegion);
      const datos = await resp.json();
      if (!resp.ok) throw new Error(datos.error || 'Error al cargar datos');
      setOportunidades(datos.oportunidades || []);
      setComunas(datos.comunas || []);
      setTotal(datos.total || 0);
      setTotalSinFiltro(datos.totalSinFiltro || 0);
      setUltimaActualizacion(datos.ultimaActualizacion);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, [filtroRegion]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const filtradas = oportunidades.filter(op => {
    if (filtroUrgencia !== 'todas' && op.urgencia !== filtroUrgencia) return false;
    if (filtroComuna !== 'todas' && op.comuna !== filtroComuna) return false;
    if (montoMin && (!op.montoEstimado || op.montoEstimado < Number(montoMin))) return false;
    if (busqueda) {
      const texto = (op.nombre + ' ' + op.organismo + ' ' + op.codigo + ' ' + op.comuna).toLowerCase();
      if (!texto.includes(busqueda.toLowerCase())) return false;
    }
    return true;
  });

  const contadores = {
    critica: oportunidades.filter(o => o.urgencia === 'critica').length,
    alta: oportunidades.filter(o => o.urgencia === 'alta').length,
    media: oportunidades.filter(o => o.urgencia === 'media').length,
    baja: oportunidades.filter(o => o.urgencia === 'baja').length,
  };

  return (
    <>
      <div className="barra-superior">
        <button onClick={cargarDatos} className="boton-actualizar" disabled={cargando}>
          {cargando ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {!cargando && !error && (
        <div className="resumen">
          <div className="resumen-principal">
            <span className="resumen-numero">{total}</span>
            <span className="resumen-texto">licitación{total !== 1 ? 'es' : ''} de transporte</span>
          </div>
          <div className="resumen-detalle">De {totalSinFiltro.toLocaleString('es-CL')} licitaciones activas en total</div>
          {contadores.critica > 0 && (
            <div className="resumen-alerta">⚠️ {contadores.critica} cierra{contadores.critica !== 1 ? 'n' : ''} en menos de 48 horas</div>
          )}
        </div>
      )}

      {!cargando && !error && oportunidades.length > 0 && (
        <div className="filtros">
          <input type="text" placeholder="Buscar por nombre, organismo o código..."
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="filtro-busqueda" />
          <div className="filtro-grupo">
            <span className="filtro-label">Urgencia</span>
            <div className="filtro-opciones">
              {[
                { valor: 'todas', texto: 'Todas (' + oportunidades.length + ')' },
                { valor: 'critica', texto: 'Urgente (' + contadores.critica + ')' },
                { valor: 'alta', texto: 'Pronto (' + contadores.alta + ')' },
                { valor: 'media', texto: 'Media (' + contadores.media + ')' },
                { valor: 'baja', texto: 'Holgada (' + contadores.baja + ')' },
              ].map(op => (
                <button key={op.valor} onClick={() => setFiltroUrgencia(op.valor)}
                  className={'filtro-chip ' + (filtroUrgencia === op.valor ? 'filtro-chip-activo' : '')}>{op.texto}</button>
              ))}
            </div>
          </div>
          <div className="filtro-fila">
            <div className="filtro-grupo filtro-medio">
              <span className="filtro-label">Comuna</span>
              <select value={filtroComuna} onChange={(e) => setFiltroComuna(e.target.value)} className="filtro-select">
                <option value="todas">Todas las comunas</option>
                {comunas.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filtro-grupo filtro-medio">
              <span className="filtro-label">Monto mínimo</span>
              <input type="number" placeholder="$ Sin mínimo" value={montoMin}
                onChange={(e) => setMontoMin(e.target.value)} className="filtro-input" />
            </div>
          </div>
          <label className="filtro-toggle">
            <input type="checkbox" checked={filtroRegion} onChange={(e) => setFiltroRegion(e.target.checked)} />
            <span>Solo Biobío y Ñuble</span>
          </label>
        </div>
      )}

      {cargando && <div className="estado-mensaje"><div className="spinner"></div><p>Buscando licitaciones de transporte...</p><p className="estado-detalle">Consultando Mercado Público</p></div>}

      {error && (
        <div className="estado-error">
          <p className="error-titulo">No se pudieron cargar los datos</p>
          <p className="error-detalle">{error}</p>
          <button onClick={cargarDatos} className="boton-reintentar">Intentar de nuevo</button>
        </div>
      )}

      {!cargando && !error && filtradas.length === 0 && (
        <div className="estado-mensaje">
          <p className="estado-vacio-icono">📭</p>
          <p>No se encontraron licitaciones con estos filtros</p>
          {oportunidades.length > 0 && (
            <button onClick={() => { setFiltroUrgencia('todas'); setFiltroComuna('todas'); setMontoMin(''); setBusqueda(''); }}
              className="boton-reintentar">Limpiar filtros</button>
          )}
        </div>
      )}

      {!cargando && !error && filtradas.length > 0 && (
        <div className="listado">{filtradas.map((op, i) => <TarjetaOportunidad key={op.codigo || i} op={op} />)}</div>
      )}

      {ultimaActualizacion && <p className="actualizacion-pie">Última consulta: {formatearFecha(ultimaActualizacion)}</p>}
    </>
  );
}

// ============================================================
// PESTAÑA 2 — COMPRA ÁGIL
// ============================================================

function TarjetaCompraAgil({ op }) {
  const monto = formatearMonto(op.montoDisponible);
  return (
    <div className={'tarjeta tarjeta-' + op.urgencia}>
      <div className="tarjeta-header">
        <BadgeUrgencia urgencia={op.urgencia} dias={op.diasRestantes} />
        <span className="tarjeta-estado">Compra Ágil</span>
      </div>
      <h3 className="tarjeta-titulo">{op.nombre}</h3>
      <div className="tarjeta-info">
        <div className="tarjeta-campo"><span className="campo-icono">🏛️</span><span className="campo-texto">{op.organismo}</span></div>
        {op.region && <div className="tarjeta-campo"><span className="campo-icono">📍</span><span className="campo-texto">{op.region}</span></div>}
        {monto && <div className="tarjeta-campo"><span className="campo-icono">💰</span><span className="campo-texto">{monto}</span></div>}
        <div className="tarjeta-campo"><span className="campo-icono">📅</span><span className="campo-texto">Cierra: {formatearFecha(op.fechaCierre)}</span></div>
        {op.ofertasRecibidas !== null && op.ofertasRecibidas !== undefined && (
          <div className="tarjeta-campo"><span className="campo-icono">📨</span><span className="campo-texto">{op.ofertasRecibidas} cotización{op.ofertasRecibidas !== 1 ? 'es' : ''} recibida{op.ofertasRecibidas !== 1 ? 's' : ''}</span></div>
        )}
        <div className="tarjeta-campo"><span className="campo-icono">📋</span><span className="campo-texto codigo">{op.codigo}</span></div>
      </div>
      <a href={op.url} target="_blank" rel="noopener noreferrer" className="tarjeta-boton">Ver en Mercado Público →</a>
    </div>
  );
}

function VistaCompraAgil() {
  const [oportunidades, setOportunidades] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch('/api/compraagil');
      const datos = await resp.json();
      if (!resp.ok) throw new Error((datos.error || 'Error al cargar Compra Ágil') + (datos.detalle ? ' — ' + datos.detalle : ''));
      setOportunidades(datos.oportunidades || []);
      setTotal(datos.total || 0);
      setUltimaActualizacion(datos.ultimaActualizacion);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const filtradas = oportunidades.filter(op => {
    if (!busqueda) return true;
    const texto = (op.nombre + ' ' + op.organismo + ' ' + op.codigo).toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <>
      <div className="nota-info">
        💡 Compra Ágil son compras bajo 100 UTM: más rápidas, con menos requisitos y fáciles de ganar. Ideal para empezar.
      </div>

      <div className="barra-superior">
        <button onClick={cargarDatos} className="boton-actualizar" disabled={cargando}>
          {cargando ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {!cargando && !error && (
        <div className="resumen">
          <div className="resumen-principal">
            <span className="resumen-numero">{total}</span>
            <span className="resumen-texto">Compra{total !== 1 ? 's' : ''} Ágil{total !== 1 ? 'es' : ''} de transporte</span>
          </div>
          <div className="resumen-detalle">Publicadas y abiertas a cotizar en Biobío y Ñuble</div>
        </div>
      )}

      {!cargando && !error && oportunidades.length > 0 && (
        <div className="filtros">
          <input type="text" placeholder="Buscar por nombre, organismo o código..."
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="filtro-busqueda" />
        </div>
      )}

      {cargando && <div className="estado-mensaje"><div className="spinner"></div><p>Buscando Compras Ágiles de transporte...</p><p className="estado-detalle">Consultando Mercado Público</p></div>}

      {error && (
        <div className="estado-error">
          <p className="error-titulo">No se pudo cargar Compra Ágil</p>
          <p className="error-detalle">{error}</p>
          <button onClick={cargarDatos} className="boton-reintentar">Intentar de nuevo</button>
        </div>
      )}

      {!cargando && !error && filtradas.length === 0 && (
        <EstadoMensaje icono="📭" detalle="Vuelve a revisar más tarde: las Compras Ágiles se publican y cierran rápido.">
          No hay Compras Ágiles de transporte abiertas ahora mismo
        </EstadoMensaje>
      )}

      {!cargando && !error && filtradas.length > 0 && (
        <div className="listado">{filtradas.map((op, i) => <TarjetaCompraAgil key={op.codigo || i} op={op} />)}</div>
      )}

      {ultimaActualizacion && <p className="actualizacion-pie">Última consulta: {formatearFecha(ultimaActualizacion)}</p>}
    </>
  );
}

// ============================================================
// PESTAÑA 3 — COMPETENCIA + ESTIMADOR DE PRECIOS
// ============================================================

function BloqueEstimador({ estimador }) {
  if (!estimador || estimador.length === 0) return null;
  return (
    <>
      <h3 className="seccion-titulo">💰 Estimador de precio competitivo</h3>
      <p className="seccion-desc">
        Rango de montos a los que se adjudican los contratos por tipo de servicio. Úsalo como referencia
        para cotizar sin quedar muy alto ni regalar el trabajo. El monto real depende del alcance y la duración.
      </p>
      <div className="estimador-lista">
        {estimador.map(cat => (
          <div key={cat.categoria} className="estimador-card">
            <div className="estimador-header">
              <span className="estimador-etiqueta">{cat.etiqueta}</span>
              <span className="estimador-contratos">{cat.contratos} contrato{cat.contratos !== 1 ? 's' : ''}</span>
            </div>
            <div className="estimador-mediana">
              <span className="estimador-mediana-label">Mediana adjudicada</span>
              <span className="estimador-mediana-valor">{formatearMonto(cat.mediana)}</span>
            </div>
            <div className="estimador-rango">
              <span>Rango habitual: {montoCompacto(cat.rangoBajo)} – {montoCompacto(cat.rangoAlto)}</span>
            </div>
            <div className="estimador-extremos">
              <span>Mín: {montoCompacto(cat.minimo)}</span>
              <span>Máx: {montoCompacto(cat.maximo)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function VistaCompetencia() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [dias, setDias] = useState(15);
  const [yaConsultado, setYaConsultado] = useState(false);

  const analizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch('/api/adjudicadas?dias=' + dias + '&soloRegion=true');
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Error en el análisis');
      setDatos(json);
      setYaConsultado(true);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, [dias]);

  return (
    <>
      <div className="competencia-intro">
        <p className="competencia-titulo">¿Quién gana y a qué precio?</p>
        <p className="competencia-desc">
          Analiza las licitaciones de transporte ya adjudicadas en Biobío y Ñuble: tus competidores,
          cuánto se adjudica por tipo de servicio y qué tan disputado está cada nicho.
        </p>
        <div className="competencia-controles">
          <label className="filtro-label">Periodo a analizar</label>
          <div className="competencia-opciones">
            {[7, 15, 30].map(d => (
              <button key={d} onClick={() => setDias(d)}
                className={'filtro-chip ' + (dias === d ? 'filtro-chip-activo' : '')}>Últimos {d} días</button>
            ))}
          </div>
          <button onClick={analizar} className="boton-analizar" disabled={cargando}>
            {cargando ? 'Analizando...' : '🔍 Analizar competencia'}
          </button>
          {cargando && <p className="competencia-aviso">Esto puede tardar unos segundos: revisa cada licitación una por una.</p>}
        </div>
      </div>

      {error && (
        <div className="estado-error">
          <p className="error-titulo">No se pudo completar el análisis</p>
          <p className="error-detalle">{error}</p>
        </div>
      )}

      {yaConsultado && datos && !cargando && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-numero">{datos.estadisticas.licitacionesAdjudicadas}</span><span className="stat-label">Licitaciones adjudicadas</span></div>
            <div className="stat-card"><span className="stat-numero">{datos.estadisticas.competidoresUnicos}</span><span className="stat-label">Competidores distintos</span></div>
            <div className="stat-card"><span className="stat-numero stat-numero-sm">{montoCompacto(datos.estadisticas.totalAdjudicado)}</span><span className="stat-label">Total adjudicado</span></div>
            <div className="stat-card"><span className="stat-numero">{datos.estadisticas.promedioOferentes ?? '—'}</span><span className="stat-label">Oferentes promedio</span></div>
          </div>

          <BloqueEstimador estimador={datos.estimadorPrecios} />

          {datos.ranking.length > 0 ? (
            <>
              <h3 className="seccion-titulo">🏆 Ranking de competidores</h3>
              <div className="ranking-lista">
                {datos.ranking.slice(0, 15).map((comp, i) => (
                  <div key={comp.nombre} className="ranking-item">
                    <span className="ranking-pos">{i + 1}</span>
                    <div className="ranking-info">
                      <span className="ranking-nombre">{comp.nombre}</span>
                      <span className="ranking-detalle">{comp.contratos} contrato{comp.contratos !== 1 ? 's' : ''} · {comp.organismos} organismo{comp.organismos !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="ranking-monto">{montoCompacto(comp.montoTotal)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EstadoMensaje icono="🔍" detalle="Prueba ampliando el rango de días.">
              No se encontraron licitaciones de transporte adjudicadas en este periodo.
            </EstadoMensaje>
          )}
        </>
      )}

      {!yaConsultado && !cargando && (
        <EstadoMensaje icono="📊">Elige un periodo y presiona &quot;Analizar competencia&quot; para empezar.</EstadoMensaje>
      )}
    </>
  );
}

// ============================================================
// PÁGINA PRINCIPAL CON PESTAÑAS
// ============================================================

export default function Dashboard() {
  const [pestana, setPestana] = useState('oportunidades');

  return (
    <>
      <Head>
        <title>Radar de Oportunidades — Transporte</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Oportunidades de transporte en Mercado Público para Biobío y Ñuble" />
      </Head>

      <main className="contenedor">
        <header className="header">
          <div className="header-titulo">
            <h1>🚌 Radar de Oportunidades</h1>
            <p className="header-subtitulo">Transporte · Biobío y Ñuble</p>
          </div>
        </header>

        <div className="pestanas">
          <button onClick={() => setPestana('oportunidades')}
            className={'pestana ' + (pestana === 'oportunidades' ? 'pestana-activa' : '')}>📋 Licitaciones</button>
          <button onClick={() => setPestana('compraagil')}
            className={'pestana ' + (pestana === 'compraagil' ? 'pestana-activa' : '')}>⚡ Compra Ágil</button>
          <button onClick={() => setPestana('competencia')}
            className={'pestana ' + (pestana === 'competencia' ? 'pestana-activa' : '')}>📊 Competencia</button>
        </div>

        {pestana === 'oportunidades' && <VistaOportunidades />}
        {pestana === 'compraagil' && <VistaCompraAgil />}
        {pestana === 'competencia' && <VistaCompetencia />}

        <footer className="footer">
          <p>Datos de <a href="https://www.mercadopublico.cl" target="_blank" rel="noopener noreferrer">Mercado Público</a> vía API oficial</p>
        </footer>
      </main>
    </>
  );
}
