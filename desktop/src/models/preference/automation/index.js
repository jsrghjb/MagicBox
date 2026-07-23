export default {
  label: 'preferences.automation.name',
  field: 'automation',

  children: {
    aiBaseUrl: {
      label: 'automation.ai.config.baseUrl',
      field: 'aiBaseUrl',
      type: 'Input',
      value: 'https://open.bigmodel.cn/api/paas/v4',
      placeholder: 'https://open.bigmodel.cn/api/paas/v4',
    },
    aiApiKey: {
      label: 'automation.ai.config.apiKey',
      field: 'aiApiKey',
      type: 'Input',
      value: '',
      placeholder: 'automation.ai.config.apiKeyPlaceholder',
      props: {
        type: 'password',
        showPassword: true,
      },
    },
    aiModel: {
      label: 'automation.ai.config.model',
      field: 'aiModel',
      type: 'Input',
      value: 'glm-4-flash',
      placeholder: 'glm-4-flash',
    },
    enableHotkeys: {
      label: 'preferences.automation.enableHotkeys',
      field: 'enableHotkeys',
      type: 'Switch',
      value: true,
    },
    hotkey1: {
      label: 'preferences.automation.hotkey1',
      field: 'hotkey1',
      type: 'Input',
      value: 'CmdOrCtrl+Alt+1',
      placeholder: 'CmdOrCtrl+Alt+1',
    },
    hotkey2: {
      label: 'preferences.automation.hotkey2',
      field: 'hotkey2',
      type: 'Input',
      value: 'CmdOrCtrl+Alt+2',
      placeholder: 'CmdOrCtrl+Alt+2',
    },
    hotkey3: {
      label: 'preferences.automation.hotkey3',
      field: 'hotkey3',
      type: 'Input',
      value: 'CmdOrCtrl+Alt+3',
      placeholder: 'CmdOrCtrl+Alt+3',
    },
    hotkey4: {
      label: 'preferences.automation.hotkey4',
      field: 'hotkey4',
      type: 'Input',
      value: 'CmdOrCtrl+Alt+4',
      placeholder: 'CmdOrCtrl+Alt+4',
    },
    hotkey5: {
      label: 'preferences.automation.hotkey5',
      field: 'hotkey5',
      type: 'Input',
      value: 'CmdOrCtrl+Alt+5',
      placeholder: 'CmdOrCtrl+Alt+5',
    },
  },
}
