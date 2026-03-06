const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim();
    }
});

const categories = [
    ['Carne de Res', 0, 1, 'es', '🥩'],
    ['Carne de Cerdo', 0, 1, 'es', '🐖'],
    ['Aves', 0, 1, 'es', '🍗'],
    ['Otras Carnes', 0, 1, 'es', '🍖'],
    ['Pescados', 0, 1, 'es', '🐟'],
    ['Mariscos', 0, 1, 'es', '🦐'],
    ['Carnes Frías', 0, 1, 'es', '🌭'],
    ['Lácteos y Derivados', 0, 1, 'es', '🧀'],
    ['Cereales, granos y especias', 0, 1, 'es', '🌾'],
    ['Frutas y Verduras', 0, 1, 'es', '🥦'],
    ['Frutos secos y semillas', 0, 1, 'es', '🥜'],
    ['Abarrotes', 0, 1, 'es', '🥫'],
    ['Bebidas no alcohólicas', 0, 1, 'es', '🥤'],
    ['Bebidas alcohólicas', 0, 1, 'es', '🍷'],
    ['Desechables y empaques', 0, 2, 'es', '🥡'],
    ['Productos de limpieza y sanitización', 0, 0, 'es', '🧼'],
    ['Papelería', 0, 0, 'es', '📎']
];

async function run() {
    try {
        const conn = await mysql.createConnection({
            host: envVars.DB_HOST,
            user: envVars.DB_USER,
            password: envVars.DB_PASSWORD,
            database: 'BDFoodieProjects'
        });

        console.log("Connected to BDFoodieProjects...");

        // Get max IdCategoria
        const [rows] = await conn.query('SELECT COALESCE(MAX(IdCategoria), 0) AS maxId FROM tblCategorias');
        let currentId = rows[0].maxId;

        for (const cat of categories) {
            currentId++;
            const [Categoria, Status, IdModuloRecetario, Idioma, ImagenCategoria] = cat;

            const query = `
                INSERT INTO tblCategorias 
                (IdCategoria, Categoria, Status, IdModuloRecetario, Idioma, ImagenCategoria) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            await conn.query(query, [currentId, Categoria, Status, IdModuloRecetario, Idioma, ImagenCategoria]);
            console.log(`Inserted: ${Categoria} with icon ${ImagenCategoria} (ID: ${currentId})`);
        }

        await conn.end();
        console.log("Done inserting categories.");

    } catch (e) {
        console.error("Error connecting or inserting:", e);
    }
}

run();
