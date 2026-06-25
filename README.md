# 🚌 Radar de Oportunidades — Transporte en Mercado Público

Dashboard que busca automáticamente licitaciones de transporte de pasajeros en
Mercado Público (Biobío y Ñuble), te avisa por WhatsApp y te deja analizar a tu
competencia en licitaciones ya adjudicadas.

## ¿Qué hace?

**Pestaña Licitaciones**
- Busca licitaciones de transporte activas (escolar, personal, pacientes, arriendo de buses, etc.)
- Filtra por región, comuna, urgencia, monto mínimo y búsqueda libre
- Ordena por urgencia: lo que cierra pronto aparece primero con alerta roja

**Pestaña Compra Ágil**
- Muestra las Compras Ágiles de transporte abiertas en Biobío y Ñuble
- Compra Ágil = compras bajo 100 UTM, más rápidas y fáciles de ganar
- Usa la API oficial de Compra Ágil v2 (servidor api2.mercadopublico.cl)

**Pestaña Competencia**
- Analiza licitaciones de transporte ya adjudicadas en un periodo (7, 15 o 30 días)
- Te muestra quién está ganando, cuántos contratos, por cuánto monto
- Te dice qué tan disputadas están (promedio de oferentes)
- **Estimador de precio competitivo:** rango de montos a los que se adjudica
  cada tipo de servicio (escolar, pacientes, personal, arriendo), para que
  cotices con referencia real

**Alertas por WhatsApp**
- Cada mañana te llega un resumen con las oportunidades del día

---

## 📋 GUÍA DE INSTALACIÓN PASO A PASO

### Paso 1: Crear cuenta en GitHub
1. Ve a github.com y haz clic en **Sign up**
2. Crea tu cuenta y confirma tu correo

### Paso 2: Crear un repositorio
1. Ve a github.com/new
2. Nombre: `mercado-transporte`
3. Déjalo **Public**, NO marques ninguna casilla de abajo
4. Clic en **Create repository**

### Paso 3: Subir los archivos
1. Clic en **uploading an existing file**
2. Arrastra TODOS los archivos y carpetas de este proyecto:
   `package.json`, `next.config.js`, `vercel.json`, `.env.local.example`,
   `.gitignore`, `README.md`, y las carpetas `pages/`, `styles/`, `lib/`
3. Escribe un mensaje ("Primera versión") y clic en **Commit changes**

### Paso 4: Crear cuenta en Vercel
1. Ve a vercel.com y clic en **Sign Up**
2. Elige **Continue with GitHub** y autoriza el acceso

### Paso 5: Importar el proyecto
1. Busca `mercado-transporte` y clic en **Import**
2. Antes de hacer deploy, abre **Environment Variables** y agrega:
   - `MERCADO_PUBLICO_TICKET` → tu ticket de la API
   - (opcional, para WhatsApp) `WHATSAPP_PHONE`, `WHATSAPP_APIKEY`, `CRON_SECRET`
3. Clic en **Deploy** y espera 1-2 minutos
4. Te dará un enlace tipo `mercado-transporte.vercel.app`. Ábrelo en tu celular.

---

## 📱 CONFIGURAR LAS ALERTAS DE WHATSAPP (CallMeBot)

CallMeBot es un servicio gratuito que te permite recibir mensajes de WhatsApp en
tu propio número. Configúralo así:

1. Guarda en tus contactos el número **+34 644 51 95 23** (con un nombre como "CallMeBot")
2. Desde tu WhatsApp, envíale este mensaje exacto:
   **I allow callmebot to send me messages**
3. Te responderá con tu **API key** (algo como `123456`)
4. En Vercel, ve a **Settings > Environment Variables** y agrega:
   - `WHATSAPP_PHONE` = tu número con código de país sin el + (ej: `56912345678`)
   - `WHATSAPP_APIKEY` = la clave que te dio CallMeBot
   - `CRON_SECRET` = inventa una palabra secreta cualquiera
5. Haz un "Redeploy" para que tome las variables nuevas

**¿Cuándo llegan las alertas?** El sistema está configurado para enviarlas a las
12:00 UTC (8:00 AM en Chile, horario de invierno). Para cambiar la hora, edita el
archivo `vercel.json` y modifica el valor `"schedule"`. El formato es de cron:
`"0 12 * * *"` significa "a las 12:00 todos los días" (en hora UTC).

**Probar la alerta sin esperar:** abre en tu navegador
`https://TU-APP.vercel.app/api/alerta-diaria` (solo funciona si NO configuraste
CRON_SECRET; si lo configuraste, la prueba la hace Vercel automáticamente).

> Nota: CallMeBot es ideal para enviarte alertas a ti mismo. Si más adelante
> quieres notificar a muchos clientes, necesitarás la API oficial de WhatsApp
> (Meta) o Twilio, que tienen costo por mensaje.

---

## 🔧 Cambiar las palabras clave de búsqueda

Todas las palabras clave y comunas están en un solo archivo: `lib/filtros.js`
1. En GitHub, abre `lib/filtros.js`
2. Clic en el lápiz (editar)
3. Edita la lista `PALABRAS_CLAVE` o `TERMINOS_REGION`
4. Guarda (Commit changes). Vercel se actualiza solo en 1-2 minutos.

---

## 📁 Estructura del proyecto

```
mercado-transporte/
├── package.json
├── next.config.js
├── vercel.json              ← Configura la alerta diaria (cron)
├── .env.local.example
├── .gitignore
├── README.md
├── lib/
│   └── filtros.js           ← Palabras clave y comunas (edítalo aquí)
├── pages/
│   ├── _app.js
│   ├── index.js             ← La página principal con las 2 pestañas
│   └── api/
│       ├── oportunidades.js ← Licitaciones activas
│       ├── compraagil.js    ← Compras Ágiles (API v2, otro servidor)
│       ├── adjudicadas.js   ← Análisis de competencia + estimador de precios
│       └── alerta-diaria.js ← Alerta de WhatsApp (la dispara el cron)
└── styles/
    └── globals.css
```

---

## ⚠️ Notas importantes

- **Tu ticket y tus claves son privados:** nunca los subas a GitHub. Vercel los
  guarda de forma segura como variables de entorno.
- **Límite de la API:** 10.000 consultas al día. El uso normal está muy por debajo.
  El análisis de competencia usa más consultas (una por día + una por licitación),
  por eso conviene no abusar de rangos de 30 días muchas veces seguidas.
- **Cron en Vercel:** el plan gratuito (Hobby) permite ejecutar el cron una vez al
  día, que es justo lo que necesita la alerta diaria.
