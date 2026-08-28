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
      span: 24,
    },
    aiApiKey: {
      label: 'automation.ai.config.apiKey',
      field: 'aiApiKey',
      type: 'Input',
      value: '',
      placeholder: 'automation.ai.config.apiKeyPlaceholder',
      span: 24,
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
      span: 24,
    },
  },
}
