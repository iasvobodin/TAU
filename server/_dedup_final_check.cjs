// Финальная проверка: дубликатов в DefectHistory больше нет
const sql = require('mssql');

const config = {
    server: '10.69.19.59',
    port: 1433,
    database: 'TAU',
    user: 'TAUadmin',
    password: 'Tau74',
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 60000
};

(async () => {
    let pool;
    try {
        pool = await sql.connect(config);
        const total = await pool.request().query(`SELECT COUNT(*) AS cnt FROM DefectHistory`);
        console.log('Всего записей: ' + total.recordset[0].cnt);

        const res = await pool.request().query(`
          SELECT componentSN, actionType, status, LOWER(LTRIM(RTRIM(CAST(ISNULL(description,'') AS NVARCHAR(MAX))))) AS descr, COUNT(*) AS cnt
          FROM DefectHistory
          GROUP BY componentSN, actionType, status, LOWER(LTRIM(RTRIM(CAST(ISNULL(description,'') AS NVARCHAR(MAX)))))
          HAVING COUNT(*) > 1
          ORDER BY cnt DESC
        `);
        if (res.recordset.length === 0) {
            console.log('ДУБЛИКАТОВ НЕТ: все группы по SN+actionType+status+description уникальны.');
        } else {
            console.log('Остались дубликаты (' + res.recordset.length + ' групп):');
            res.recordset.forEach((r) =>
                console.log(`SN=${r.componentSN} actionType=${r.actionType} status=${r.status} descr="${r.descr}" -> ${r.cnt}`)
            );
        }

        // Проверка примеров пользователя
        const examples = await pool.request().query(`
      SELECT id, componentSN, actionType, status, description, timestamp
      FROM DefectHistory
      WHERE componentSN IN ('26012607','26012626','26012627','26013322')
      ORDER BY componentSN, id
    `);
        console.log('\n=== Примеры пользователя после очистки ===');
        examples.recordset.forEach((r) =>
            console.log(`id=${r.id} SN=${r.componentSN} ${r.actionType} [${r.status}] "${r.description}"`)
        );
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
