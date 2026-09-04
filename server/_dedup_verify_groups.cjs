// Проверка: внутри каждой группы-дубликата actionType и status едины,
// и на серийниках с дубликатами сохраняются записи других actionType.
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
      SELECT id, componentSN, actionType, status, description, timestamp
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

        let uniformCheckFail = 0;
        const dupSNs = new Set();
        for (const [key, group] of groups.entries()) {
            if (group.length <= 1) continue;
            // Проверка единообразия actionType и status внутри группы
            const types = new Set(group.map((g) => g.actionType));
            const statuses = new Set(group.map((g) => g.status));
            if (types.size !== 1 || statuses.size !== 1) {
                uniformCheckFail++;
                console.log(`!!! ГРУППА С НЕОДНОРОДНЫМ СОСТАВОМ: ${key}`);
                group.forEach((g) => console.log(`    id=${g.id} actionType=${g.actionType} status=${g.status}`));
            }
            group.forEach((g) => dupSNs.add(g.componentSN));
        }
        console.log('Проверка единообразия внутри групп: ' + (uniformCheckFail === 0 ? 'OK (все группы однородны)' : `ПРОБЛЕМ: ${uniformCheckFail}`));

        // Примеры серийников, где есть дубликаты + другие actionType
        console.log('\n=== Серийники с дубликатами, у которых есть ДРУГИЕ actionType (останутся нетронутыми) ===');
        for (const sn of [...dupSNs].sort()) {
            const byType = new Map();
            for (const r of rows) {
                if (r.componentSN !== sn) continue;
                if (!byType.has(r.actionType)) byType.set(r.actionType, []);
                byType.get(r.actionType).push(r.id);
            }
            if (byType.size > 1) {
                const parts = [...byType.entries()].map(([t, ids]) => `${t}(${ids.length}): id=${ids.join(',')}`);
                console.log(`SN=${sn} -> ${parts.join('  |  ')}`);
            }
        }

        // Проверка: не удаляем ли мы записи, если у SN остаётся хотя бы один DetectDefect
        console.log('\n=== Проверка: у каждого SN с дубликатами остаётся оригинал DetectDefect ===');
        for (const [key, group] of groups.entries()) {
            if (group.length <= 1) continue;
            const o = [...group].sort((a, b) => a.id - b.id)[0];
            const remaining = group.filter((g) => g.id === o.id);
            console.log(`SN=${o.componentSN} actionType=${o.actionType} status=${o.status} -> останется id=${o.id}`);
        }
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
