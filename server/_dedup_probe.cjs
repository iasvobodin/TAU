// Временный скрипт: проверка подключения к SQL Server и структуры таблицы DefectHistory
const sql = require('mssql');

const config = {
    server: '10.69.19.59',
    port: 1433,
    database: 'TAU',
    user: 'TAUadmin',
    password: 'Tau74',
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    connectionTimeout: 15000,
    requestTimeout: 30000
};

(async () => {
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('CONNECTED_OK');

        // Колонки таблицы DefectHistory
        const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DefectHistory'
      ORDER BY ORDINAL_POSITION
    `);
        console.log('=== COLUMNS ===');
        cols.recordset.forEach((c) => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));

        // Сколько всего записей
        const total = await pool.request().query(`SELECT COUNT(*) AS cnt FROM DefectHistory`);
        console.log('TOTAL_ROWS=' + total.recordset[0].cnt);

        // Пример данных
        const sample = await pool.request().query(`
      SELECT TOP 20 *
      FROM DefectHistory
      ORDER BY timestamp DESC
    `);
        console.log('=== SAMPLE ===');
        sample.recordset.forEach((r) =>
            console.log(
                JSON.stringify({ id: r.id, componentSN: r.componentSN, actionType: r.actionType, status: r.status, description: r.description, timestamp: r.timestamp, user: r.user })
            )
        );
    } catch (err) {
        console.error('CONNECT_ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
