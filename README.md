# 行囊 · 出差清点

一个本地优先的出差清点工具：按包裹管理物品、固定常备物品、多份待办清单，并计算出差提报费用。网页版可安装为 PWA；Android 版是一个 WebView debug 壳，内置行囊模块和独立的「第二问」模块，适合通过 USB 调试安装。

## 版本

- **Android 调试版：1.3.1**（versionCode 6）
- **内嵌网页版：1.6.1**
- Git 标签：`v1.3.1`

Android 版目前只做调试构建，不生成正式发布签名，也不面向应用商店分发。

## 四个模块

- **待办**：多份清单，独立命名
- **出差费用**：补贴、汇率、额外支出和提报金额
- **打包清单**：按包裹清点物品；支持一级包裹下建二级子包裹，以及把物品转移到另一个包裹
- **第二问**：本地加密的单会话自我解剖应用，独立 WebView、独立数据空间；Android 版内打开

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
android/build-out/行囊-debug-1.3.1.apk
```

这是 debug APK，使用本机固定的调试密钥签名。只要包名和调试密钥不变，覆盖安装会保留应用数据；换一台机器重新生成调试密钥时，需要先卸载旧版（会清除应用内数据，请先导出备份）。

Android 版说明：

- 申请 `INTERNET` 权限，仅供「第二问」调用你配置的模型服务；行囊三个模块仍只读写本机
- 行囊网页资源内嵌，离线可用
- 行囊使用 `file:///android_asset/index.html`，数据保存在应用内
- 备份导出通过 JavaScript 桥接直接写入系统 `Download/` 目录
- 导入通过 Android 系统文件选择器
- Android 返回键对应网页返回，或在第二问里返回行囊
- 首页为四模块总览：待办、出差费用、打包清单、第二问
- 桌面小部件：4×4 / 5×5，柔光玻璃 / 轻透磨砂，共 4 种；点击循环显示出差天数、应报销总额、打包进度和待办
- 第二问在独立 Activity + 本地 `127.0.0.1:8788` 安全上下文里运行，使用自己的加密 IndexedDB；导出/导入通过系统下载目录和文件选择器
- 第二问旧独立 APK 的数据不能自动迁移，需在旧 APK 里导出备份，再在新模块里导入
- 备份和迁移以应用内“设置 → 数据 → 导出备份”为准

详细说明见 `android/README.md`。

原始 `第二问/` 目录保留在本机，不纳入 Git（其中含大体积旧 toolchain 和 APK）；集成后的运行资源在 `android/app/src/main/assets/second-question/`，随 APK 一起构建。

## 数据

所有数据保存在本机浏览器的 localStorage、Android WebView 的应用数据，或第二问的加密 IndexedDB 中。行囊模块不上传服务器；第二问的对话会发送给你配置的 OpenAI 兼容模型服务商，API Key 随整库加密保存在本机。

换机、卸载应用或清理浏览器数据前，请在「设置 → 数据 → 导出备份」保存 JSON。Android 版会直接保存到系统“下载”目录；第二问有自己的加密备份和周记导出。

## 目录

```text
src/                 网页源码
android/             Android debug WebView 壳与构建脚本
android/app/src/main/assets/second-question/  第二问资源（独立 WebView）
预览图/              界面截图
build.py             网页构建脚本
使用说明.md          用户使用说明
CHANGELOG.md         版本记录
```

`.toolchain/`、`android/build-out/`、APK、调试密钥和 Android 生成资源不进入 Git。
