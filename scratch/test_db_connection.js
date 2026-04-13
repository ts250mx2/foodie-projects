import pool from '../src/lib/db.js';

async function test() {
    try {
        console.log("Iniciando prueba de conexión...");
        const [rows] = await pool.execute("SELECT COUNT(*) as total FROM tblProductos");
        console.log("Conexión exitosa. Total productos:", rows[0].total);
        process.exit(0);
    } catch (err) {
        console.error("Error en la prueba:", err.message);
        process.exit(1);
    }
}

test();
