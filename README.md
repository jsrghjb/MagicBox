<div style="display:flex;">
  <img src="docs/public/images/logo.png" alt="MagicBox" width="108px">
</div>

# 魔法百宝箱 (MagicBox)

[![GitHub](https://img.shields.io/github/stars/jsrghjb/MagicBox?label=GitHub%20Stars)](https://github.com/jsrghjb/MagicBox)

Graphical Android device mirroring and a local toolbox for setup, diagnostics, and batch ADB helpers. [中文文档](./README-CN.md)

## Features

- 🖥️ **Inset Mirror**: Dedicated embedded window, auto-fits screen resolution and orientation
- 🎛️ **Control Bar**: Compact sidebar for rotation, screenshot, apps, files, and terminal
- 🪟 **Multi-Device Management**: Manage all connected devices in one place
- 📡 **Wireless Connection**: Wireless ADB with LAN auto-discovery and reverse tethering
- 🧰 **Toolbox**: Device health checks, one-tap initialization, and common system switches
- ⚡ **Scrcpy Core**: High-performance, low-latency screen mirroring and control

## Installation

Installers are published to this repo’s [GitHub Releases](https://github.com/jsrghjb/MagicBox/releases/latest).

In-app “Check for updates” downloads from the same place (`latest.yml` / `latest-mac.yml`). Make the repository public so auto-update can work.

Download by platform:

- macOS: `MagicBox-*-mac-arm64.dmg` or `MagicBox-*-mac-x64.dmg`
- Windows: `MagicBox-*-win-setup-x64.exe`
- Linux: `MagicBox-*-linux-x64.AppImage` or `.deb`

## Documentation

- [Getting Started](./docs/en/guide/started.md)
- [Device Operations](./docs/en/guide/operation.md)
- [Preferences](./docs/en/guide/preferences.md)

## For Developers

See [develop.md](./develop.md).

```shell
git clone https://github.com/jsrghjb/MagicBox.git
cd MagicBox
corepack enable pnpm
pnpm install
pnpm dev
```

## Get Help

- [FAQ](./docs/en/help/escrcpy.md)
- [Report Issues](https://github.com/jsrghjb/MagicBox/issues)
- [Contact](mailto:huangjb@staryea.com)

## Acknowledgments

This project uses the following open-source projects:

- [scrcpy](https://github.com/Genymobile/scrcpy)
- [adbkit](https://github.com/DeviceFarmer/adbkit)
- [electron](https://www.electronjs.org/)
- [vue](https://vuejs.org/)
- [gnirehtet](https://github.com/Genymobile/gnirehtet/)
