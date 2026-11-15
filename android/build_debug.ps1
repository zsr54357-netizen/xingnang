param(
    [string]$JdkHome = "",
    [string]$SdkRoot = "",
    [switch]$Install,
    [switch]$SkipWebBuild
)

$ErrorActionPreference = 'Stop'
$androidRoot = $PSScriptRoot
$repoRoot = Split-Path $androidRoot -Parent

if (-not $JdkHome) {
    $jdkParent = Join-Path $repoRoot '.toolchain\jdk'
    if (Test-Path $jdkParent) {
        $JdkHome = (Get-ChildItem $jdkParent -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
    }
}
if (-not $SdkRoot) {
    $SdkRoot = Join-Path $repoRoot '.toolchain\android-sdk'
}
if (-not $JdkHome -or -not (Test-Path (Join-Path $JdkHome 'bin\javac.exe'))) {
    throw '找不到 JDK。请用 -JdkHome 指定 JDK 17+ 目录。'
}
if (-not (Test-Path (Join-Path $SdkRoot 'platforms\android-35\android.jar'))) {
    throw '找不到 Android SDK platform 35。请用 -SdkRoot 指定 Android SDK 目录。'
}
if (-not (Test-Path (Join-Path $SdkRoot 'build-tools\35.0.0\aapt2.exe'))) {
    throw '找不到 build-tools 35.0.0。'
}

$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkHome\bin;$SdkRoot\platform-tools;$SdkRoot\build-tools\35.0.0;$env:PATH"

$buildTools = Join-Path $SdkRoot 'build-tools\35.0.0'
$androidJar = Join-Path $SdkRoot 'platforms\android-35\android.jar'
$platformTools = Join-Path $SdkRoot 'platform-tools'
$appMain = Join-Path $androidRoot 'app\src\main'
$manifest = Join-Path $appMain 'AndroidManifest.xml'
$res = Join-Path $appMain 'res'
$assets = Join-Path $appMain 'assets'
$outputDir = Join-Path $androidRoot 'build-out'
$work = Join-Path $outputDir '.work'

if (-not $SkipWebBuild) {
    Write-Host '构建网页单文件版...'
    Push-Location $repoRoot
    python build.py
    Pop-Location
}

$webSingle = Join-Path $repoRoot '行囊-手机版.html'
if (-not (Test-Path $webSingle)) {
    throw '找不到 行囊-手机版.html，请先运行 python build.py。'
}
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item $webSingle (Join-Path $assets 'index.html') -Force

if (Test-Path $outputDir) {
    Remove-Item $outputDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $work, (Join-Path $work 'classes'), (Join-Path $work 'dex') | Out-Null

Write-Host '编译 Android 资源...'
$compiledRes = Join-Path $work 'compiled-res.zip'
& (Join-Path $buildTools 'aapt2.exe') compile --dir $res -o $compiledRes
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }

$unsigned = Join-Path $work 'unsigned.apk'
& (Join-Path $buildTools 'aapt2.exe') link `
    -o $unsigned `
    -I $androidJar `
    --manifest $manifest `
    --min-sdk-version 29 `
    --target-sdk-version 34 `
    --version-code 1 `
    --version-name '1.0.0' `
    -A $assets `
    -R $compiledRes `
    --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }

Write-Host '编译 Java...'
$javaFiles = Get-ChildItem (Join-Path $appMain 'java') -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& (Join-Path $JdkHome 'bin\javac.exe') `
    -encoding UTF-8 `
    -source 8 `
    -target 8 `
    -Xlint:-options `
    -classpath $androidJar `
    -d (Join-Path $work 'classes') `
    $javaFiles
if ($LASTEXITCODE -ne 0) { throw 'javac 失败' }

Write-Host '转换 dex...'
$classFiles = Get-ChildItem (Join-Path $work 'classes') -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& (Join-Path $buildTools 'd8.bat') `
    --min-api 29 `
    --lib $androidJar `
    --output (Join-Path $work 'dex') `
    $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 失败' }

Write-Host '打包 classes.dex...'
$unsignedWithDex = Join-Path $work 'unsigned-with-dex.apk'
python (Join-Path $androidRoot 'tools\add_dex.py') $unsigned (Join-Path $work 'dex\classes.dex') $unsignedWithDex
if ($LASTEXITCODE -ne 0) { throw '添加 classes.dex 失败' }

Write-Host '对齐并签名 debug APK...'
$aligned = Join-Path $work 'aligned.apk'
& (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsignedWithDex $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign 失败' }

$debugStore = Join-Path $repoRoot '.toolchain\debug.keystore'
$debugDir = Split-Path $debugStore -Parent
New-Item -ItemType Directory -Force -Path $debugDir | Out-Null
if (-not (Test-Path $debugStore)) {
    & (Join-Path $JdkHome 'bin\keytool.exe') `
        -genkeypair -v `
        -keystore $debugStore `
        -storepass android `
        -keypass android `
        -alias androiddebugkey `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname 'CN=Android Debug,O=Android,C=US' `
        -storetype JKS
    if ($LASTEXITCODE -ne 0) { throw '生成 debug keystore 失败' }
}

$apk = Join-Path $outputDir '行囊-debug-1.0.0.apk'
& (Join-Path $buildTools 'apksigner.bat') sign `
    --ks $debugStore `
    --ks-key-alias androiddebugkey `
    --ks-pass pass:android `
    --key-pass pass:android `
    --out $apk `
    $aligned
if ($LASTEXITCODE -ne 0) { throw 'apksigner 签名失败' }

& (Join-Path $buildTools 'apksigner.bat') verify --verbose $apk
if ($LASTEXITCODE -ne 0) { throw 'APK 验签失败' }

Write-Host ''
Write-Host "APK: $apk"
& (Join-Path $buildTools 'aapt2.exe') dump badging $apk | Select-String 'package:|application-label:|sdkVersion|targetSdkVersion'

if ($Install) {
    $adb = Join-Path $platformTools 'adb.exe'
    $devices = & $adb devices
    if ($devices -notmatch '\tdevice') {
        throw '没有检测到已授权的 Android 设备。请连接手机、打开 USB 调试并允许调试授权。'
    }
    & $adb install -r $apk
    if ($LASTEXITCODE -ne 0) { throw 'adb install 失败' }
    & $adb shell am start -n com.xingnang.packing/.MainActivity
    Write-Host '已安装并启动行囊。'
}
