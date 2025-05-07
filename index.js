// 📅 Consultar disponibilidad
app.get('/availability', async (req, res) => {
  if (!tokens) return res.status(401).send('No autenticado con Google');
  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const { date } = req.query;

  try {
    // Verificamos si la fecha es válida
    const start = new Date(date);
    if (isNaN(start.getTime())) { // Si la fecha no es válida, respondemos con un error
      return res.status(400).json({ error: 'La fecha proporcionada no es válida. Asegúrate de usar el formato correcto (yyyy-MM-ddTHH:mm:ss).' });
    }

    const end = new Date(start.getTime() + 30 * 60 * 1000); // Cita de 30 minutos

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
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error.message || error);
    res.status(500).json({ error: 'Hubo un problema al verificar la disponibilidad.' });
  }
});

// 📌 Crear cita
app.post('/book', async (req, res) => {
  if (!tokens) return res.status(401).send('No autenticado con Google'); // Verifica si los tokens de Google están presentes
  oauth2Client.setCredentials(tokens); // Establece las credenciales del cliente OAuth2

  // Extrae los datos del cuerpo de la solicitud
  const { summary, date, patientName } = req.body;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    // Verificamos si la fecha es válida
    const start = new Date(date);
    if (isNaN(start.getTime())) { // Si la fecha no es válida, respondemos con un error
      return res.status(400).json({ error: 'La fecha proporcionada no es válida. Asegúrate de usar el formato correcto (yyyy-MM-ddTHH:mm:ss).' });
    }

    const end = new Date(start.getTime() + 30 * 60 * 1000); // La cita dura 30 minutos

    // Inserta el evento en Google Calendar
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
    console.error('Error al crear la cita:', error.message || error);
    res.status(500).json({ 
      status: 'error', 
      message: 'No se pudo agendar la cita. Por favor, intenta más tarde.' 
    });
  }
});
