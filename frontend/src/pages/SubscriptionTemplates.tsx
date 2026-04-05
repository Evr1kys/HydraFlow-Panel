import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Select,
  Switch,
  ScrollArea,
  Code,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconFileCode2,
  IconAlertTriangle,
  IconStar,
  IconStarFilled,
  IconEye,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import {
  getSubscriptionTemplates,
  createSubscriptionTemplate,
  updateSubscriptionTemplate,
  deleteSubscriptionTemplate,
  setDefaultSubscriptionTemplate,
  previewSubscriptionTemplate,
} from '../api/subscriptionTemplates';
import { getUsers } from '../api/users';
import type { SubscriptionTemplate, User } from '../types';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

const inputStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#C1C2C5',
    borderRadius: 8,
  },
  label: {
    color: '#909296',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: 4,
  },
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

const CLIENT_TYPE_OPTIONS = [
  { value: 'clash', label: 'Clash' },
  { value: 'mihomo', label: 'Mihomo' },
  { value: 'stash', label: 'Stash' },
  { value: 'singbox', label: 'Sing-box' },
  { value: 'xray-json', label: 'Xray JSON' },
  { value: 'v2ray', label: 'V2Ray' },
];

const PLACEHOLDERS: { key: string; description: string }[] = [
  { key: 'server_ip', description: 'Server public IP' },
  { key: 'port', description: 'Host port' },
  { key: 'uuid', description: 'User UUID' },
  { key: 'email', description: 'User email' },
  { key: 'short_uuid', description: 'Shortened UUID' },
  { key: 'sni', description: 'TLS SNI' },
  { key: 'public_key', description: 'Reality public key' },
  { key: 'short_id', description: 'Reality short id' },
  { key: 'remark', description: 'Display name' },
  { key: 'subtoken', description: 'Subscription token' },
  { key: 'expiry_date', description: 'Subscription expiry' },
  { key: 'traffic_limit', description: 'Traffic limit (bytes)' },
  { key: 'flow', description: 'Flow (e.g. xtls-rprx-vision)' },
];

function languageFor(clientType: string): string {
  if (clientType === 'clash' || clientType === 'mihomo' || clientType === 'stash')
    return 'yaml';
  if (clientType === 'singbox' || clientType === 'xray-json') return 'json';
  return 'plaintext';
}

interface TemplateFormValues {
  name: string;
  clientType: string;
  template: string;
  isDefault: boolean;
  enabled: boolean;
}

const emptyForm: TemplateFormValues = {
  name: '',
  clientType: 'clash',
  template: '',
  isDefault: false,
  enabled: true,
};

export function SubscriptionTemplatesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [templates, setTemplates] = useState<SubscriptionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateFormValues>(emptyForm);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(
    null,
  );
  const [users, setUsers] = useState<User[]>([]);

  const fetchTemplates = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getSubscriptionTemplates();
      setTemplates(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (template: SubscriptionTemplate) => {
    setEditing(template);
    setForm({
      name: template.name,
      clientType: template.clientType,
      template: template.template,
      isDefault: template.isDefault,
      enabled: template.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.clientType) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSubscriptionTemplate(editing.id, form);
        notifications.show({
          title: t('common.success'),
          message: t('subscriptionTemplates.updated'),
          color: 'teal',
        });
      } else {
        await createSubscriptionTemplate(form);
        notifications.show({
          title: t('common.success'),
          message: t('subscriptionTemplates.created'),
          color: 'teal',
        });
      }
      setModalOpen(false);
      await fetchTemplates();
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: extractErrorMessage(err),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubscriptionTemplate(id);
      notifications.show({
        title: t('common.success'),
        message: t('subscriptionTemplates.deleted'),
        color: 'teal',
      });
      await fetchTemplates();
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultSubscriptionTemplate(id);
      notifications.show({
        title: t('common.success'),
        message: t('subscriptionTemplates.defaultSet'),
        color: 'teal',
      });
      await fetchTemplates();
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const openPreview = (id: string) => {
    setPreviewTemplateId(id);
    setPreviewContent('');
    setPreviewUserId(users[0]?.id ?? null);
    setPreviewOpen(true);
  };

  const handleRunPreview = async () => {
    if (!previewTemplateId || !previewUserId) return;
    try {
      const { content } = await previewSubscriptionTemplate(
        previewTemplateId,
        previewUserId,
      );
      setPreviewContent(content);
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  if (loading) {
    return <LoadingSkeleton variant="table" rows={4} />;
  }

  if (loadError) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t('common.error')}
        message={loadError}
      />
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <Box
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: 'rgba(32,201,151,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconFileCode2 size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('subscriptionTemplates.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {templates.length}
          </Badge>
        </Group>
        {permissions.canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={openCreate}
          >
            {t('subscriptionTemplates.addTemplate')}
          </Button>
        )}
      </Group>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table
            horizontalSpacing="md"
            verticalSpacing="sm"
            styles={{
              table: { borderCollapse: 'separate', borderSpacing: 0 },
            }}
          >
            <Table.Thead>
              <Table.Tr
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Table.Th style={thStyle}>
                  {t('subscriptionTemplates.name')}
                </Table.Th>
                <Table.Th style={thStyle}>
                  {t('subscriptionTemplates.clientType')}
                </Table.Th>
                <Table.Th style={thStyle}>
                  {t('subscriptionTemplates.default')}
                </Table.Th>
                <Table.Th style={thStyle}>{t('common.enabled')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 160 }}>
                  {t('common.actions')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((tpl, idx) => (
                <Table.Tr
                  key={tpl.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor:
                      idx % 2 === 1
                        ? 'rgba(255,255,255,0.015)'
                        : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                      {tpl.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue" variant="light" size="sm" radius="md">
                      {tpl.clientType}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {tpl.isDefault ? (
                      <Badge color="teal" variant="light" size="sm" radius="md">
                        {t('subscriptionTemplates.default')}
                      </Badge>
                    ) : (
                      <Text size="xs" style={{ color: '#5c5f66' }}>
                        --
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {tpl.enabled ? (
                      <Badge color="teal" variant="light" size="sm" radius="md">
                        {t('common.enabled')}
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light" size="sm" radius="md">
                        {t('common.disabled')}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        radius="md"
                        onClick={() => openPreview(tpl.id)}
                        style={{ border: '1px solid rgba(51,154,240,0.15)' }}
                        title={t('subscriptionTemplates.preview')}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                      {permissions.canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color={tpl.isDefault ? 'yellow' : 'gray'}
                          radius="md"
                          onClick={() => handleSetDefault(tpl.id)}
                          style={{ border: '1px solid rgba(252,196,25,0.15)' }}
                          title={t('subscriptionTemplates.setDefault')}
                        >
                          {tpl.isDefault ? (
                            <IconStarFilled size={14} />
                          ) : (
                            <IconStar size={14} />
                          )}
                        </ActionIcon>
                      )}
                      {permissions.canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          radius="md"
                          onClick={() => openEdit(tpl)}
                          style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                      )}
                      {permissions.canDelete && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          radius="md"
                          onClick={() => handleDelete(tpl.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {templates.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconFileCode2}
                      message={t('subscriptionTemplates.noTemplates')}
                      minHeight={200}
                      action={
                        permissions.canEdit ? (
                          <Button
                            leftSection={<IconPlus size={14} />}
                            variant="light"
                            color="teal"
                            radius="md"
                            size="sm"
                            onClick={openCreate}
                          >
                            {t('subscriptionTemplates.addTemplate')}
                          </Button>
                        ) : undefined
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing
            ? t('subscriptionTemplates.editTemplate')
            : t('subscriptionTemplates.addTemplate')
        }
        radius="lg"
        size="90%"
        styles={{
          content: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          header: {
            backgroundColor: '#1E2128',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
          <Stack gap="md" mt="md">
            <Group grow>
              <TextInput
                label={t('subscriptionTemplates.name')}
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.currentTarget.value })
                }
                styles={inputStyles}
              />
              <Select
                label={t('subscriptionTemplates.clientType')}
                data={CLIENT_TYPE_OPTIONS}
                value={form.clientType}
                onChange={(v) => v && setForm({ ...form, clientType: v })}
                allowDeselect={false}
                styles={inputStyles}
              />
            </Group>
            <Group>
              <Switch
                label={t('subscriptionTemplates.default')}
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.currentTarget.checked })
                }
                color="teal"
                styles={{ label: { color: '#C1C2C5' } }}
              />
              <Switch
                label={t('common.enabled')}
                checked={form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.currentTarget.checked })
                }
                color="teal"
                styles={{ label: { color: '#C1C2C5' } }}
              />
            </Group>
            <Box
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <Editor
                height="500px"
                language={languageFor(form.clientType)}
                value={form.template}
                onChange={(v) => setForm({ ...form, template: v ?? '' })}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                }}
              />
            </Box>
            <Button
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              loading={saving}
              onClick={handleSave}
              radius="md"
              fullWidth
              disabled={!form.name || !form.clientType || saving}
            >
              {editing ? t('common.save') : t('subscriptionTemplates.addTemplate')}
            </Button>
          </Stack>
          <Box
            mt="md"
            style={{
              background: '#161B23',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text
              size="xs"
              fw={700}
              style={{ color: '#909296', letterSpacing: '0.8px' }}
              mb="sm"
            >
              {t('subscriptionTemplates.placeholders')}
            </Text>
            <ScrollArea h={500}>
              <Stack gap={6}>
                {PLACEHOLDERS.map((p) => (
                  <Box key={p.key}>
                    <Code
                      style={{
                        background: 'rgba(32,201,151,0.1)',
                        color: '#20C997',
                        fontSize: 11,
                      }}
                    >{`{{${p.key}}}`}</Code>
                    <Text size="xs" style={{ color: '#5c5f66' }} mt={2}>
                      {p.description}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Box>
        </Box>
      </Modal>

      <Modal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t('subscriptionTemplates.previewTitle')}
        radius="lg"
        size="xl"
        styles={{
          content: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          header: {
            backgroundColor: '#1E2128',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <Group>
            <Select
              label={t('subscriptionTemplates.previewUser')}
              data={users.map((u) => ({ value: u.id, label: u.email }))}
              value={previewUserId}
              onChange={setPreviewUserId}
              searchable
              styles={inputStyles}
              style={{ flex: 1 }}
            />
            <Button
              variant="light"
              color="teal"
              onClick={handleRunPreview}
              style={{ marginTop: 22 }}
              disabled={!previewUserId}
            >
              {t('subscriptionTemplates.render')}
            </Button>
          </Group>
          <Box
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <Editor
              height="420px"
              language="plaintext"
              value={previewContent}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
              }}
            />
          </Box>
        </Stack>
      </Modal>
    </Stack>
  );
}
