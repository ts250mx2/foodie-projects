const mysql = require('mysql2/promise');

async function listDbs() {
    const connection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio'
    });

    try {
        const [dbs] = await connection.query('SHOW DATABASES');
        const dbNames = dbs.map(d => d.Database);

        console.log('Search for Foodie or Integra:');
        const filtered = dbNames.filter(name =>
            name.toLowerCase().includes('foodie') ||
            name.toLowerCase().includes('integra')
        );
        console.log(filtered);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

listDbs();
