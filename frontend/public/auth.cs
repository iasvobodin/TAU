using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

class Program
{
    // Версия auth.exe — увеличивать при изменении функционала
    const string VERSION = "2.1.0";

    [DllImport("credui.dll", CharSet = CharSet.Unicode)]
    private static extern int CredUIPromptForWindowsCredentials(
        ref CREDUI_INFO pUiInfo, int dwAuthError, ref uint pulAuthPackage,
        IntPtr pvInAuthBuffer, uint ulInAuthBufferSize,
        out IntPtr ppvOutAuthBuffer, out uint pulOutAuthBufferSize,
        ref bool pfSave, uint dwFlags);

    [DllImport("Ole32.dll", ExactSpelling = true, SetLastError = true)]
    private static extern void CoTaskMemFree(IntPtr pv);

    [DllImport("credui.dll", CharSet = CharSet.Unicode)]
    private static extern bool CredUnPackAuthenticationBuffer(
        int dwFlags, IntPtr pAuthBuffer, uint cbAuthBuffer,
        StringBuilder pszUserName, ref int pcchMaxUserName,
        StringBuilder pszDomainName, ref int pcchMaxDomainName,
        StringBuilder pszPassword, ref int pcchMaxPassword);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDUI_INFO
    {
        public int cbSize;
        public IntPtr hwndParent;
        public string pszMessageText;
        public string pszCaptionText;
        public IntPtr hbmBannerBitmap;
    }

    static bool NetUseConnect(string server, string share, string username, string password)
    {
        string uncPath = @"\\" + server + @"\" + share;
        string args = "use \"" + uncPath + "\" \"" + password + "\" /user:\"" + username + "\" /persistent:no /y";

        ProcessStartInfo psi = new ProcessStartInfo("net", args);
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardError = true;
        psi.WorkingDirectory = Environment.GetEnvironmentVariable("SystemRoot");

        using (Process p = Process.Start(psi))
        {
            if (p.WaitForExit(15000))
            {
                if (p.ExitCode != 0)
                {
                    string err = p.StandardError.ReadToEnd();
                    if (!string.IsNullOrEmpty(err))
                        Console.Error.WriteLine("[AUTH] " + uncPath + ": " + err.Trim());
                }
                return p.ExitCode == 0;
            }
            else
            {
                Console.Error.WriteLine("[AUTH] " + uncPath + ": timeout");
                try { p.Kill(); } catch { }
                return false;
            }
        }
    }

    static void NetUseDisconnect(string server, string share)
    {
        string uncPath = @"\\" + server + @"\" + share;
        ProcessStartInfo psi = new ProcessStartInfo("net", "use \"" + uncPath + "\" /delete /y");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.WorkingDirectory = Environment.GetEnvironmentVariable("SystemRoot");
        using (Process p = Process.Start(psi)) { p.WaitForExit(3000); }
    }

    static void Main(string[] args)
    {
        // Поддержка --version для проверки актуальности бинарника
        if (args.Length > 0 && args[0] == "--version")
        {
            Console.Write(VERSION);
            return;
        }

        // Принудительно устанавливаем Working Directory на SystemRoot,
        // чтобы избежать ошибки "CMD.EXE не может работать с UNC" при запуске из сетевой папки
        string systemRoot = Environment.GetEnvironmentVariable("SystemRoot") ?? @"C:\Windows";
        if (!string.IsNullOrEmpty(systemRoot))
            Environment.CurrentDirectory = systemRoot;

        // Используем OEM-кодировку (CP866 для русской Windows) — её ожидает NeutralinoJS
        Console.OutputEncoding = Encoding.GetEncoding(866);
        Console.InputEncoding = Encoding.GetEncoding(866);
        Console.SetError(new System.IO.StreamWriter(Console.OpenStandardError(), Encoding.GetEncoding(866)) { AutoFlush = true });

        CREDUI_INFO ui = new CREDUI_INFO();
        ui.cbSize = Marshal.SizeOf(ui);
        ui.pszCaptionText = "ТАУ контроль авторизация";
        ui.pszMessageText = "Введите ваши доменные учетные данные.";

        uint authPackage = 0;
        IntPtr outBuffer = IntPtr.Zero;
        uint outBufferSize = 0;
        bool save = false;
        int authError = 0;

        string[] authServers = { "10.68.160.200", null };
        string[] authShares = { "IPC$", "NETLOGON" };

        while (true)
        {
            int result = CredUIPromptForWindowsCredentials(ref ui, authError, ref authPackage, IntPtr.Zero, 0, out outBuffer, out outBufferSize, ref save, 1);

            if (result == 0)
            {
                var userSb = new StringBuilder(256);
                var domainSb = new StringBuilder(256);
                var passSb = new StringBuilder(256);
                int maxUser = 256, maxDomain = 256, maxPass = 256;

                if (CredUnPackAuthenticationBuffer(0, outBuffer, outBufferSize, userSb, ref maxUser, domainSb, ref maxDomain, passSb, ref maxPass))
                {
                    string username = userSb.ToString();
                    string password = passSb.ToString();
                    string domain = domainSb.ToString();

                    int backslashIndex = username.IndexOf('\\');
                    if (backslashIndex >= 0)
                    {
                        domain = username.Substring(0, backslashIndex);
                        username = username.Substring(backslashIndex + 1);
                    }
                    else if (string.IsNullOrEmpty(domain))
                    {
                        domain = Environment.UserDomainName;
                    }

                    if (string.IsNullOrEmpty(domain) ||
                        domain.Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase) ||
                        domain.Equals("WORKGROUP", StringComparison.OrdinalIgnoreCase))
                    {
                        domain = "METRAN";
                    }

                    authServers[1] = domain;
                    CoTaskMemFree(outBuffer);

                    string fullUsername = domain + "\\" + username;
                    bool ok = false;

                    foreach (string server in authServers)
                    {
                        foreach (string share in authShares)
                        {
                            if (NetUseConnect(server, share, fullUsername, password))
                            {
                                NetUseDisconnect(server, share);
                                Console.Write(domain + "\\" + username);
                                ok = true;
                                Environment.Exit(0);
                            }
                        }
                    }

                    if (!ok)
                        Console.Error.WriteLine("[AUTH] All authentication attempts failed");
                    authError = 86;
                }
                else
                {
                    CoTaskMemFree(outBuffer);
                    authError = 86;
                }
            }
            else
            {
                Console.Write("CANCELED");
                Environment.Exit(1);
            }
        }
    }
}
