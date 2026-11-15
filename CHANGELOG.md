# 更新记录

## v1.0.0 — 2026-11-15

首个 Android 调试安装版。

- 新增 Android WebView 壳，包名 `com.xingnang.packing`
- Android `versionName 1.0.0`、`versionCode 1`
- 内嵌网页版 v1.3.0
- 不申请网络权限，网页资源全部内嵌
- 支持 USB 调试安装和 `adb install -r` 覆盖安装
- 备份导出通过原生桥接写入系统 `Download/` 目录
- 备份导入使用 Android 系统文件选择器
- Android 返回键映射到网页的历史返回
- 网页版新增多份命名待办清单；旧单清单待办自动迁移
- 开启新行程只重置物品，待办清单不再被重置
