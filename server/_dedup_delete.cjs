// Удаление дубликатов DefectHistory.
// Критерий дубликата: совпадают componentSN + actionType + status + description (trim+lower).
// Оригинал = запись с наименьшим id в группе. Остальные удаляются.
// Операция выполняется в одной транзакции.
const sql = require('mssql');

const config = {
    server: '10.69.19.59',
    port: 1433,
    database: 'TAU',
    user: 'TAUadmin',
    password: 'Tau74',
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 120000
};

(async () => {
    let pool;
    try {
        pool = await sql.connect(config);
        const res = await pool.request().query(`
      SELECT id, componentSN, actionType, status, description
      FROM DefectHistory
      ORDER BY id
    `);
        const rows = res.recordset;
        const norm = (s) => (s ?? '').trim().toLowerCase();

        const groups = new Map();
        for (const r of rows) {
            const key = `${r.componentSN}__${r.actionType}__${r.status}__${norm(r.description)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(r);
        }

        const deleteIds = [];
        const keepIds = new Set();
        for (const [, group] of groups.entries()) {
            if (group.length <= 1) continue;
            const sorted = [...group].sort((a, b) => a.id - b.id);
            keepIds.add(sorted[0].id);
            sorted.slice(1).forEach((d) => deleteIds.push(d.id));
        }

        console.log('=== ПЛАН УДАЛЕНИЯ ===');
        console.log('Всего записей в БД: ' + rows.length);
        console.log('К удалению (дубликаты): ' + deleteIds.length);
        console.log('К сохранению (оригиналы): ' + keepIds.size);

        // Проверки безопасности
        const keepSet = new Set(keepIds);
        const overlap = deleteIds.filter((id) => keepSet.has(id));
        if (overlap.length > 0) {
            console.error('ОШИБКА: пересечение keep/delete: ' + overlap.join(','));
            return;
        }
        const deleteSet = new Set(deleteIds);
        if (deleteSet.size !== deleteIds.length) {
            console.error('ОШИБКА: в списке на удаление есть повторы id');
            return;
        }
        const existingIds = new Set(rows.map((r) => r.id));
        const missing = deleteIds.filter((id) => !existingIds.has(id));
        if (missing.length > 0) {
            console.error('ОШИБКА: id не найдены в БД: ' + missing.join(','));
            return;
        }
        console.log('Проверки безопасности пройдены: пересечений нет, дублей id нет, все id существуют.');

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const req = new sql.Request(transaction);
            // Удаляем батчами по 500, чтобы не превысить лимиты параметров
            const BATCH = 500;
            let deleted = 0;
            for (let i = 0; i < deleteIds.length; i += BATCH) {
                const chunk = deleteIds.slice(i, i + BATCH);
                const placeholders = chunk.map((_, idx) => `@p${idx}`).join(',');
                const request = new sql.Request(transaction);
                chunk.forEach((id, idx) => request.input(`p${idx}`, sql.Int, id));
                const result = await request.query(`DELETE FROM DefectHistory WHERE id IN (${placeholders})`);
                deleted += result.rowsAffected[0];
            }
            await transaction.commit();
            console.log('Удалено строк: ' + deleted);

            // Проверка после удаления
            const after = await pool.request().query(`SELECT COUNT(*) AS cnt FROM DefectHistory`);
            console.log('Записей в БД после удаления: ' + after.recordset[0].cnt);

            // Проверка: все оригиналы на месте
            const keepCheck = await pool.request().query(
                `SELECT COUNT(*) AS cnt FROM DefectHistory WHERE id IN (${[...keepIds].join(',')})`
            );
            console.log('Оригиналов на месте: ' + keepCheck.recordset[0].cnt + ' (ожидалось ' + keepIds.size + ')');
        } catch (err) {
            console.error('Ошибка при удалении, откат транзакции: ' + (err && err.message ? err.message : err));
            await transaction.rollback();
        }
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
