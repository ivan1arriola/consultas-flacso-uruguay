const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config();

async function testGoogleConnection() {
  console.log('--- 🛡️ Iniciando Test de Conexión Google Drive ---');
  
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const sheetId = process.env.SPREADSHEET_REGISTROS_ID;

  if (!clientEmail || !privateKey || !folderId || !sheetId) {
    console.error('❌ Error: Faltan variables de entorno en el archivo .env');
    return;
  }

  console.log(`🔑 Usando cuenta: ${clientEmail}`);
  console.log(`📁 Carpeta objetivo: ${folderId}`);

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Probar acceso a la carpeta
    console.log('\n🔍 Probando acceso a la carpeta...');
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, capabilities'
    });
    console.log(`✅ Carpeta encontrada: "${folder.data.name}"`);

    // 2. Probar acceso al Spreadsheet
    console.log('\n🔍 Probando acceso al Spreadsheet de registros...');
    const ss = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties/title'
    });
    console.log(`✅ Spreadsheet encontrado: "${ss.data.properties.title}"`);

    // 3. Probar ESCRITURA (Crear archivo temporal)
    console.log('\n📝 Probando permisos de ESCRITURA...');
    const testFile = await drive.files.create({
      requestBody: {
        name: 'TEST_CONEXION_DELETE_ME.txt',
        parents: [folderId],
        mimeType: 'text/plain'
      },
      media: {
        mimeType: 'text/plain',
        body: 'Este es un archivo de prueba generado por el sistema de analiticas.'
      }
    });
    console.log(`✅ Archivo de prueba creado con éxito (ID: ${testFile.data.id})`);

    // 4. Limpieza (Borrar archivo temporal)
    console.log('\n🧹 Limpiando (borrando archivo de prueba)...');
    await drive.files.delete({ fileId: testFile.data.id });
    console.log('✅ Limpieza completada.');

    console.log('\n✨ --- TEST FINALIZADO CON ÉXITO --- ✨');
    console.log('La cuenta de servicio tiene todos los permisos necesarios.');

  } catch (error) {
    console.error('\n❌ --- TEST FALLIDO --- ❌');
    console.error('Mensaje de error:', error.message);
    if (error.errors) {
      console.error('Detalles:', JSON.stringify(error.errors, null, 2));
    }
  }
}

testGoogleConnection();
