import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  NumberInput,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Select,
  Switch,
  Divider,
  TagsInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconServerBolt,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import {
  getHosts,
  createHost,
  updateHost,
  deleteHost,
  bulkEnableHosts,
  bulkDisableHosts,
  bulkDeleteHosts,
  type CreateHostInput,
} from '../api/hosts';
import type { Host } from '../types';

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

const PROTOCOL_OPTIONS = [
  { value: 'vless', label: 'VLESS' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'ss', label: 'Shadowsocks' },
];

const SECURITY_OPTIONS = [
  { value: 'reality', label: 'Reality' },
  { value: 'tls', label: 'TLS' },
  { value: 'none', label: 'None' },
];

const NETWORK_OPTIONS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'ws', label: 'WebSocket' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'xhttp', label: 'xHTTP' },
];

interface HostFormValues {
  remark: string;
  protocol: string;
  port: number | '';
  sni: string;
  path: string;
  host: string;
  security: string;
  flow: string;
  fingerprint: string;
  publicKey: string;
  shortId: string;
  alpn: string[];
  network: string;
  serviceName: string;
  headerType: string;
  enabled: boolean;
  sortOrder: number;
}

const emptyForm: HostFormValues = {
  remark: '',
  protocol: 'vless',
  port: 443,
  sni: '',
  path: '',
  host: '',
  security: 'reality',
  flow: '',
  fingerprint: 'chrome',
  publicKey: '',
  shortId: '',
  alpn: [],
  network: 'tcp',
  serviceName: '',
  headerType: '',
  enabled: true,
  sortOrder: 0,
};

function protocolColor(protocol: string): string {
  switch (protocol) {
    case 'vless':
      return 'teal';
    case 'trojan':
      return 'violet';
    case 'ss':
      return 'cyan';
    default:
      return 'gray';
  }
}

export function HostsPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Host | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<HostFormValues>(emptyForm);

  const fetchHosts = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getHosts();
      setHosts(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (host: Host) => {
    setEditing(host);
    setForm({
      remark: host.remark,
      protocol: host.protocol,
      port: host.port,
      sni: host.sni ?? '',
      path: host.path ?? '',
      host: host.host ?? '',
      security: host.security,
      flow: host.flow ?? '',
      fingerprint: host.fingerprint ?? 'chrome',
      publicKey: host.publicKey ?? '',
      shortId: host.shortId ?? '',
      alpn: host.alpn ?? [],
      network: host.network,
      serviceName: host.serviceName ?? '',
      headerType: host.headerType ?? '',
      enabled: host.enabled,
      sortOrder: host.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.remark || form.port === '' || !form.protocol) return;
    setSaving(true);
    const payload: CreateHostInput = {
      remark: form.remark,
      protocol: form.protocol,
      port: Number(form.port),
      sni: form.sni || undefined,
      path: form.path || undefined,
      host: form.host || undefined,
      security: form.security,
      flow: form.flow || undefined,
      fingerprint: form.fingerprint || undefined,
      publicKey: form.publicKey || undefined,
      shortId: form.shortId || undefined,
      alpn: form.alpn,
      network: form.network,
      serviceName: form.serviceName || undefined,
      headerType: form.headerType || undefined,
      enabled: form.enabled,
      sortOrder: form.sortOrder,
    };
    try {
      if (editing) {
        await updateHost(editing.id, payload);
        notifications.show({
          title: t('common.success'),
          message: t('hosts.updated'),
          color: 'teal',
        });
      } else {
        await createHost(payload);
        notifications.show({
          title: t('common.success'),
          message: t('hosts.created'),
          color: 'teal',
        });
      }
      setModalOpen(false);
      await fetchHosts();
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
      await deleteHost(id);
      notifications.show({
        title: t('common.success'),
        message: t('hosts.deleted'),
        color: 'teal',
      });
      await fetchHosts();
    } catch (err) {
      notifications.show({
        title: t('common.error'),
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulk = async (
    action: 'enable' | 'disable' | 'delete',
  ): Promise<void> => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      if (action === 'enable') await bulkEnableHosts(ids);
      else if (action === 'disable') await bulkDisableHosts(ids);
      else await bulkDeleteHosts(ids);
      setSelectedIds(new Set());
      notifications.show({
        title: t('common.success'),
        message: t('hosts.bulkDone'),
        color: 'teal',
      });
      await fetchHosts();
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
            <IconServerBolt size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('hosts.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {hosts.length}
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
            {t('hosts.addHost')}
          </Button>
        )}
      </Group>

      {selectedIds.size > 0 && permissions.canEdit && (
        <Paper p="sm" style={cardStyle}>
          <Group justify="space-between">
            <Text size="sm" style={{ color: '#C1C2C5' }}>
              {t('hosts.selected', { count: selectedIds.size })}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconCheck size={14} />}
                onClick={() => handleBulk('enable')}
              >
                {t('hosts.enableAll')}
              </Button>
              <Button
                size="xs"
                variant="light"
                color="yellow"
                leftSection={<IconX size={14} />}
                onClick={() => handleBulk('disable')}
              >
                {t('hosts.disableAll')}
              </Button>
              {permissions.canDelete && (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => handleBulk('delete')}
                >
                  {t('hosts.deleteSelected')}
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

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
                <Table.Th style={{ ...thStyle, width: 36 }}></Table.Th>
                <Table.Th style={thStyle}>{t('hosts.remark')}</Table.Th>
                <Table.Th style={thStyle}>{t('hosts.protocol')}</Table.Th>
                <Table.Th style={thStyle}>{t('hosts.port')}</Table.Th>
                <Table.Th style={thStyle}>{t('hosts.sni')}</Table.Th>
                <Table.Th style={thStyle}>{t('hosts.linkedNodes')}</Table.Th>
                <Table.Th style={thStyle}>{t('hosts.status')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 120 }}>
                  {t('hosts.actions')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {hosts.map((host, idx) => (
                <Table.Tr
                  key={host.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor:
                      idx % 2 === 1
                        ? 'rgba(255,255,255,0.015)'
                        : 'transparent',
                  }}
                >
                  <Table.Td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(host.id)}
                      onChange={() => toggleSelected(host.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                      {host.remark}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={protocolColor(host.protocol)}
                      variant="light"
                      size="sm"
                      radius="md"
                    >
                      {host.protocol}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                      {host.port}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {host.sni || '--'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue" variant="light" size="sm" radius="md">
                      {host.nodes?.length ?? 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {host.enabled ? (
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
                      {permissions.canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          radius="md"
                          onClick={() => openEdit(host)}
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
                          onClick={() => handleDelete(host.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {hosts.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconServerBolt}
                      message={t('hosts.noHosts')}
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
                            {t('hosts.addHost')}
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
        title={editing ? t('hosts.editHost') : t('hosts.addHost')}
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
          <Divider label={t('hosts.sectionGeneral')} labelPosition="left" />
          <Group grow>
            <TextInput
              label={t('hosts.remark')}
              placeholder="Main Reality"
              value={form.remark}
              onChange={(e) =>
                setForm({ ...form, remark: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <Select
              label={t('hosts.protocol')}
              data={PROTOCOL_OPTIONS}
              value={form.protocol}
              onChange={(v) => v && setForm({ ...form, protocol: v })}
              allowDeselect={false}
              styles={inputStyles}
            />
            <NumberInput
              label={t('hosts.port')}
              value={form.port}
              onChange={(v) =>
                setForm({ ...form, port: v === '' ? '' : Number(v) })
              }
              min={1}
              max={65535}
              styles={inputStyles}
            />
          </Group>
          <Group grow>
            <NumberInput
              label={t('hosts.sortOrder')}
              value={form.sortOrder}
              onChange={(v) =>
                setForm({ ...form, sortOrder: v === '' ? 0 : Number(v) })
              }
              styles={inputStyles}
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

          <Divider label={t('hosts.sectionSecurity')} labelPosition="left" />
          <Group grow>
            <TextInput
              label={t('hosts.sni')}
              placeholder="www.apple.com"
              value={form.sni}
              onChange={(e) =>
                setForm({ ...form, sni: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <Select
              label={t('hosts.security')}
              data={SECURITY_OPTIONS}
              value={form.security}
              onChange={(v) => v && setForm({ ...form, security: v })}
              allowDeselect={false}
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.flow')}
              placeholder="xtls-rprx-vision"
              value={form.flow}
              onChange={(e) =>
                setForm({ ...form, flow: e.currentTarget.value })
              }
              styles={inputStyles}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t('hosts.fingerprint')}
              placeholder="chrome"
              value={form.fingerprint}
              onChange={(e) =>
                setForm({ ...form, fingerprint: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.publicKey')}
              value={form.publicKey}
              onChange={(e) =>
                setForm({ ...form, publicKey: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.shortId')}
              value={form.shortId}
              onChange={(e) =>
                setForm({ ...form, shortId: e.currentTarget.value })
              }
              styles={inputStyles}
            />
          </Group>
          <TagsInput
            label={t('hosts.alpn')}
            placeholder="h2, http/1.1"
            value={form.alpn}
            onChange={(v) => setForm({ ...form, alpn: v })}
            styles={inputStyles}
          />

          <Divider label={t('hosts.sectionNetwork')} labelPosition="left" />
          <Group grow>
            <Select
              label={t('hosts.network')}
              data={NETWORK_OPTIONS}
              value={form.network}
              onChange={(v) => v && setForm({ ...form, network: v })}
              allowDeselect={false}
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.path')}
              placeholder="/ws"
              value={form.path}
              onChange={(e) =>
                setForm({ ...form, path: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.hostHeader')}
              placeholder="example.com"
              value={form.host}
              onChange={(e) =>
                setForm({ ...form, host: e.currentTarget.value })
              }
              styles={inputStyles}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t('hosts.serviceName')}
              value={form.serviceName}
              onChange={(e) =>
                setForm({ ...form, serviceName: e.currentTarget.value })
              }
              styles={inputStyles}
            />
            <TextInput
              label={t('hosts.headerType')}
              placeholder="http"
              value={form.headerType}
              onChange={(e) =>
                setForm({ ...form, headerType: e.currentTarget.value })
              }
              styles={inputStyles}
            />
          </Group>

          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={saving}
            onClick={handleSave}
            radius="md"
            fullWidth
            disabled={
              !form.remark || form.port === '' || !form.protocol || saving
            }
          >
            {editing ? t('common.save') : t('hosts.addHost')}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default HostsPage;
