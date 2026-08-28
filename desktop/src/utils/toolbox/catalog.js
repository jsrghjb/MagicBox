export const FEATURE_TILES = [
  {
    id: 'diagnose',
    kind: 'buttons',
    label: 'toolbox.health',
    description: 'toolbox.health.desc',
    icon: 'i-solar-heart-pulse-bold-duotone',
    tone: 'tone-teal',
    confirm: '',
    buttons: [
      { mode: 'on', label: 'toolbox.switch.start' },
      { mode: 'pause', label: 'toolbox.switch.pause' },
    ],
  },
  {
    id: 'init',
    kind: 'buttons',
    label: 'toolbox.action.init',
    description: 'toolbox.action.init.desc',
    icon: 'i-solar-restart-bold-duotone',
    tone: 'tone-primary',
    confirm: 'toolbox.confirm.init',
    buttons: [
      { mode: 'on', label: 'toolbox.switch.start' },
      { mode: 'pause', label: 'toolbox.switch.pause' },
    ],
  },
]

export const TOOL_GROUPS = [
  {
    id: 'prepare',
    label: 'toolbox.group.prepare',
    icon: 'i-solar-magic-stick-3-bold-duotone',
    tools: [
      {
        id: 'skipSetup',
        kind: 'switch',
        label: 'toolbox.action.skipSetup',
        description: 'toolbox.action.skipSetup.desc',
        icon: 'i-solar-skip-next-bold-duotone',
        tone: 'tone-sky',
        onLabel: 'toolbox.switch.skip',
        offLabel: 'toolbox.switch.restore',
      },
      {
        id: 'keyboard',
        kind: 'buttons',
        label: 'toolbox.action.keyboard',
        description: 'toolbox.action.keyboard.desc',
        icon: 'i-solar-keyboard-bold-duotone',
        tone: 'tone-violet',
        buttons: [
          { mode: 'install', label: 'toolbox.keyboard.install' },
          { mode: 'on', label: 'toolbox.keyboard.enable' },
          { mode: 'off', label: 'toolbox.switch.off' },
        ],
      },
      {
        id: 'watch',
        kind: 'toggle',
        label: 'toolbox.action.watch',
        description: 'toolbox.action.watch.desc',
        icon: 'i-solar-eye-bold-duotone',
        tone: 'tone-amber',
      },
    ],
  },
  {
    id: 'system',
    label: 'toolbox.group.system',
    icon: 'i-solar-tuning-2-bold-duotone',
    tools: [
      {
        id: 'animation',
        kind: 'switch',
        label: 'toolbox.action.animation',
        description: 'toolbox.action.animation.desc',
        icon: 'i-solar-playback-speed-bold-duotone',
        tone: 'tone-teal',
      },
      {
        id: 'unknownSource',
        kind: 'switch',
        label: 'toolbox.action.unknownSource',
        description: 'toolbox.action.unknownSource.desc',
        icon: 'i-solar-box-bold-duotone',
        tone: 'tone-orange',
        onLabel: 'toolbox.switch.allow',
        offLabel: 'toolbox.switch.deny',
      },
      {
        id: 'playProtect',
        kind: 'switch',
        label: 'toolbox.action.playProtect',
        description: 'toolbox.action.playProtect.desc',
        icon: 'i-solar-shield-check-bold-duotone',
        tone: 'tone-rose',
      },
      {
        id: 'grant',
        kind: 'switch',
        label: 'toolbox.action.grant',
        description: 'toolbox.action.grant.desc',
        icon: 'i-solar-key-bold-duotone',
        tone: 'tone-rose',
        onLabel: 'toolbox.switch.grant',
        offLabel: 'toolbox.switch.revoke',
        confirmOn: 'toolbox.confirm.grant',
        confirmOff: 'toolbox.confirm.revoke',
      },
      {
        id: 'freezeIme',
        kind: 'switch',
        label: 'toolbox.action.freezeIme',
        description: 'toolbox.action.freezeIme.desc',
        icon: 'i-solar-lock-password-bold-duotone',
        tone: 'tone-slate',
        onLabel: 'toolbox.switch.freeze',
        offLabel: 'toolbox.switch.unfreeze',
        confirmOn: 'toolbox.confirm.freezeIme',
      },
      {
        id: 'batteryOpt',
        kind: 'switch',
        label: 'toolbox.action.batteryOpt',
        description: 'toolbox.action.batteryOpt.desc',
        icon: 'i-solar-battery-charge-bold-duotone',
        tone: 'tone-teal',
        onLabel: 'toolbox.switch.restore',
        offLabel: 'toolbox.switch.ignore',
      },
    ],
  },
]

export function findTool(toolId) {
  const featured = FEATURE_TILES.find(item => item.id === toolId)
  if (featured) {
    return featured
  }

  for (const group of TOOL_GROUPS) {
    const tool = group.tools.find(item => item.id === toolId)
    if (tool) {
      return tool
    }
  }
  return null
}

export function createCustomTool(command) {
  return {
    id: command.id,
    kind: 'custom',
    label: command.name,
    description: command.command,
    icon: 'i-solar-code-square-bold-duotone',
    tone: 'tone-slate',
    command: command.command,
  }
}
