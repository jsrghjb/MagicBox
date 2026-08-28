<div style="display:flex;">
  <img src="docs/public/images/logo.png" alt="MagicBox" width="108px">
</div>

# 魔法百宝箱 (MagicBox)

[![GitHub](https://img.shields.io/github/stars/jsrghjb/MagicBox?label=GitHub%20Stars)](https://github.com/jsrghjb/MagicBox)

Графическое зеркалирование Android-устройств и локальный набор инструментов. [Документация на китайском](./README-CN.md)

## Возможности

- 🖥️ **Встроенное зеркало**: отдельное окно с автоподстройкой разрешения
- 🎛️ **Панель управления**: поворот, скриншот, приложения, файлы, терминал
- 🪟 **Несколько устройств**: управление всеми подключёнными устройствами
- 📡 **Беспроводное подключение**: Wireless ADB и обратный тетеринг
- 🧰 **Инструменты**: диагностика, инициализация и системные переключатели
- ⚡ **Ядро Scrcpy**: зеркалирование с низкой задержкой

## Установка

Установочные файлы публикуются в [GitHub Releases](https://github.com/jsrghjb/MagicBox/releases/latest). Проверка обновлений в приложении использует тот же адрес.

## Документация

- [Начало работы](./docs/en/guide/started.md)
- [Операции с устройством](./docs/en/guide/operation.md)
- [Настройки](./docs/en/guide/preferences.md)

## Для разработчиков

См. [develop.md](./develop.md).

```shell
git clone https://github.com/jsrghjb/MagicBox.git
cd MagicBox
corepack enable pnpm
pnpm install
pnpm dev
```

## Помощь

- [FAQ](./docs/en/help/escrcpy.md)
- [Сообщить о проблеме](https://github.com/jsrghjb/MagicBox/issues)
- [Email](mailto:huangjb@staryea.com)

## Благодарности

Проект использует:

- [scrcpy](https://github.com/Genymobile/scrcpy)
- [adbkit](https://github.com/DeviceFarmer/adbkit)
- [electron](https://www.electronjs.org/)
- [vue](https://vuejs.org/)
- [gnirehtet](https://github.com/Genymobile/gnirehtet/)
