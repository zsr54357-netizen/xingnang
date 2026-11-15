[CmdletBinding()]
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "行囊 · 出差清点" -ForegroundColor Yellow
Write-Host "手机访问服务" -ForegroundColor Yellow
Write-Host ""

$python = Get-Command python -ErrorAction SilentlyContinue
$py = Get-Command py -ErrorAction SilentlyContinue
if (-not $python -and -not $py) {
    Write-Host "没有找到 Python 3。" -ForegroundColor Red
    Write-Host "请先安装 Python，或者改用「行囊-手机版.html」单文件方式。"
    Read-Host "按回车退出"
    exit 1
}

$ipAddresses = @()
try {
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object {
            $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
        } |
        Select-Object -ExpandProperty IPAddress -Unique
} catch {
    $ipAddresses = @()
}

if (-not $ipAddresses -or $ipAddresses.Count -eq 0) {
    try {
        $ipAddresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
            Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
            ForEach-Object { $_.IPAddressToString } |
            Where-Object { $_ -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } |
            Select-Object -Unique
    } catch {
        $ipAddresses = @()
    }
}

Write-Host "1. 请确保手机和这台电脑连接同一个 Wi-Fi。"
if ($ipAddresses.Count -gt 0) {
    Write-Host "2. 在手机浏览器中打开下面的地址（任选一个）："
    foreach ($ip in $ipAddresses) {
        Write-Host "   http://${ip}:${Port}" -ForegroundColor Green
    }
} else {
    Write-Host "2. 没有识别到局域网 IP，请在「网络和 Internet」里查看电脑的 IPv4 地址，"
    Write-Host "   然后用 http://电脑IP:${Port} 访问。"
}
Write-Host "3. 如果手机打不开，请允许 Python 通过 Windows 防火墙的专用网络。"
Write-Host "4. 本服务仅用于同一 Wi-Fi 下预览；完整离线安装请部署 HTTPS 版。"
Write-Host ""
Write-Host "按 Ctrl+C 停止服务。" -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) {
    try { Start-Process "http://127.0.0.1:${Port}/" | Out-Null } catch { }
}

try {
    if ($python) {
        & $python.Source -m http.server $Port --bind 0.0.0.0
    } else {
        & $py.Source -3 -m http.server $Port --bind 0.0.0.0
    }
} catch {
    Write-Host ""
    Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host "可能是端口 $Port 被占用，试试：.\启动手机访问.ps1 -Port 8081"
    Read-Host "按回车退出"
    exit 1
}
