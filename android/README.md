# 行囊 Android 调试壳

这是 `行囊` 的 Android debug 安装壳，不包含正式发布签名，也不用于应用商店。

- 包名：`com.xingnang.packing`
- 版本：`1.3.1` / `versionCode 6`
- 最低 Android：10（API 29）
- 目标 Android：14（API 34）
- 申请 `INTERNET` 权限，仅供「第二问」调用模型服务
- 行囊网页资源内嵌在 `app/src/main/assets/index.html`
- 行囊通过 `file:///android_asset/index.html` 加载
- 第二问资源在 `app/src/main/assets/second-question/`，由独立 `SecondQuestionActivity` 内的本地 loopback 服务（`127.0.0.1:8788`）加载，保证 WebCrypto / IndexedDB 的安全上下文
- 备份通过 `AndroidBridge.saveBackup()` 写入系统 `Download/` 目录
- 文件导入使用系统文件选择器
- 4 个桌面小部件：4×4 / 5×5，柔光玻璃 / 轻透磨砂
- 小部件点击循环显示：出差总天数、应报销总额、打包进度、待办未完成
- 打包清单支持二级子包裹、13 种默认包裹图标和整包物品转移
- 第二问在独立 WebView 和独立数据空间里运行；旧独立 APK 的数据需在旧应用里导出备份后导入

## 构建与安装

需要 JDK 17+ 和 Android SDK（platform 35、build-tools 35.0.0、platform-tools）。

```powershell
.\android\build_debug.ps1
```

连接手机并开启 USB 调试后：

```powershell
.\android\build_debug.ps1 -Install
```

构建产物：

```text
android/build-out/行囊-debug-1.3.1.apk
```

这只是 debug APK。它不会提交到 Git，也不适合公开分发。
