// TAU Launcher
// Компиляция: csc.exe /reference:System.Web.Extensions.dll /out:..\Launcher.exe Program.cs
// Компиляция (x64): csc.exe /platform:x64 /reference:System.Web.Extensions.dll /out:..\Launcher.exe Program.cs

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

class Program
{
    const string AppBinaryName = "TAU-win_x64.exe";
    const string ConfigFileName = "config.json";
    const string ManifestFile = "updates/manifest.json";
    const string VersionFileName = "version.json";
    const string UpdateFlagFile = "app-update.json";

    static string LocalAppData
    {
        get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); }
    }

    static string UserName
    {
        get { return Environment.UserName; }
    }

    static string ComputerName
    {
        get { return Environment.MachineName; }
    }

    static string LocalRoot
    {
        get { return Path.Combine(LocalAppData, "TAU", SanitizeFileName(UserName) + "_" + SanitizeFileName(ComputerName)); }
    }

    static string LocalBinaryPath
    {
        get { return Path.Combine(LocalRoot, AppBinaryName); }
    }

    static string LocalVersionPath
    {
        get { return Path.Combine(LocalRoot, VersionFileName); }
    }

    static string LocalConfigPath
    {
        get { return Path.Combine(LocalRoot, ConfigFileName); }
    }

    static string LocalUpdateFlagPath
    {
        get { return Path.Combine(LocalRoot, UpdateFlagFile); }
    }

    static string LauncherVersion = "1.0.0";

    public static void Main(string[] args)
    {
        try
        {
            Run(args);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[LAUNCHER] FATAL: " + ex.Message);
            Console.Error.WriteLine("[LAUNCHER] StackTrace: " + ex.StackTrace);
            ShowErrorDialog("Ошибка запуска: " + ex.Message);
            Environment.Exit(2);
        }
    }

    static void Run(string[] args)
    {
        // Справка
        if (args.Length > 0 && (args[0] == "--help" || args[0] == "-h" || args[0] == "/?"))
        {
            ShowHelp();
            return;
        }

        // Версия лаунчера
        if (args.Length > 0 && args[0] == "--version")
        {
            Console.WriteLine(LauncherVersion);
            return;
        }

        bool forceUpdate = args.Length > 0 && args[0] == "--update";
        string requestedVersion = null;
        if (args.Length > 1 && args[0] == "--version")
            requestedVersion = args[1];

        // Путь к сетевой шаре — там, где лежит Launcher.exe
        string networkBase = AppDomain.CurrentDomain.BaseDirectory;
        // Нормализация: убираем trailing slash
        networkBase = networkBase.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        Console.WriteLine("[LAUNCHER] v" + LauncherVersion);
        Console.WriteLine("[LAUNCHER] Network base: " + networkBase);
        Console.WriteLine("[LAUNCHER] Local root:   " + LocalRoot);

        // Подменяем CurrentDirectory на SystemRoot, чтобы не было ошибки UNC
        string systemRoot = Environment.GetEnvironmentVariable("SystemRoot") ?? @"C:\Windows";
        try { Environment.CurrentDirectory = systemRoot; } catch { }

        // 1. Читаем манифест
        ManifestData manifest = ReadManifest(networkBase);
        if (manifest == null)
        {
            Console.WriteLine("[LAUNCHER] Манифест не найден. Запускаю бинарник из сетевой папки (fallback).");
            RunFromNetwork(networkBase);
            return;
        }

        string targetVersion = requestedVersion ?? manifest.Latest;
        Console.WriteLine("[LAUNCHER] Target version: " + targetVersion);

        // 2. Создаём локальную папку
        try { Directory.CreateDirectory(LocalRoot); }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[LAUNCHER] Не удалось создать локальную папку: " + ex.Message);
            RunFromNetwork(networkBase);
            return;
        }

        // 3. Проверяем текущую локальную версию
        string localVersion = ReadLocalVersion();
        Console.WriteLine("[LAUNCHER] Local version: " + (localVersion ?? "(none)"));

        bool needUpdate = forceUpdate
            || localVersion == null
            || CompareVersions(targetVersion, localVersion) > 0
            || !File.Exists(LocalBinaryPath);

        if (needUpdate)
        {
            Console.WriteLine("[LAUNCHER] Обновление необходимо. Копирую файлы...");
            if (!CopyBinary(networkBase, targetVersion))
            {
                Console.WriteLine("[LAUNCHER] Не удалось скопировать бинарник. Запускаю fallback.");
                RunFromNetwork(networkBase);
                return;
            }
            CopyConfig(networkBase);
            WriteLocalVersion(targetVersion);
        }
        else
        {
            Console.WriteLine("[LAUNCHER] Локальная версия актуальна.");
            // Всё равно обновляем config.json на случай, если он изменился
            CopyConfig(networkBase);
        }

        // 4. Запускаем локальный бинарник
        RunLocalBinary();
    }

    // ─── Manifest ──────────────────────────────────────────────────────────

    class ManifestData
    {
        public string Latest { get; set; }
        public List<ManifestVersion> Versions { get; set; }
    }

    class ManifestVersion
    {
        public string Version { get; set; }
        public string Published { get; set; }
        public string Changelog { get; set; }
        public bool Critical { get; set; }
    }

    static ManifestData ReadManifest(string networkBase)
    {
        string manifestPath = Path.Combine(networkBase, ManifestFile);
        if (!File.Exists(manifestPath))
            return null;

        try
        {
            string json = File.ReadAllText(manifestPath);
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            ManifestData result = serializer.Deserialize<ManifestData>(json);
            return result;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[LAUNCHER] Ошибка чтения манифеста: " + ex.Message);
            return null;
        }
    }

    // ─── Version management ────────────────────────────────────────────────

    static string ReadLocalVersion()
    {
        if (!File.Exists(LocalVersionPath))
            return null;

        try
        {
            string json = File.ReadAllText(LocalVersionPath);
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            Dictionary<string, object> data = serializer.Deserialize<Dictionary<string, object>>(json);
            if (data != null && data.ContainsKey("version"))
                return data["version"] as string;
            return null;
        }
        catch
        {
            return null;
        }
    }

    static void WriteLocalVersion(string version)
    {
        var data = new Dictionary<string, object>();
        data["version"] = version;
        data["installed"] = DateTime.UtcNow.ToString("O");
        data["source"] = "updates/v" + version + "/" + AppBinaryName;

        JavaScriptSerializer serializer = new JavaScriptSerializer();
        string json = serializer.Serialize(data);

        File.WriteAllText(LocalVersionPath, json);
        Console.WriteLine("[LAUNCHER] version.json записан: v" + version);
    }

    // ─── File operations ───────────────────────────────────────────────────

    static bool CopyBinary(string networkBase, string version)
    {
        string sourceDir = Path.Combine(networkBase, "updates", "v" + version);
        string sourcePath = Path.Combine(sourceDir, AppBinaryName);

        if (!File.Exists(sourcePath))
        {
            // Пробуем прямой путь к бинарнику на шаре (если это сам TAU-win_x64.exe)
            string fallbackPath = Path.Combine(networkBase, AppBinaryName);
            if (File.Exists(fallbackPath))
            {
                Console.WriteLine("[LAUNCHER] Бинарник версии " + version + " не найден в updates/. Использую корневой: " + fallbackPath);
                sourcePath = fallbackPath;
            }
            else
            {
                Console.Error.WriteLine("[LAUNCHER] Бинарник не найден: " + sourcePath);
                return false;
            }
        }

        Console.WriteLine("[LAUNCHER] Копирую: " + sourcePath + " -> " + LocalBinaryPath);

        // Если локальный файл существует — пытаемся удалить или переименовать
        if (File.Exists(LocalBinaryPath))
        {
            try { File.Delete(LocalBinaryPath); }
            catch
            {
                Console.WriteLine("[LAUNCHER] Не удалось удалить старый бинарник. Пробую переименовать...");
                string backupPath = LocalBinaryPath + ".bak";
                try
                {
                    if (File.Exists(backupPath)) File.Delete(backupPath);
                    File.Move(LocalBinaryPath, backupPath);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("[LAUNCHER] Не удалось переименовать: " + ex.Message);
                    return false;
                }
            }
        }

        try
        {
            File.Copy(sourcePath, LocalBinaryPath, overwrite: true);
            Console.WriteLine("[LAUNCHER] Бинарник скопирован успешно.");
            return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[LAUNCHER] Ошибка копирования бинарника: " + ex.Message);
            return false;
        }
    }

    static string MakeUncPath(string networkBase, string relativePath)
    {
        // Если путь уже UNC — не меняем
        if (relativePath.StartsWith("\\\\") || relativePath.StartsWith("//"))
            return relativePath;

        // Если путь абсолютный (C:\) — не меняем
        if (relativePath.Length > 1 && relativePath[1] == ':')
            return relativePath;

        // Убираем ведущую точку и слеш
        string clean = relativePath.TrimStart('.', '/', '\\');
        // Строим UNC
        string base = networkBase.Replace("\\", "/");
        return base + "/" + clean;
    }

    static void CopyConfig(string networkBase)
    {
        string sourceConfig = Path.Combine(networkBase, ConfigFileName);
        if (!File.Exists(sourceConfig))
        {
            Console.WriteLine("[LAUNCHER] " + ConfigFileName + " не найден на шаре. Пропускаю.");
            return;
        }

        Console.WriteLine("[LAUNCHER] Копирую config: " + sourceConfig + " -> " + LocalConfigPath);

        string configJson = File.ReadAllText(sourceConfig);
        bool modified = false;

        try
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            Dictionary<string, object> root = serializer.Deserialize<Dictionary<string, object>>(configJson);

            if (root == null)
            {
                File.Copy(sourceConfig, LocalConfigPath, overwrite: true);
                return;
            }

            // Исправляем пути в секции "paths"
            if (root.ContainsKey("paths"))
            {
                Dictionary<string, object> paths = root["paths"] as Dictionary<string, object>;
                if (paths != null)
                {
                    string[] relativeKeys = { "convertFolder", "resourcesPath" };
                    foreach (string key in relativeKeys)
                    {
                        if (paths.ContainsKey(key))
                        {
                            string val = paths[key] as string;
                            if (val != null && !val.StartsWith("\\\\") && !val.StartsWith("//") && !(val.Length > 1 && val[1] == ':'))
                            {
                                string unc = MakeUncPath(networkBase, val);
                                paths[key] = unc;
                                Console.WriteLine("[LAUNCHER] paths." + key + " заменён на: " + unc);
                                modified = true;
                            }
                        }
                    }
                }
            }

            // Добавляем/обновляем секцию "sharedPaths" с UNC-путями
            Dictionary<string, object> shared = new Dictionary<string, object>();
            string baseUnc = networkBase.Replace("\\", "/");
            shared["convertFolder"] = baseUnc + "/convertFolder";
            shared["storage"] = baseUnc + "/storage";
            shared["tmp"] = baseUnc + "/tmp";
            root["sharedPaths"] = shared;
            modified = true;

            if (modified)
            {
                string newJson = serializer.Serialize(root);
                newJson = FormatJson(newJson);
                File.WriteAllText(LocalConfigPath, newJson);
                Console.WriteLine("[LAUNCHER] config.json записан с UNC-путями.");
            }
            else
            {
                File.Copy(sourceConfig, LocalConfigPath, overwrite: true);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[LAUNCHER] Ошибка обработки config.json: " + ex.Message);
            File.Copy(sourceConfig, LocalConfigPath, overwrite: true);
        }
    }

    /// <summary>
    /// Простое форматирование JSON (делает читаемый вывод)
    /// </summary>
    static string FormatJson(string json)
    {
        int indent = 0;
        bool quoted = false;
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < json.Length; i++)
        {
            char ch = json[i];
            switch (ch)
            {
                case '"':
                    quoted = !quoted;
                    sb.Append(ch);
                    break;
                case '{':
                case '[':
                    sb.Append(ch);
                    if (!quoted)
                    {
                        sb.AppendLine();
                        indent++;
                        sb.Append(new string(' ', indent * 2));
                    }
                    break;
                case '}':
                case ']':
                    if (!quoted)
                    {
                        sb.AppendLine();
                        indent--;
                        sb.Append(new string(' ', indent * 2));
                    }
                    sb.Append(ch);
                    break;
                case ',':
                    sb.Append(ch);
                    if (!quoted)
                    {
                        sb.AppendLine();
                        sb.Append(new string(' ', indent * 2));
                    }
                    break;
                case ':':
                    sb.Append(ch);
                    if (!quoted)
                        sb.Append(' ');
                    break;
                default:
                    sb.Append(ch);
                    break;
            }
        }

        return sb.ToString();
    }

    // ─── Run ───────────────────────────────────────────────────────────────

    static void RunLocalBinary()
    {
        if (!File.Exists(LocalBinaryPath))
        {
            Console.Error.WriteLine("[LAUNCHER] Локальный бинарник не найден: " + LocalBinaryPath);
            return;
        }

        Console.WriteLine("[LAUNCHER] Запускаю: " + LocalBinaryPath);

        ProcessStartInfo psi = new ProcessStartInfo
        {
            FileName = LocalBinaryPath,
            UseShellExecute = false,
            WorkingDirectory = LocalRoot,
            Arguments = ""
        };

        using (Process process = Process.Start(psi))
        {
            if (process == null)
            {
                Console.Error.WriteLine("[LAUNCHER] Не удалось запустить процесс.");
                return;
            }

            Console.WriteLine("[LAUNCHER] Процесс запущен, PID: " + process.Id);
            Console.WriteLine("[LAUNCHER] Launcher завершает работу.");
        }
    }

    static void RunFromNetwork(string networkBase)
    {
        // Fallback: запускаем бинарник прямо из сетевой папки
        string binaryPath = Path.Combine(networkBase, AppBinaryName);
        if (!File.Exists(binaryPath))
        {
            Console.Error.WriteLine("[LAUNCHER] Бинарник не найден: " + binaryPath);
            return;
        }

        // Меняем Working Directory на SystemRoot, чтобы избежать ошибки UNC
        string systemRoot = Environment.GetEnvironmentVariable("SystemRoot") ?? @"C:\Windows";
        Environment.CurrentDirectory = systemRoot;

        ProcessStartInfo psi = new ProcessStartInfo
        {
            FileName = binaryPath,
            UseShellExecute = false,
            WorkingDirectory = systemRoot
        };

        using (Process process = Process.Start(psi))
        {
            if (process != null)
                process.WaitForExit();
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    static int CompareVersions(string a, string b)
    {
        // Удаляем префикс 'v' если есть
        string va = a.TrimStart('v');
        string vb = b.TrimStart('v');

        string[] partsA = va.Split('.');
        string[] partsB = vb.Split('.');

        int maxLen = Math.Max(partsA.Length, partsB.Length);
        for (int i = 0; i < maxLen; i++)
        {
            int numA = 0, numB = 0;
            if (i < partsA.Length) int.TryParse(partsA[i], out numA);
            if (i < partsB.Length) int.TryParse(partsB[i], out numB);
            if (numA != numB)
                return numA.CompareTo(numB);
        }
        return 0;
    }

    static string SanitizeFileName(string name)
    {
        char[] invalid = Path.GetInvalidFileNameChars();
        StringBuilder sb = new StringBuilder(name.Length);
        foreach (char c in name)
            sb.Append(Array.IndexOf(invalid, c) >= 0 ? '_' : c);
        return sb.ToString();
    }

    static void ShowHelp()
    {
        Console.WriteLine("TAU Launcher v" + LauncherVersion);
        Console.WriteLine("Использование:");
        Console.WriteLine("  Launcher.exe                    Обычный запуск (с проверкой обновлений)");
        Console.WriteLine("  Launcher.exe --update           Принудительное обновление");
        Console.WriteLine("  Launcher.exe --version X.Y.Z    Запуск конкретной версии");
        Console.WriteLine("  Launcher.exe --version          Показать версию Launcher'а");
        Console.WriteLine("  Launcher.exe --help             Эта справка");
    }

    static void ShowErrorDialog(string message)
    {
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("msg.exe", "* /time:120 \"" + message + "\"")
            {
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (Process p = Process.Start(psi))
            {
                if (p != null) p.WaitForExit(3000);
            }
        }
        catch
        {
            // msg.exe может не быть — игнорируем
        }
    }
}
