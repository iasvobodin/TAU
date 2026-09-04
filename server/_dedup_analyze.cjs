// Анализ дубликатов в таблице DefectHistory (SQL Server).
// Группировка по componentSN + actionType + status + нормализованному description.
// Оригинал = запись с наименьшим id (самая ранняя). Остальные в группе - дубликаты.
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
        const res = await pool.request().query(`
      SELECT id, componentSN, actionType, status, description, timestamp, user
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

        let totalDupGroups = 0;
        let totalDupRows = 0;
        const keepIds = new Set();
        const deleteRows = [];

        const groupsWithDuplicates = [];
        for (const [key, group] of groups.entries()) {
            if (group.length <= 1) continue;
            const sorted = [...group].sort((a, b) => a.id - b.id);
            const original = sorted[0];
            const dups = sorted.slice(1);
            keepIds.add(original.id);
            deleteRows.push(...dups);
            totalDupGroups++;
            totalDupRows += dups.length;
            groupsWithDuplicates.push({ key, original, dups });
        }

        console.log('==================================================');
        console.log('АНАЛИЗ ДУБЛИКАТОВ DefectHistory');
        console.log('Всего записей: ' + rows.length);
        console.log('Групп с дубликатами: ' + totalDupGroups);
        console.log('Записей к УДАЛЕНИЮ: ' + totalDupRows);
        console.log('Записей к СОХРАНЕНИЮ (оригиналы): ' + keepIds.size);
        console.log('==================================================\n');

        // Сортируем группы по SN
        groupsWithDuplicates.sort((a, b) => a.key.localeCompare(b.key));

        for (const g of groupsWithDuplicates) {
            console.log(`--- ГРУППА: SN=${g.original.componentSN} | actionType=${g.original.actionType} | status=${g.original.status}`);
            console.log(`    description: ${JSON.stringify(g.original.description)}`);
            console.log(`    СОХРАНЯЕМ (оригинал):  id=${g.original.id}  user=${g.original.user}  timestamp=${g.original.timestamp.toISOString?.() ?? g.original.timestamp}`);
            for (const d of g.dups) {
                console.log(`    УДАЛЯЕМ (дубликат):   id=${d.id}  user=${d.user}  timestamp=${d.timestamp.toISOString?.() ?? d.timestamp}`);
            }
            console.log('');
        }

        console.log('=== ИТОГ ===');
        console.log('DELETE_IDS=' + deleteRows.map((d) => d.id).join(','));
        console.log('KEEP_IDS=' + [...keepIds].join(','));
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
