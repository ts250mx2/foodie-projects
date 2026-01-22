const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Read .env.local file
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.trim();
        }
    });
    return env;
}

async function checkLogo64Field() {
    let connection;
    try {
        const env = loadEnv();

        connection = await mysql.createConnection({
            host: env.DB_HOST,
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: 'BDFoodieProjects'
        });

        console.log('Connected to BDFoodieProjects database');

        // Check the current data type of Logo64 column
        const [columns] = await connection.query(
            `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = 'BDFoodieProjects' 
             AND TABLE_NAME = 'tblProyectos' 
             AND COLUMN_NAME = 'Logo64'`
        );

        console.log('\nCurrent Logo64 column info:');
        console.log(columns);

        if (columns.length > 0) {
            const column = columns[0];
            if (column.DATA_TYPE === 'text' || column.DATA_TYPE === 'varchar') {
                console.log('\n⚠️  Logo64 is currently', column.DATA_TYPE);
                console.log('Changing to LONGTEXT to support large Base64 images...');

                await connection.query(
                    'ALTER TABLE tblProyectos MODIFY COLUMN Logo64 LONGTEXT'
                );

                console.log('✅ Logo64 column updated to LONGTEXT');
            } else if (column.DATA_TYPE === 'longtext') {
                console.log('\n✅ Logo64 is already LONGTEXT - no changes needed');
            }
        } else {
            console.log('\n❌ Logo64 column not found in tblProyectos');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkLogo64Field();
