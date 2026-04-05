import { useCallback, useEffect, useState } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Table,
  Badge,
  Box,
  Loader,
  Modal,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDatabase,
  IconDownload,
  IconTrash,
  IconRestore,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  downloadBackupUrl,
  type BackupJob,
} from '../api/backup';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

function formatSize(bytes: string | null): string {
  if (!bytes) return '-';
  const num = Number(bytes);
  if (!Number.isFinite(num) || num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'teal';
    case 'running':
    case 'pending':
      return 'blue';
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

export function BackupPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupJob | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await listBackups();
      setJobs(data);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('backup.loadError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createBackup();
      notifications.show({
        title: t('common.success'),
        message: t('backup.created'),
        color: 'teal',
      });
      await fetchJobs();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('backup.createError'),
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBackup(id);
      notifications.show({
        title: t('common.success'),
        message: t('backup.deleted'),
        color: 'teal',
      });
      await fetchJobs();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('backup.deleteError'),
        color: 'red',
      });
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await restoreBackup(restoreTarget.id);
      notifications.show({
        title: t('common.success'),
        message: t('backup.restored'),
        color: 'teal',
      });
      setRestoreTarget(null);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('backup.restoreError'),
        color: 'red',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleDownload = (id: string) => {
    const token = localStorage.getItem('hydraflow_token');
    const url = downloadBackupUrl(id);
    // Use fetch with auth header to download
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const href = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `backup-${id}.sql.gz`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(href);
      })
      .catch(() => {
        notifications.show({
          title: t('common.error'),
          message: t('backup.downloadError'),
          color: 'red',
        });
      });
  };

  if (loading) {
    return (
      <Box
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Loader color="teal" />
      </Box>
    );
  }

  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
          {t('backup.title')}
        </Text>
        <Button
          leftSection={<IconDatabase size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          loading={creating}
          onClick={handleCreate}
        >
          {t('backup.createNow')}
        </Button>
      </Group>

      <Paper p="lg" style={cardStyle}>
        {jobs.length === 0 ? (
          <Text size="sm" style={{ color: '#5c5f66' }}>
            {t('backup.noBackups')}
          </Text>
        ) : (
          <Table
            horizontalSpacing="md"
            verticalSpacing="xs"
            styles={{ table: { borderCollapse: 'separate', borderSpacing: 0 } }}
          >
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Table.Th style={thStyle}>{t('backup.date')}</Table.Th>
                <Table.Th style={thStyle}>{t('backup.type')}</Table.Th>
                <Table.Th style={thStyle}>{t('backup.status')}</Table.Th>
                <Table.Th style={thStyle}>{t('backup.size')}</Table.Th>
                <Table.Th style={{ ...thStyle, textAlign: 'right' }}>
                  {t('backup.actions')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr
                  key={job.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <Table.Td>
                    <Text size="xs" style={{ color: '#C1C2C5' }}>
                      {new Date(job.startedAt).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      variant="light"
                      color={job.type === 'manual' ? 'blue' : 'grape'}
                    >
                      {job.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={statusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                      {formatSize(job.fileSize)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <Tooltip label={t('backup.download')} withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="teal"
                          disabled={job.status !== 'completed'}
                          onClick={() => handleDownload(job.id)}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('backup.restore')} withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="orange"
                          disabled={job.status !== 'completed'}
                          onClick={() => setRestoreTarget(job)}
                        >
                          <IconRestore size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('backup.delete')} withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(job.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title={
          <Group gap={8}>
            <IconAlertTriangle size={18} color="#ff6b6b" />
            <Text fw={600} style={{ color: '#C1C2C5' }}>
              {t('backup.restoreTitle')}
            </Text>
          </Group>
        }
        centered
        styles={{
          content: { backgroundColor: '#1E2128' },
          header: { backgroundColor: '#1E2128' },
        }}
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: '#909296' }}>
            {t('backup.restoreWarning')}
          </Text>
          {restoreTarget && (
            <Paper p="sm" style={{ backgroundColor: '#161B23', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8 }}>
              <Text size="xs" style={{ color: '#5c5f66' }}>
                {new Date(restoreTarget.startedAt).toLocaleString()} — {formatSize(restoreTarget.fileSize)}
              </Text>
            </Paper>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setRestoreTarget(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button color="red" loading={restoring} onClick={handleRestore}>
              {t('backup.confirmRestore')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
