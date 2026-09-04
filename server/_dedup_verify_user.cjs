// Проверка фактического значения колонки [user] для ряда id
const sql = require('mssql');

const config = {
    server: '10.69.19.59',
    port: 1433,
    database: 'TAU',
    user: 'TAUadmin',
    password: 'Tau74',
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 30000
};

(async () => {
    let pool;
    try {
        pool = await sql.connect(config);
        const res = await pool.request().query(`
      SELECT id, componentSN, [user] AS realUser, actionType, status
      FROM DefectHistory
      WHERE id IN (2627, 2632, 2628, 2706, 2707, 2708, 2082, 2037, 2074)
      ORDER BY id
    `);
        res.recordset.forEach((r) =>
            console.log(`id=${r.id} SN=${r.componentSN} actionType=${r.actionType} realUser=${JSON.stringify(r.realUser)}`)
        );
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
