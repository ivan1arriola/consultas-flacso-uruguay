// Usando fetch nativo de Node.js

async function resetAndMigrate() {
  console.log('--- Iniciando Reinicio y Migración Total ---');
  try {
    const response = await fetch('http://localhost:3000/api/admin/migrate-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceReset: true })
    });
    
    const result = await response.json();
    console.log('Resultado:', result);
    
    if (result.success) {
      console.log('✅ Éxito: Base de datos reseteada y datos migrados con formato legacy.');
    } else {
      console.error('❌ Error:', result.message);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('Asegúrate de que el servidor esté corriendo en http://localhost:3000');
  }
}

resetAndMigrate();
