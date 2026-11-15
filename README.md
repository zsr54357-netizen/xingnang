# 行囊 · 出差清点

一个本地优先的出差清点工具：按包裹管理物品、固定常备物品、多份待办清单，并计算出差提报费用。网页版可安装为 PWA；Android 版是一个不申请网络权限的 WebView debug 壳，适合通过 USB 调试安装。

## 版本

- **Android 调试版：1.0.0**（versionCode 1）
- **内嵌网页版：1.3.0**
- Git 标签：`v1.0.0`

Android 版目前只做调试构建，不生成正式发布签名，也不面向应用商店分发。

## 网页版

- 单文件离线版：`行囊-手机版.html`
- PWA 部署包：`行囊-部署包.zip`
- 源码：`src/`
- 构建：`python build.py`

修改 `src/` 后运行构建，会重新生成根目录的 `index.html`、单文件版和部署包。

## Android 调试安装

Android 工程位于 `android/`，包名为 `com.xingnang.packing`。

本机需要 JDK 17+ 和 Android SDK（platform 35、build-tools 35.0.0、platform-tools）。当前开发机的工具链放在 `.toolchain/`，该目录不会提交到 Git。

```powershell
# 只构建 APK
.\android\build_debug.ps1

# 手机已开启 USB 调试并授权后，构建并安装
.\android\build_debug.ps1 -Install
```

产物：

```text
android/build-out/行囊-debug-1.0.0.apk
```

这是 debug APK，使用本机固定的调试密钥签名。只要包名和调试密钥不变，覆盖安装会保留应用数据；换一台机器重新生成调试密钥时，需要先卸载旧版（会清除应用内数据，请先导出备份）。

Android 版说明：

- 不申请 `INTERNET` 权限
- 网页资源内嵌，离线可用
- WebView 使用 `file:///android_asset/index.html`，数据保存在应用内
- 备份导出通过 JavaScript 桥接直接写入系统 `Download/` 目录
- 导入通过 Android 系统文件选择器
- Android 返回键对应网页的返回/关闭顶层页面
- 备份和迁移以应用内“设置 → 数据 → 导出备份”为准

详细说明见 `android/README.md`。

## 数据

所有数据保存在本机浏览器的 localStorage 或 Android WebView 的应用数据中，不上传服务器。

换机、卸载应用或清理浏览器数据前，请在「设置 → 数据 → 导出备份」保存 JSON。Android 版会直接保存到系统“下载”目录。

## 目录

```text
src/                 网页源码
android/             Android debug WebView 壳与构建脚本
预览图/              界面截图
build.py             网页构建脚本
使用说明.md          用户使用说明
CHANGELOG.md         版本记录
```

`.toolchain/`、`android/build-out/`、APK、调试密钥和 Android 生成资源不进入 Git。
