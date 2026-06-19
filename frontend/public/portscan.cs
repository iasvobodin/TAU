using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.IO;

class Program
{
    static void Main()
    {
        Console.WriteLine("=== Port Scanner ===");
        Console.WriteLine();

        string[] targets = {
            "10.68.161.117",
            "10.68.160.200",
            "10.68.160.120",
            "10.68.160.250",
            "rucekaspinffs05.metran.local"
        };

        int[] ports = { 389, 636, 445, 88, 3268, 3269, 139 };
        string[] portNames = { "LDAP", "LDAPS", "SMB", "Kerberos", "GC", "GC SSL", "NetBIOS" };

        foreach (string target in targets)
        {
            Console.WriteLine("--- " + target + " ---");

            string ip = target;
            try
            {
                var entry = Dns.GetHostEntry(target);
                ip = entry.AddressList[0].ToString();
                Console.WriteLine("  DNS resolves to: " + ip);
            }
            catch
            {
                Console.WriteLine("  DNS resolution failed, using as-is: " + ip);
            }

            try
            {
                Ping ping = new Ping();
                PingReply reply = ping.Send(ip, 2000);
                Console.WriteLine("  Ping: " + (reply.Status == IPStatus.Success ? "OK" : "FAIL") + " (" + reply.Status + ")");
            }
            catch (Exception ex)
            {
                Console.WriteLine("  Ping: ERROR (" + ex.Message + ")");
            }

            for (int i = 0; i < ports.Length; i++)
            {
                try
                {
                    using (TcpClient tcp = new TcpClient())
                    {
                        var ar = tcp.BeginConnect(ip, ports[i], null, null);
                        bool connected = ar.AsyncWaitHandle.WaitOne(1500, false);
                        if (connected)
                        {
                            tcp.EndConnect(ar);
                            Console.WriteLine("  Port " + ports[i].ToString().PadRight(5) + " (" + portNames[i].PadRight(10) + "): OPEN");
                        }
                        else
                        {
                            Console.WriteLine("  Port " + ports[i].ToString().PadRight(5) + " (" + portNames[i].PadRight(10) + "): TIMEOUT");
                        }
                    }
                }
                catch
                {
                    Console.WriteLine("  Port " + ports[i].ToString().PadRight(5) + " (" + portNames[i].PadRight(10) + "): CLOSED");
                }
            }

            try
            {
                bool ok = Directory.Exists("\\\\" + ip + "\\IPC$");
                Console.WriteLine("  SMB IPC$: " + (ok ? "ACCESSIBLE" : "NOT ACCESSIBLE"));
            }
            catch
            {
                Console.WriteLine("  SMB IPC$: ERROR");
            }

            Console.WriteLine();
        }
    }
}
