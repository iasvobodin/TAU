<#
.SYNOPSIS
    System diagnostics for AD domain user authentication.
    Collects maximum info about system, network, and available
    authentication methods for Active Directory.
.DESCRIPTION
    Checks:
    - OS version, PowerShell, .NET Framework
    - Domain/Workgroup membership
    - DNS and NetBIOS resolution
    - Domain controller port availability
    - Various authentication methods (LogonUser, WNetUseConnection, ADSI, LDAP)
    - Security policies and restrictions
.NOTES
    Run as regular user (no admin required).
    Results saved to auth-diag-{COMPUTERNAME}-{yyyyMMdd-HHmmss}.log
#>

param(
    [string]$DomainName = "METRAN",
    [string]$TestUsername = "",
    [string]$TestPassword = "",
    [int]$PortScanTimeoutMs = 2000,
    [int]$CmdTimeoutSec = 8
)

$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$logFile = Join-Path $scriptDir "auth-diag-$env:COMPUTERNAME-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$logEntries = [System.Collections.ArrayList]::new()

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$timestamp][$Level] $Message"
    Write-Host $line
    [void]$logEntries.Add($line)
}

function Write-Section {
    param([string]$Title)
    Write-Log ""
    Write-Log ("=" * 70)
    Write-Log "  $Title"
    Write-Log ("=" * 70)
}

function Save-Log {
    $logEntries | Out-File -FilePath $logFile -Encoding UTF8
    Write-Host "`n[INFO] Log saved: $logFile" -ForegroundColor Green
}

# Run external command with timeout
function Run-Cmd {
    param([string]$Command, [string]$Label = "", [int]$Timeout = $CmdTimeoutSec)
    $job = Start-Job -ScriptBlock {
        param($c)
        try {
            $result = Invoke-Expression $c 2>$null
            if ($result) { $result | Out-String } else { "" }
        } catch {
            "$_"
        }
    } -ArgumentList $Command
    $completed = $job | Wait-Job -Timeout $Timeout
    if ($completed) {
        $output = Receive-Job $job
        return $output
    } else {
        $job | Stop-Job -PassThru | Remove-Job
        return $null
    }
}

# Run script block with timeout
function Run-ScriptBlock {
    param([scriptblock]$Block, [object[]]$Args, [string]$Label = "", [int]$Timeout = $CmdTimeoutSec)
    $job = Start-Job -ScriptBlock $Block -ArgumentList $Args
    $completed = $job | Wait-Job -Timeout $Timeout
    if ($completed) {
        $output = Receive-Job $job
        return $output
    } else {
        $job | Stop-Job -PassThru | Remove-Job
        return $null
    }
}

# =====================================================================
# 1. SYSTEM INFORMATION
# =====================================================================
Write-Section "1. SYSTEM INFORMATION"

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    Write-Log "OS Name: $($os.Caption)"
    Write-Log "OS Version: $($os.Version)"
    Write-Log "OS Build: $($os.BuildNumber)"
    Write-Log "OS Architecture: $($os.OSArchitecture)"
    Write-Log "Last Boot: $($os.LastBootUpTime)"
} catch { Write-Log "Failed to get OS info: $_" "ERROR" }

Write-Log "Computer Name: $env:COMPUTERNAME"
Write-Log "User Name: $env:USERNAME"
Write-Log "User Domain: $env:USERDOMAIN"
Write-Log "User DNS Domain: $env:USERDNSDOMAIN"
Write-Log "Logon Server: $env:LOGONSERVER"
Write-Log "Processor Arch: $env:PROCESSOR_ARCHITECTURE"

try {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    Write-Log "Domain/Workgroup: $($cs.Domain)"
    Write-Log "PartOfDomain: $($cs.PartOfDomain)"
    Write-Log "Workgroup: $($cs.Workgroup)"
} catch { Write-Log "Failed to get domain info: $_" "ERROR" }

Write-Log "PSVersion: $($PSVersionTable.PSVersion)"
Write-Log "PSEdition: $($PSVersionTable.PSEdition)"
Write-Log "PSCompatibleVersions: $($PSVersionTable.PSCompatibleVersions -join ', ')"

try {
    $net = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full\' -ErrorAction SilentlyContinue
    if ($net) {
        Write-Log ".NET Framework Release: $($net.Release), Version: $($net.Version)"
    } else {
        Write-Log ".NET Framework: not found in registry" "WARN"
    }
} catch { Write-Log "Failed to get .NET info: $_" "ERROR" }

try {
    $adAssembly = [System.Reflection.Assembly]::LoadWithPartialName("System.DirectoryServices.AccountManagement")
    if ($adAssembly) {
        Write-Log "System.DirectoryServices.AccountManagement: AVAILABLE ($($adAssembly.Location))"
    } else {
        Write-Log "System.DirectoryServices.AccountManagement: NOT AVAILABLE" "WARN"
    }
} catch { Write-Log "Assembly check failed: $_" "WARN" }

# =====================================================================
# 2. NETWORK / DNS / NetBIOS
# =====================================================================
Write-Section "2. NETWORK / DNS / NetBIOS"

try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -ne 'Loopback Pseudo-Interface 1' }
    foreach ($ip in $ips) {
        Write-Log "IP: $($ip.IPAddress) /$($ip.PrefixLength) on $($ip.InterfaceAlias)"
    }
    $dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
    foreach ($d in $dns) {
        if ($d.ServerAddresses) {
            Write-Log "DNS Servers ($($d.InterfaceAlias)): $($d.ServerAddresses -join ', ')"
        }
    }
} catch { Write-Log "Failed to get network info: $_" "ERROR" }

Write-Log "--- DNS Resolution ---"
$dnsNames = @($DomainName, "$DomainName.local", "$DomainName.ru", "$DomainName.com",
              "dc1.$DomainName.local", "dc.$DomainName.local",
              "gc._msdcs.$DomainName.local", "_ldap._tcp.$DomainName.local")

foreach ($name in $dnsNames) {
    try {
        $result = [System.Net.Dns]::GetHostEntry($name)
        Write-Log "DNS OK: $name -> $($result.AddressList.IPAddressToString -join ', ')"
    } catch {
        Write-Log "DNS FAIL: $name -> $($_.Exception.Message)" "WARN"
    }
}

$nslookupOut = Run-Cmd "nslookup $DomainName" "nslookup"
if ($nslookupOut) {
    Write-Log "nslookup ${DomainName}:"
    foreach ($line in ($nslookupOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "  $($line.Trim())" }
    }
} else {
    Write-Log "nslookup: TIMEOUT or FAILED (no response within ${CmdTimeoutSec}s)" "WARN"
}

$nltestOut = Run-Cmd "nltest.exe /dsgetdc:${DomainName}" "nltest"
if ($nltestOut) {
    Write-Log "nltest /dsgetdc:${DomainName}:"
    foreach ($line in ($nltestOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "  $($line.Trim())" }
    }
} else {
    Write-Log "nltest: TIMEOUT or FAILED (within ${CmdTimeoutSec}s)" "WARN"
}

$netViewOut = Run-Cmd "net view /domain" "net view"
if ($netViewOut) {
    Write-Log "net view /domain:"
    foreach ($line in ($netViewOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "  $($line.Trim())" }
    }
} else {
    Write-Log "net view /domain: TIMEOUT or FAILED (within ${CmdTimeoutSec}s)" "WARN"
}

$netViewDomainOut = Run-Cmd "net view /domain:${DomainName}" "net view domain"
if ($netViewDomainOut) {
    Write-Log "net view /domain:${DomainName}:"
    foreach ($line in ($netViewDomainOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "  $($line.Trim())" }
    }
} else {
    Write-Log "net view /domain:${DomainName}: TIMEOUT or FAILED (within ${CmdTimeoutSec}s)" "WARN"
}

# =====================================================================
# 3. DOMAIN CONTROLLER PORTS
# =====================================================================
Write-Section "3. DOMAIN CONTROLLER PORTS"

$ports = @(
    @{Name="LDAP"; Port=389},
    @{Name="LDAPS"; Port=636},
    @{Name="SMB"; Port=445},
    @{Name="Kerberos"; Port=88},
    @{Name="GlobalCatalog"; Port=3268},
    @{Name="GlobalCatalogSSL"; Port=3269},
    @{Name="NetBIOS"; Port=139}
)

$dcAddresses = @()
foreach ($name in @("$DomainName", "dc1.$DomainName.local", "dc.$DomainName.local")) {
    try {
        $dcAddresses += [System.Net.Dns]::GetHostEntry($name).AddressList
    } catch {}
}
$dcAddresses = $dcAddresses | Select-Object -Unique

if ($dcAddresses.Count -eq 0) {
    Write-Log "No DC addresses found via DNS" "WARN"
}

if ($dcAddresses.Count -gt 0) {
    $seen = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($addr in $dcAddresses) {
        $ipStr = $addr.IPAddressToString
        if (-not $seen.Add($ipStr)) { continue }
        Write-Log "--- Scanning DC: $ipStr ---"

        try {
            $ping = Test-Connection -ComputerName $ipStr -Count 2 -Quiet -ErrorAction SilentlyContinue
            Write-Log "Ping ${ipStr}: $(if($ping){'OK'}else{'FAIL'})"
        } catch { Write-Log "Ping ${ipStr}: ERROR ($_)" "WARN" }

        foreach ($port in $ports) {
            try {
                $client = New-Object System.Net.Sockets.TcpClient
                $async = $client.BeginConnect($ipStr, $port.Port, $null, $null)
                $wait = $async.AsyncWaitHandle.WaitOne($PortScanTimeoutMs, $false)
                if ($wait) {
                    $client.EndConnect($async) | Out-Null
                    Write-Log "Port $($port.Port) ($($port.Name)): OPEN"
                    $client.Close()
                } else {
                    Write-Log "Port $($port.Port) ($($port.Name)): TIMEOUT ($PortScanTimeoutMs ms)" "WARN"
                    $client.Close()
                }
            } catch {
                Write-Log "Port $($port.Port) ($($port.Name)): CLOSED ($_)" "WARN"
            }
        }
    }
} else {
    Write-Log "No DC addresses resolved - port scan skipped" "WARN"
}

# SMB access check (with timeout via job)
foreach ($addr in $dcAddresses) {
    $ipStr = $addr.IPAddressToString
    $smbPaths = @(
        "\\$ipStr\IPC$",
        "\\$ipStr\SYSVOL",
        "\\$ipStr\NETLOGON",
        "\\$DomainName\IPC$",
        "\\$DomainName\SYSVOL",
        "\\$DomainName\NETLOGON"
    )
    foreach ($path in $smbPaths) {
        $result = Run-Cmd "Test-Path '$path' -ErrorAction SilentlyContinue" "SMB check" 4
        if ($result -ne $null) {
            $exists = $result.Trim()
            Write-Log "SMB access: $path -> $(if($exists -eq 'True'){'ACCESSIBLE'}else{'NOT ACCESSIBLE'})"
        } else {
            Write-Log "SMB access: $path -> TIMEOUT" "WARN"
        }
    }
}

# =====================================================================
# 4. AUTHENTICATION METHODS
# =====================================================================
Write-Section "4. AUTHENTICATION METHODS"

$domainResolvesDns = $false
try {
    $null = [System.Net.Dns]::GetHostEntry($DomainName)
    $domainResolvesDns = $true
    Write-Log "DNS check: $DomainName resolves OK"
} catch {
    Write-Log "DNS check: $DomainName does NOT resolve (ADSI/LDAP skipped)" "WARN"
}

# 4.1 ADSI DirectoryEntry (with timeout)
Write-Log "--- Method: ADSI (DirectoryEntry) ---"
$adsiResult = Run-ScriptBlock {
    param($d)
    Add-Type -AssemblyName System.DirectoryServices
    $path = "LDAP://$d"
    $e = New-Object System.DirectoryServices.DirectoryEntry($path)
    $null = $e.NativeObject
    return "ADSI bind: SUCCESS (path=$path), Name=$($e.Name)"
} -Args $DomainName -Label "ADSI" -Timeout 8
if ($adsiResult) {
    foreach ($line in ($adsiResult -split "`r`n")) { if ($line.Trim()) { Write-Log $line.Trim() } }
} else {
    Write-Log "ADSI bind: SKIPPED (DNS resolves but bind timeout/failed)" "WARN"
}

# 4.2 ADSI with credentials (with timeout)
if ($TestUsername -and $TestPassword) {
    Write-Log "--- Method: ADSI with creds ($DomainName\$TestUsername) ---"
    $adsiCredResult = Run-ScriptBlock {
        param($d, $u, $p)
        Add-Type -AssemblyName System.DirectoryServices
        $path = "LDAP://$d"
        $e = New-Object System.DirectoryServices.DirectoryEntry($path, "$d\$u", $p)
        $null = $e.NativeObject
        return "ADSI bind (with creds): SUCCESS"
    } -Args @($DomainName, $TestUsername, $TestPassword) -Label "ADSI creds" -Timeout 8
    if ($adsiCredResult) {
        foreach ($line in ($adsiCredResult -split "`r`n")) { if ($line.Trim()) { Write-Log $line.Trim() } }
    } else {
        Write-Log "ADSI bind (with creds): TIMEOUT (8s)" "WARN"
    }
}

# 4.3 PrincipalContext
Write-Log "--- Method: PrincipalContext.ValidateCredentials ---"
try {
    Add-Type -AssemblyName System.DirectoryServices.AccountManagement
    if ($TestUsername -and $TestPassword) {
        $job = Start-Job -ScriptBlock {
            param($d, $u, $p)
            Add-Type -AssemblyName System.DirectoryServices.AccountManagement
            $pc = New-Object System.DirectoryServices.AccountManagement.PrincipalContext(
                [System.DirectoryServices.AccountManagement.ContextType]::Domain, $d)
            $r = $pc.ValidateCredentials($u, $p)
            return "PrincipalContext($d, $u): $r"
        } -ArgumentList $DomainName, $TestUsername, $TestPassword
        $jobResult = $job | Wait-Job -Timeout 8
        if ($jobResult) {
            $msg = Receive-Job $job
            Write-Log $msg
        } else {
            Write-Log "PrincipalContext: TIMEOUT after 8s" "WARN"
            $job | Stop-Job -PassThru | Remove-Job
        }
    } else {
        Write-Log "PrincipalContext compiled. Provide -TestUsername/-TestPassword to test."
    }
} catch {
    Write-Log "PrincipalContext: FAILED ($_)" "WARN"
}

# 4.4 PrincipalContext without domain
Write-Log "--- Method: PrincipalContext (no domain) ---"
try {
    if ($TestUsername -and $TestPassword) {
        $job2 = Start-Job -ScriptBlock {
            param($u, $p)
            Add-Type -AssemblyName System.DirectoryServices.AccountManagement
            $pc = New-Object System.DirectoryServices.AccountManagement.PrincipalContext(
                [System.DirectoryServices.AccountManagement.ContextType]::Domain)
            $r = $pc.ValidateCredentials($u, $p)
            return "PrincipalContext(no domain, $u): $r"
        } -ArgumentList $TestUsername, $TestPassword
        $jobResult2 = $job2 | Wait-Job -Timeout 8
        if ($jobResult2) {
            $msg2 = Receive-Job $job2
            Write-Log $msg2
        } else {
            Write-Log "PrincipalContext (no domain): TIMEOUT after 8s" "WARN"
            $job2 | Stop-Job -PassThru | Remove-Job
        }
    } else {
        Write-Log "PrincipalContext (no domain): available, provide credentials to test"
    }
} catch {
    Write-Log "PrincipalContext (no domain): FAILED ($_)" "WARN"
}

# 4.5 LDAP bind via LdapConnection
Write-Log "--- Method: LDAP bind (LdapConnection) ---"
if ($domainResolvesDns) {
    try {
        $ldapPath = "$DomainName`:389"
        $ldap = New-Object System.DirectoryServices.Protocols.LdapConnection($ldapPath)
        $ldap.Timeout = [TimeSpan]::FromSeconds(5)
        $ldap.AuthType = [System.DirectoryServices.Protocols.AuthType]::Negotiate
        $ldap.Bind()
        Write-Log "LDAP bind: SUCCESS to $ldapPath"
        $ldap.Dispose()
    } catch {
        Write-Log "LDAP bind: FAILED to $DomainName`:389 ($_)" "WARN"
    }
} else {
    Write-Log "LDAP bind to $DomainName`: SKIPPED (DNS does not resolve)"
}

foreach ($addr in $dcAddresses) {
    try {
        $ipStr = $addr.IPAddressToString
        $ldap2 = New-Object System.DirectoryServices.Protocols.LdapConnection("$ipStr`:389")
        $ldap2.Timeout = [TimeSpan]::FromSeconds(5)
        $ldap2.AuthType = [System.DirectoryServices.Protocols.AuthType]::Negotiate
        $ldap2.Bind()
        Write-Log "LDAP bind: SUCCESS to $ipStr`:389"
        $ldap2.Dispose()
    } catch {
        Write-Log "LDAP bind: FAILED to $($addr.IPAddressToString):389 ($_)" "WARN"
    }
}

# 4.6 LogonUser P/Invoke
Write-Log "--- Method: LogonUser (P/Invoke) ---"
try {
    $logonUserMethod = @'
using System;
using System.Runtime.InteropServices;
public class LogonUserCheck {
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool LogonUser(string lpszUsername, string lpszDomain,
        string lpszPassword, int dwLogonType, int dwLogonProvider, out IntPtr phToken);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);
    private const int LOGON32_LOGON_NETWORK = 3;
    private const int LOGON32_PROVIDER_DEFAULT = 0;
    public static int TestNetwork(string username, string domain, string password) {
        IntPtr token;
        if (LogonUser(username, domain, password, LOGON32_LOGON_NETWORK, LOGON32_PROVIDER_DEFAULT, out token)) {
            CloseHandle(token); return 0;
        }
        return Marshal.GetLastWin32Error();
    }
}
'@
    Add-Type -TypeDefinition $logonUserMethod -ErrorAction Stop
    if ($TestUsername -and $TestPassword) {
        $err1 = [LogonUserCheck]::TestNetwork($TestUsername, $DomainName, $TestPassword)
        Write-Log "LogonUser(NETWORK, $TestUsername, $DomainName): error=$err1"
        $err2 = [LogonUserCheck]::TestNetwork($TestUsername, "", $TestPassword)
        Write-Log "LogonUser(NETWORK, $TestUsername, <empty>): error=$err2"
        $err3 = [LogonUserCheck]::TestNetwork($TestUsername, $env:COMPUTERNAME, $TestPassword)
        Write-Log "LogonUser(NETWORK, $TestUsername, $env:COMPUTERNAME): error=$err3"
    } else {
        Write-Log "LogonUser compiled. Use -TestUsername/-TestPassword to test."
    }
} catch {
    Write-Log "LogonUser P/Invoke: FAILED ($_)" "WARN"
}

# 4.7 WNetUseConnection P/Invoke
Write-Log "--- Method: WNetUseConnection (SMB resource) ---"
try {
    $wnetMethod = @'
using System;
using System.Runtime.InteropServices;
public class WNetCheck {
    [DllImport("mpr.dll", CharSet = CharSet.Unicode)]
    private static extern int WNetUseConnection(IntPtr hwndOwner, ref NETRESOURCE lpNetResource,
        string lpPassword, string lpUserID, int dwFlags, out IntPtr lpAccessName,
        out int lpBufferSize, out int lpResult);
    [DllImport("mpr.dll", CharSet = CharSet.Unicode)]
    private static extern int WNetCancelConnection2(string lpName, int dwFlags, bool fForce);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NETRESOURCE {
        public int dwScope; public int dwType; public int dwDisplayType; public int dwUsage;
        public string lpLocalName; public string lpRemoteName; public string lpComment; public string lpProvider;
    }
    private const int RESOURCETYPE_ANY = 0;
    private const int CONNECT_TEMPORARY = 4;
    public static int TestConnection(string remotePath, string userID, string password) {
        NETRESOURCE nr = new NETRESOURCE();
        nr.dwType = RESOURCETYPE_ANY;
        nr.lpRemoteName = remotePath;
        IntPtr accessName; int bufSize, result;
        int ret = WNetUseConnection(IntPtr.Zero, ref nr, password, userID, CONNECT_TEMPORARY, out accessName, out bufSize, out result);
        if (accessName != IntPtr.Zero) { string path = Marshal.PtrToStringUni(accessName); WNetCancelConnection2(path, 0, true); }
        return ret;
    }
}
'@
    Add-Type -TypeDefinition $wnetMethod -ErrorAction Stop
    if ($TestUsername -and $TestPassword) {
        $uid = "$DomainName\$TestUsername"
        $paths = @("\\$DomainName\IPC$", "\\$DomainName\NETLOGON", "\\$DomainName\SYSVOL")
        foreach ($p in $paths) {
            $ret = [WNetCheck]::TestConnection($p, $uid, $TestPassword)
            Write-Log "WNetUseConnection($p): result=$ret (0=success)"
        }
        foreach ($addr in $dcAddresses) {
            $ipStr = $addr.IPAddressToString
            $ret = [WNetCheck]::TestConnection("\\$ipStr\IPC$", $uid, $TestPassword)
            Write-Log "WNetUseConnection(\\$ipStr\IPC$): result=$ret (0=success)"
        }
    } else {
        Write-Log "WNetUseConnection compiled. Use -TestUsername/-TestPassword to test."
    }
} catch {
    Write-Log "WNetUseConnection P/Invoke: FAILED ($_)" "WARN"
}

# =====================================================================
# 5. POLICIES AND RESTRICTIONS
# =====================================================================
Write-Section "5. POLICIES AND RESTRICTIONS"

try {
    $uac = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'EnableLUA' -ErrorAction SilentlyContinue
    if ($uac) { Write-Log "UAC EnableLUA: $($uac.EnableLUA) (0=disabled, 1=enabled)" }
    else { Write-Log "UAC: not found" "WARN" }
} catch { Write-Log "UAC check failed: $_" "WARN" }

try {
    $cg = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\LSA' -Name 'LsaCfgFlags' -ErrorAction SilentlyContinue
    if ($cg) { Write-Log "Credential Guard LsaCfgFlags: $($cg.LsaCfgFlags)" }
    else { Write-Log "Credential Guard: not configured" }
} catch { Write-Log "Credential Guard check failed: $_" "WARN" }

try {
    $fat = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'FilterAdministratorToken' -ErrorAction SilentlyContinue
    if ($fat) { Write-Log "FilterAdministratorToken: $($fat.FilterAdministratorToken)" }
} catch {}

try {
    $latf = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'LocalAccountTokenFilterPolicy' -ErrorAction SilentlyContinue
    if ($latf) { Write-Log "LocalAccountTokenFilterPolicy: $($latf.LocalAccountTokenFilterPolicy)" }
} catch {}

$secpolOut = Run-Cmd "secedit /export /cfg `"$env:TEMP\secpol.cfg`" /areas USER_RIGHTS 2>&1; if(Test-Path `"$env:TEMP\secpol.cfg`") { Get-Content `"$env:TEMP\secpol.cfg`" -ErrorAction SilentlyContinue | Select-String 'SeNetworkLogonRight'; Remove-Item `"$env:TEMP\secpol.cfg`" -ErrorAction SilentlyContinue } else { 'No secpol export' }" "secedit" 10
if ($secpolOut) {
    foreach ($line in ($secpolOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "Secedit: $($line.Trim())" }
    }
} else {
    Write-Log "SeNetworkLogonRight check: TIMEOUT or FAILED (no admin rights?)" "WARN"
}

try {
    $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled
    foreach ($p in $fw) {
        Write-Log "Firewall ($($p.Name)): $(if($p.Enabled){'ENABLED'}else{'DISABLED'})"
    }
} catch { Write-Log "Firewall check failed: $_" "WARN" }

$cmdkeyOut = Run-Cmd "cmdkey /list" "cmdkey" 8
if ($cmdkeyOut) {
    Write-Log "Credential Manager (cmdkey /list):"
    foreach ($line in ($cmdkeyOut -split "`r`n")) {
        if ($line.Trim()) { Write-Log "  $($line.Trim())" }
    }
} else {
    Write-Log "cmdkey: TIMEOUT or FAILED" "WARN"
}

# =====================================================================
# 6. ADDITIONAL INFO
# =====================================================================
Write-Section "6. ADDITIONAL INFO"

Write-Log "AUTH RELATED ENV VARS:"
$authEnvVars = @('USERNAME', 'USERDOMAIN', 'USERDNSDOMAIN', 'LOGONSERVER', 'COMPUTERNAME', 'HOMEDRIVE', 'HOMEPATH', 'USERPROFILE')
foreach ($var in $authEnvVars) {
    Write-Log "  $var = $( [Environment]::GetEnvironmentVariable($var, 'Process') )"
}

Write-Log "AVAILABLE .NET AUTH ASSEMBLIES:"
$assemblies = @("System.DirectoryServices", "System.DirectoryServices.AccountManagement", "System.DirectoryServices.Protocols")
foreach ($as in $assemblies) {
    try {
        $a = [System.Reflection.Assembly]::LoadWithPartialName($as)
        if ($a) {
            Write-Log "  ${as}: AVAILABLE ($($a.Location))"
        } else {
            Write-Log "  ${as}: NOT FOUND" "WARN"
        }
    } catch {
        Write-Log "  ${as}: UNAVAILABLE ($_)" "WARN"
    }
}

if ($TestUsername -and $TestPassword) {
    Write-Log "--- Cmdkey test (generic credential add/remove) ---"
    $guid = [System.Guid]::NewGuid().ToString('N').Substring(0,8)
    $targetName = "TAU-AuthTest-$guid"
    $cmdkeyAdd = Run-Cmd "cmdkey /generic:${targetName} /user:`"${DomainName}\${TestUsername}`" /pass:`"${TestPassword}`"" "cmdkey add" 8
    if ($cmdkeyAdd -ne $null) {
        Write-Log "cmdkey /generic:${targetName} -> added"
        $cmdkeyDel = Run-Cmd "cmdkey /delete:${targetName}" "cmdkey del" 8
        if ($cmdkeyDel -ne $null) {
            Write-Log "cmdkey /delete:${targetName} -> removed"
        } else {
            Write-Log "cmdkey /delete:${targetName} -> TIMEOUT" "WARN"
        }
    } else {
        Write-Log "cmdkey /generic:${targetName} -> TIMEOUT or FAILED" "WARN"
    }
}

# =====================================================================
# SUMMARY
# =====================================================================
Write-Section "SUMMARY"
Write-Log "Diagnostic completed."
Write-Log ""
Write-Log "To test authentication with credentials, run:"
Write-Log "  powershell -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`" -TestUsername your_login -TestPassword your_password"
Write-Log ""
Write-Log "To test with a different domain:"
Write-Log "  ... -DomainName OTHERDOMAIN ..."

Save-Log
