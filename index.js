// Agregar la ruta de prueba antes de inicializar todo
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Ruta de prueba para verificar si el servidor está funcionando
app.get('/', (req, res) => {
  res.send('¡Servidor funcionando! 🎉');
});

// Inicialización del cliente OAuth2 de Google
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let tokens = null; // Aquí guardaremos los tokens de acceso

// 🔗 Ruta para iniciar autenticación
app.get('/auth', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  res.redirect(url);
});

// 🔐 Ruta para recibir token de Google después de autorizar
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens: newTokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(newTokens);
  tokens = newTokens;
  res.send('Autenticación completada. Puedes cerrar esta ventana.');
});

// 📅 Consultar disponibilidad
app.get('/availability', async (req, res) => {
  if (!tokens) return res.status(401).send('No autenticado con Google');
  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const { date } = req.query;

  const start = new Date(date);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // Cita de 30 mins

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: 'America/Lima',
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = response.data.calendars.primary.busy;
  const isAvailable = busySlots.length === 0;
  res.json({ available: isAvailable });
});
/*----------------------------------------------------------------------------- */
// 📌 Crear cita
app.post('/book', async (req, res) => {
  if (!tokens) return res.status(401).send('No autenticado con Google'); // Verifica si los tokens de Google están presentes
  oauth2Client.setCredentials(tokens); // Establece las credenciales del cliente OAuth2

  // Extrae los datos del cuerpo de la solicitud
  const { summary, date, patientName } = req.body;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Configura el inicio y final de la cita
  const start = new Date(date); // La fecha de inicio
  const end = new Date(start.getTime() + 30 * 60 * 1000); // La cita dura 30 minutos

  // Inserta el evento en Google Calendar
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: summary || `Cita con ${patientName}`, // Si no se pasa resumen, usa un valor predeterminado
        start: { dateTime: start.toISOString(), timeZone: 'America/Lima' },
        end: { dateTime: end.toISOString(), timeZone: 'America/Lima' },
      },
    });

    // Devuelve la respuesta con el ID de la cita y el estado
    res.json({ 
      status: 'cita_agendada', 
      citaId: response.data.id, 
      message: 'Cita creada exitosamente.' 
    });
  } catch (error) {
    console.error('Error al crear la cita:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'No se pudo agendar la cita.' 
    });
  }
});

/*----------------------------------------------------------------------------- */

// Configuración del puerto y el servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});
