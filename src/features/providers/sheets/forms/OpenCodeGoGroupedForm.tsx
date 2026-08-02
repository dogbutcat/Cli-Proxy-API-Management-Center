import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { IconPlus, IconTrash2 } from '@/components/ui/icons';
import type { OpenCodeGoKeyGroup, OpenCodeGoModelEntry } from '@/types';
import type {
  ModelEntryInput,
  OpenCodeGoKeyEntryInput,
  OpenCodeGoKeyGroupInput,
  OpenCodeGoProtocol,
  OpenCodeGoSubConfigInput,
  ProviderEntryFormInput,
  ProviderResource,
} from '../../types';
import { ModelEntriesEditor } from './ModelEntriesEditor';
import styles from './sharedForm.module.scss';

interface OpenCodeGoGroupedFormProps {
  resource: ProviderResource | null;
  mode: 'create' | 'edit';
  mutating: boolean;
  formId: string;
  onSubmit: (input: ProviderEntryFormInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const emptyModel = (): ModelEntryInput => ({ name: '', alias: '' });

const emptySubConfig = (protocol: OpenCodeGoProtocol): OpenCodeGoSubConfigInput => ({
  nameSuffix: protocol,
  baseUrl: '',
  prefix: '',
  priority: undefined,
  models: [emptyModel()],
});

const emptyKeyEntry = (): OpenCodeGoKeyEntryInput => ({
  name: '',
  apiKey: '',
  existingApiKey: undefined,
  workspaceId: '',
  authCookie: '',
  proxyUrl: '',
});

const emptyGroup = (): OpenCodeGoKeyGroupInput => ({
  namePrefix: 'opencode-go',
  disabled: false,
  disableCooling: false,
  headers: [{ key: '', value: '' }],
  subConfigs: {
    openai: emptySubConfig('openai'),
    anthropic: emptySubConfig('anthropic'),
  },
  keyEntries: [emptyKeyEntry()],
});

const modelsFromConfig = (models: OpenCodeGoModelEntry[] | undefined): ModelEntryInput[] =>
  models?.length
    ? models.map((model) => ({
        name: model.name,
        alias: model.alias ?? '',
      }))
    : [emptyModel()];

const subConfigFromResource = (
  protocol: OpenCodeGoProtocol,
  group: OpenCodeGoKeyGroup
): OpenCodeGoSubConfigInput => {
  const config = protocol === 'openai' ? group.openai : group.anthropic;
  if (!config) return emptySubConfig(protocol);
  return {
    nameSuffix: config.nameSuffix ?? protocol,
    baseUrl: config.baseUrl ?? '',
    prefix: config.prefix ?? '',
    priority: config.priority,
    models: modelsFromConfig(config.models),
  };
};

const groupFromResource = (resource: ProviderResource | null): OpenCodeGoKeyGroupInput => {
  const group = resource?.raw as OpenCodeGoKeyGroup | undefined;
  if (!group) return emptyGroup();
  return {
    namePrefix: group.namePrefix || 'opencode-go',
    disabled: group.disabled === true,
    disableCooling: group.disableCooling === true,
    headers: group.headers
      ? Object.entries(group.headers).map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }],
    subConfigs: {
      openai: subConfigFromResource('openai', group),
      anthropic: subConfigFromResource('anthropic', group),
    },
    keyEntries: group.keys.length
      ? group.keys.map((key) => ({
          name: key.keyName ?? '',
          apiKey: '',
          existingApiKey: key.apiKey,
          workspaceId: key.workspaceId ?? '',
          authCookie: key.authCookie ?? '',
          proxyUrl: key.proxyUrl ?? '',
        }))
      : [emptyKeyEntry()],
  };
};

export function OpenCodeGoGroupedForm({
  resource,
  mode,
  mutating,
  formId,
  onSubmit,
  onDirtyChange,
}: OpenCodeGoGroupedFormProps) {
  const { t } = useTranslation();
  const initial = useMemo(() => groupFromResource(resource), [resource]);
  const [group, setGroup] = useState<OpenCodeGoKeyGroupInput>(initial);

  const markDirty = () => onDirtyChange?.(true);
  const updateGroup = (patch: Partial<OpenCodeGoKeyGroupInput>) => {
    setGroup((current) => ({ ...current, ...patch }));
    markDirty();
  };
  const updateSubConfig = (
    protocol: OpenCodeGoProtocol,
    patch: Partial<OpenCodeGoSubConfigInput>
  ) => {
    setGroup((current) => ({
      ...current,
      subConfigs: {
        ...current.subConfigs,
        [protocol]: { ...current.subConfigs[protocol], ...patch },
      },
    }));
    markDirty();
  };
  const updateKeyEntry = (index: number, patch: Partial<OpenCodeGoKeyEntryInput>) => {
    setGroup((current) => ({
      ...current,
      keyEntries: current.keyEntries.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      ),
    }));
    markDirty();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit({
      apiKey: '',
      name: '',
      baseUrl: '',
      proxyUrl: '',
      prefix: '',
      disabled: false,
      models: [],
      headers: [],
      excludedModelsText: '',
      openCodeGoKeyGroups: [group],
    });
  };

  const renderProtocol = (protocol: OpenCodeGoProtocol) => {
    const config = group.subConfigs[protocol];
    const protocolLabel =
      protocol === 'openai'
        ? t('providersPage.openCodeGoForm.openaiConfig', { defaultValue: 'OpenAI config' })
        : t('providersPage.openCodeGoForm.anthropicConfig', {
            defaultValue: 'Anthropic config',
          });
    return (
      <Collapsible key={protocol} label={protocolLabel} defaultOpen>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>
              {t('providersPage.openCodeGoForm.nameSuffix', { defaultValue: 'Name suffix' })}
            </label>
            <input
              className={styles.input}
              value={config.nameSuffix}
              onChange={(event) => updateSubConfig(protocol, { nameSuffix: event.target.value })}
              disabled={mutating}
              placeholder={protocol}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('providersPage.form.priority')}</label>
            <input
              className={styles.input}
              type="number"
              value={config.priority ?? ''}
              onChange={(event) =>
                updateSubConfig(protocol, {
                  priority: event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
              disabled={mutating}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('providersPage.form.baseUrl')}</label>
          <input
            className={styles.input}
            type="url"
            value={config.baseUrl}
            onChange={(event) => updateSubConfig(protocol, { baseUrl: event.target.value })}
            disabled={mutating}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('providersPage.form.prefix')}</label>
          <input
            className={styles.input}
            value={config.prefix}
            onChange={(event) => updateSubConfig(protocol, { prefix: event.target.value })}
            disabled={mutating}
          />
        </div>
        <ModelEntriesEditor
          models={config.models}
          supportsImage={false}
          supportsThinking={false}
          mutating={mutating}
          removeDisabled={config.models.length <= 1}
          onUpdate={(index, patch) =>
            updateSubConfig(protocol, {
              models: config.models.map((model, currentIndex) =>
                currentIndex === index ? { ...model, ...patch } : model
              ),
            })
          }
          onAdd={() => updateSubConfig(protocol, { models: [...config.models, emptyModel()] })}
          onRemove={(index) =>
            updateSubConfig(protocol, {
              models: config.models.filter((_, currentIndex) => currentIndex !== index),
            })
          }
        />
      </Collapsible>
    );
  };

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label}>
          {t('providersPage.openCodeGoForm.namePrefix', { defaultValue: 'Name prefix' })}
        </label>
        <input
          className={styles.input}
          value={group.namePrefix}
          onChange={(event) => updateGroup({ namePrefix: event.target.value })}
          disabled={mutating}
          required
        />
      </div>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          className={styles.checkboxBox}
          checked={group.disabled}
          onChange={(event) => updateGroup({ disabled: event.target.checked })}
          disabled={mutating}
        />
        <span className={styles.checkboxText}>
          <span>{t('providersPage.form.disabled')}</span>
          <small>{t('providersPage.form.disabledHint')}</small>
        </span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          className={styles.checkboxBox}
          checked={group.disableCooling}
          onChange={(event) => updateGroup({ disableCooling: event.target.checked })}
          disabled={mutating}
        />
        <span className={styles.checkboxText}>
          <span>{t('providersPage.form.disableCooling')}</span>
          <small>{t('providersPage.form.disableCoolingHint')}</small>
        </span>
      </label>
      {renderProtocol('openai')}
      {renderProtocol('anthropic')}
      <Collapsible
        label={t('providersPage.openCodeGoForm.keyEntriesTitle', { defaultValue: 'Keys' })}
        defaultOpen
      >
        {group.keyEntries.map((entry, index) => (
          <div key={index} className={styles.apiKeyEntryCard}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('providersPage.openCodeGoForm.keyEntryName', {
                    defaultValue: 'Key name',
                  })}
                </label>
                <input
                  className={styles.input}
                  value={entry.name}
                  onChange={(event) => updateKeyEntry(index, { name: event.target.value })}
                  disabled={mutating}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('providersPage.form.apiKey')}</label>
                <input
                  className={styles.input}
                  type="password"
                  value={entry.apiKey}
                  onChange={(event) => updateKeyEntry(index, { apiKey: event.target.value })}
                  disabled={mutating}
                  placeholder={
                    mode === 'edit'
                      ? t('providersPage.form.apiKeyEditPlaceholder')
                      : t('providersPage.form.apiKeyCreatePlaceholder')
                  }
                  required={mode === 'create' && !entry.existingApiKey}
                />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('providersPage.openCodeGoForm.workspaceId', {
                    defaultValue: 'Workspace ID',
                  })}
                </label>
                <input
                  className={styles.input}
                  value={entry.workspaceId}
                  onChange={(event) => updateKeyEntry(index, { workspaceId: event.target.value })}
                  disabled={mutating}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('providersPage.openCodeGoForm.authCookie', {
                    defaultValue: 'Auth cookie',
                  })}
                </label>
                <input
                  className={styles.input}
                  value={entry.authCookie}
                  onChange={(event) => updateKeyEntry(index, { authCookie: event.target.value })}
                  disabled={mutating}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('providersPage.form.proxyUrl')}</label>
              <input
                className={styles.input}
                type="url"
                value={entry.proxyUrl}
                onChange={(event) => updateKeyEntry(index, { proxyUrl: event.target.value })}
                disabled={mutating}
              />
            </div>
            {group.keyEntries.length > 1 ? (
              <button
                type="button"
                className={`${styles.footerBtn} ${styles.footerBtnGhost}`}
                onClick={() =>
                  updateGroup({
                    keyEntries: group.keyEntries.filter(
                      (_, currentIndex) => currentIndex !== index
                    ),
                  })
                }
                disabled={mutating}
              >
                <IconTrash2 size={14} />
                {t('providersPage.openCodeGoForm.removeKey', { defaultValue: 'Remove key' })}
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className={`${styles.footerBtn} ${styles.footerBtnGhost}`}
          onClick={() => updateGroup({ keyEntries: [...group.keyEntries, emptyKeyEntry()] })}
          disabled={mutating}
        >
          <IconPlus size={14} />
          {t('providersPage.openCodeGoForm.addKey', { defaultValue: 'Add key' })}
        </button>
      </Collapsible>
    </form>
  );
}
