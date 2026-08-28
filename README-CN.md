<div style="display:flex;">
  <img src="docs/public/images/logo.png" alt="魔法百宝箱" width="108px">
</div>

# 魔法百宝箱 (MagicBox)

[![GitHub](https://img.shields.io/github/stars/jsrghjb/MagicBox?label=GitHub%20Stars)](https://github.com/jsrghjb/MagicBox)

本地图形化 Android 投屏管理工具，附带新机初始化、健康诊断和常用系统开关。 [English Document](./README.md)

## 功能

- 🖥️ **内嵌镜像**：独立内嵌窗口，自动适配分辨率与屏幕方向
- 🎛️ **集成控制栏**：旋转、截图、应用、文件、终端等快捷操作
- 🪟 **多设备管理**：统一管理所有已连接设备
- 📡 **无线连接**：无线 ADB，支持局域网自动发现与反向供网
- 🧰 **工具箱**：健康诊断、一键初始化、常用系统开关
- ⚡ **Scrcpy 内核**：高性能、低延迟屏幕镜像与控制

## 安装

安装包发布在本仓库的 [GitHub Releases](https://github.com/jsrghjb/MagicBox/releases/latest)。

应用内「检查更新」也会从这里拉取 `latest.yml` / `latest-mac.yml` 安装包。仓库公开后即可自动更新。

请按系统下载：

- macOS：`MagicBox-*-mac-arm64.dmg` 或 `MagicBox-*-mac-x64.dmg`
- Windows：`MagicBox-*-win-setup-x64.exe`
- Linux：`MagicBox-*-linux-x64.AppImage` 或 `.deb`

## 文档

- [快速上手](./docs/zhHans/guide/started.md)
- [设备操作](./docs/zhHans/guide/operation.md)
- [偏好设置](./docs/zhHans/guide/preferences.md)

## 开发

见 [develop.md](./develop.md)。

```shell
git clone https://github.com/jsrghjb/MagicBox.git
cd MagicBox
corepack enable pnpm
pnpm install
pnpm dev
```

## 帮助

- [常见问题](./docs/zhHans/help/escrcpy.md)
- [反馈问题](https://github.com/jsrghjb/MagicBox/issues)
- [联系邮箱](mailto:huangjb@staryea.com)

## 致谢

本项目使用了以下开源项目：

- [scrcpy](https://github.com/Genymobile/scrcpy)
- [adbkit](https://github.com/DeviceFarmer/adbkit)
- [electron](https://www.electronjs.org/)
- [vue](https://vuejs.org/)
- [gnirehtet](https://github.com/Genymobile/gnirehtet/)
