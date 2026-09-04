// Генерирует читаемый отчёт о дубликатах DefectHistory в файл _dedup_report.txt
const sql = require('mssql');
const fs = require('fs');

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
          SELECT id, componentSN, actionType, status, description, timestamp, [user] AS u
          FROM DefectHistory
          ORDER BY id
        `);
        const rows = res.recordset;
        const norm = (s) => (s ?? '').trim().toLowerCase();
        const fmtTs = (t) => {
            const d = new Date(t);
            return d.toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' });
        };

        const groups = new Map();
        for (const r of rows) {
            const key = `${r.componentSN}__${r.actionType}__${r.status}__${norm(r.description)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(r);
        }

        const dupGroups = [];
        let totalDelete = 0;
        for (const [, group] of groups.entries()) {
            if (group.length <= 1) continue;
            const sorted = [...group].sort((a, b) => a.id - b.id);
            const original = sorted[0];
            const dups = sorted.slice(1);
            totalDelete += dups.length;
            dupGroups.push({ original, dups });
        }
        dupGroups.sort((a, b) => a.original.componentSN.localeCompare(b.original.componentSN));

        let out = '';
        out += '======================================================\n';
        out += 'ОТЧЁТ ПО ДУБЛИКАТАМ DefectHistory (SQL Server: 10.69.19.59/TAU)\n';
        out += '======================================================\n';
        out += `Всего записей: ${rows.length}\n`;
        out += `Групп с дубликатами: ${dupGroups.length}\n`;
        out += `Записей к УДАЛЕНИЮ: ${totalDelete}\n`;
        out += `Оригиналов к СОХРАНЕНИЮ: ${dupGroups.length}\n`;
        out += 'Временные метки указаны по времени Екатеринбурга (UTC+5).\n';
        out += '======================================================\n\n';

        dupGroups.forEach((g, i) => {
            const o = g.original;
            out += `[${i + 1}] ГРУППА: SN=${o.componentSN} | actionType=${o.actionType} | status=${o.status}\n`;
            out += `    Описание: ${JSON.stringify(o.description)}\n`;
            out += `    >>> СОХРАНЯЕМ (оригинал): id=${o.id} | ${fmtTs(o.timestamp)} | user=${o.u ?? ''}\n`;
            g.dups.forEach((d) => {
                out += `    >>> УДАЛЯЕМ:             id=${d.id} | ${fmtTs(d.timestamp)} | user=${d.u ?? ''}\n`;
            });
            out += '\n';
        });

        out += '================ ИТОГ ================\n';
        out += `УДАЛИТЬ (${totalDelete} шт): ` + dupGroups.flatMap((g) => g.dups.map((d) => d.id)).join(',') + '\n';
        out += `СОХРАНИТЬ (${dupGroups.length} шт): ` + dupGroups.map((g) => g.original.id).join(',') + '\n';

        fs.writeFileSync('_dedup_report.txt', out, 'utf8');
        console.log('REPORT_WRITTEN: ' + fs.statSync('_dedup_report.txt').size + ' bytes');
        console.log('GROUPS=' + dupGroups.length + ' DELETE=' + totalDelete);
    } catch (err) {
        console.error('ERROR: ' + (err && err.message ? err.message : err));
    } finally {
        if (pool) await pool.close();
    }
})();
