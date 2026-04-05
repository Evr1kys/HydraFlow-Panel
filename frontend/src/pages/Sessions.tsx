import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Group,
  Text,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Stack,
  SimpleGrid,
  Button,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { IconAlertTriangle } from '@tabler/icons-react';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import {
  IconPlugConnected,
  IconTrash,
  IconRefresh,
  IconUsers,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import {
  getActiveSessions,
  getActiveSessionCount,
  dropUserSessions,
  dropSession,
} from '../api/active-sessions';
import type { ActiveSession, ActiveSessionCount } from '../types';

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

function formatBytes(bytes: string | number): string {
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (b === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function protocolColor(protocol: string): string {
  if (protocol.includes('reality') || protocol.includes('Reality')) return 'teal';
  if (protocol.includes('ws') || protocol.includes('WebSocket')) return 'blue';
  if (protocol.includes('ss') || protocol.includes('Shadowsocks')) return 'grape';
  return 'gray';
}

export function SessionsPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [counts, setCounts] = useState<ActiveSessionCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, c] = await Promise.all([getActiveSessions(), getActiveSessionCount()]);
      setSessions(s);
      setCounts(c);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
      notifications.show({ title: 'Error', message: 'Failed to load sessions', color: 'red' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleDropUser = async (userId: string) => {
    try {
      const result = await dropUserSessions(userId);
      notifications.show({ title: 'Dropped', message: result.message, color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to drop sessions', color: 'red' });
    }
  };

  const handleDropSession = async (id: string) => {
    try {
      await dropSession(id);
      notifications.show({ title: 'Dropped', message: 'Session terminated', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to drop session', color: 'red' });
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
      {/* Header */}
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
            <IconPlugConnected size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Sessions
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {counts?.total ?? 0} active
          </Badge>
        </Group>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          color="teal"
          radius="md"
          loading={refreshing}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Group>

      {/* Stats */}
      {counts && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Paper p="lg" style={cardStyle}>
            <Group gap="md">
              <Box
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(32,201,151,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconUsers size={20} color="#20C997" stroke={1.5} />
              </Box>
              <Box>
                <Text size="xs" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Total Active
                </Text>
                <Text size="xl" fw={700} style={{ color: '#C1C2C5' }}>
                  {counts.total}
                </Text>
              </Box>
            </Group>
          </Paper>
          {counts.byProtocol.map((p) => (
            <Paper key={p.protocol} p="lg" style={cardStyle}>
              <Group gap="md">
                <Box
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(51,154,240,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconPlugConnected size={20} color="#339AF0" stroke={1.5} />
                </Box>
                <Box>
                  <Text size="xs" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {p.protocol}
                  </Text>
                  <Text size="xl" fw={700} style={{ color: '#C1C2C5' }}>
                    {p.count}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      {/* Sessions Table */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>User</Table.Th>
                <Table.Th style={thStyle}>Protocol</Table.Th>
                <Table.Th style={thStyle}>Client IP</Table.Th>
                <Table.Th style={thStyle}>Node</Table.Th>
                <Table.Th style={thStyle}>Traffic</Table.Th>
                <Table.Th style={thStyle}>Started</Table.Th>
                <Table.Th style={{ ...thStyle, width: 100 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sessions.map((session, idx) => (
                <Table.Tr
                  key={session.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Box>
                      <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                        {session.user.email}
                      </Text>
                      {session.user.remark && (
                        <Text size="xs" style={{ color: '#5c5f66' }}>
                          {session.user.remark}
                        </Text>
                      )}
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={protocolColor(session.protocol)} size="sm">
                      {session.protocol}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                      {session.clientIp}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {session.node?.name ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={8}>
                      <Group gap={2}>
                        <IconArrowUp size={12} color="#20C997" />
                        <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                          {formatBytes(session.bytesUp)}
                        </Text>
                      </Group>
                      <Group gap={2}>
                        <IconArrowDown size={12} color="#339AF0" />
                        <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                          {formatBytes(session.bytesDown)}
                        </Text>
                      </Group>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {new Date(session.startedAt).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {permissions.canDelete && (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            radius="md"
                            onClick={() => handleDropUser(session.userId)}
                            title="Drop all user sessions"
                            style={{ border: '1px solid rgba(255,159,67,0.15)' }}
                          >
                            <IconUsers size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            radius="md"
                            onClick={() => handleDropSession(session.id)}
                            title="Drop this session"
                            style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {sessions.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconPlugConnected}
                      message={t('sessions.noSessions')}
                      minHeight={200}
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
}
