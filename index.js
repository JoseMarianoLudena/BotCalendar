require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

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

// 📌 Crear cita
app.post('/book', async (req, res) => {
  if (!tokens) return res.status(401).send('No autenticado con Google');
  oauth2Client.setCredentials(tokens);

  const { summary, date, patientName } = req.body;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = new Date(date);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: summary || `Cita con ${patientName}`,
      start: { dateTime: start.toISOString(), timeZone: 'America/Lima' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Lima' },
    },
  });

  res.json({ status: 'cita_agendada', id: response.data.id });
});

app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});
