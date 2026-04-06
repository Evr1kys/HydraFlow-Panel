import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  Textarea,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { IconAlertTriangle } from '@tabler/icons-react';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconFileCode,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  getConfigProfiles,
  createConfigProfile,
  deleteConfigProfile,
  setDefaultProfile,
} from '../api/configProfiles';
import type { ConfigProfile } from '../types';

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

export function ConfigProfilesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newConfig, setNewConfig] = useState('{\n  \n}');

  const fetchProfiles = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getConfigProfiles();
      setProfiles(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
      notifications.show({
        title: t('common.error'),
        message: t('notification.profileCreateError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreate = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      await createConfigProfile({ name: newName, config: newConfig });
      setCreateOpen(false);
      setNewName('');
      setNewConfig('{\n  \n}');
      notifications.show({
        title: t('common.success'),
        message: t('notification.profileCreated'),
        color: 'teal',
      });
      await fetchProfiles();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.profileCreateError'),
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConfigProfile(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.profileDeleted'),
        color: 'teal',
      });
      await fetchProfiles();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.profileDeleteError'),
        color: 'red',
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProfile(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.profileSetDefault'),
        color: 'teal',
      });
      await fetchProfiles();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.profileSetDefaultError'),
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

  const configIsValid = (() => {
    if (!newConfig.trim()) return true;
    try {
      JSON.parse(newConfig);
      return true;
    } catch {
      return false;
    }
  })();

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
            <IconFileCode size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('configProfiles.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {profiles.length}
          </Badge>
        </Group>
        {permissions.canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={() => setCreateOpen(true)}
          >
            {t('configProfiles.addProfile')}
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
                <Table.Th style={thStyle}>{t('configProfiles.name')}</Table.Th>
                <Table.Th style={thStyle}>{t('configProfiles.created')}</Table.Th>
                <Table.Th style={thStyle}>{t('configProfiles.default')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 120 }}>{t('configProfiles.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profiles.map((profile, idx) => (
                <Table.Tr
                  key={profile.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#252A35';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';
                  }}
                >
                  <Table.Td>
                    <Group gap={8}>
                      <IconFileCode size={16} color="#339AF0" stroke={1.5} />
                      <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                        {profile.name}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {profile.isDefault ? (
                      <Badge color="teal" variant="light" size="sm" radius="md">
                        {t('configProfiles.default')}
                      </Badge>
                    ) : (
                      <Text size="xs" style={{ color: '#5c5f66' }}>
                        --
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {permissions.canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color={profile.isDefault ? 'yellow' : 'gray'}
                          radius="md"
                          onClick={() => handleSetDefault(profile.id)}
                          style={{ border: '1px solid rgba(252,196,25,0.15)' }}
                          title={t('configProfiles.setDefault')}
                        >
                          {profile.isDefault ? (
                            <IconStarFilled size={14} />
                          ) : (
                            <IconStar size={14} />
                          )}
                        </ActionIcon>
                      )}
                      {permissions.canDelete && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          radius="md"
                          onClick={() => handleDelete(profile.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                          title={t('configProfiles.deleteProfile')}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {profiles.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconFileCode}
                      message={t('configProfiles.noProfiles')}
                      minHeight={200}
                      action={
                        permissions.canEdit ? (
                          <Button
                            leftSection={<IconPlus size={14} />}
                            variant="light"
                            color="teal"
                            radius="md"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                          >
                            {t('configProfiles.addProfile')}
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
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('configProfiles.createProfile')}
        radius="lg"
        size="lg"
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
          <TextInput
            label={t('configProfiles.profileName')}
            placeholder={t('configProfiles.profileNamePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            error={newName.trim() === '' ? t('validation.required') : null}
            styles={inputStyles}
          />
          <Textarea
            label={t('configProfiles.jsonConfig')}
            value={newConfig}
            onChange={(e) => setNewConfig(e.currentTarget.value)}
            error={configIsValid ? null : t('validation.json')}
            minRows={12}
            maxRows={20}
            autosize
            styles={{
              input: {
                backgroundColor: '#161B23',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#C1C2C5',
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                lineHeight: 1.6,
              },
              label: {
                color: '#909296',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: 4,
              },
            }}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            radius="md"
            fullWidth
            disabled={!newName.trim() || !configIsValid || creating}
          >
            {t('configProfiles.create')}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default ConfigProfilesPage;
