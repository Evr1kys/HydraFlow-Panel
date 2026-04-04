import { useEffect, useState } from 'react';
import {
  SimpleGrid,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Title,
  Box,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUsers,
  IconUserCheck,
  IconArrowsUpDown,
  IconClock,
  IconShieldCheck,
  IconWorld,
  IconLock,
  IconAlertTriangle,
  IconRefresh,
  IconCircleFilled,
} from '@tabler/icons-react';
import { getDashboardStats } from '../api/dashboard';
import { getHealth } from '../api/health';
import { restartXray } from '../api/xray';
import type { DashboardStats, ProtocolHealth } from '../types';

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        backgroundColor: '#0b1121',
        border: '1px solid #1a2940',
      }}
    >
      <Group justify="space-between">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {title}
          </Text>
          <Text size="xl" fw={700} mt={4} style={{ color }}>
            {value}
          </Text>
        </Box>
        <Box style={{ color, opacity: 0.7 }}>{icon}</Box>
      </Group>
    </Paper>
  );
}

interface ProtocolCardProps {
  name: string;
  port: number;
  enabled: boolean;
  health: ProtocolHealth | undefined;
  icon: React.ReactNode;
}

function ProtocolCard({ name, port, enabled, health, icon }: ProtocolCardProps) {
  const isReachable = health?.reachable ?? false;
  const latency = health?.latency;

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        backgroundColor: '#0b1121',
        border: '1px solid #1a2940',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          {icon}
          <Text fw={600} size="sm">
            {name}
          </Text>
        </Group>
        <Badge
          color={enabled ? (isReachable ? 'teal' : 'red') : 'gray'}
          variant="light"
          size="sm"
        >
          {enabled ? (isReachable ? 'Online' : 'Offline') : 'Disabled'}
        </Badge>
      </Group>
      <Group gap="lg">
        <Box>
          <Text size="xs" c="dimmed">
            Port
          </Text>
          <Text size="sm" ff="monospace">
            {port}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">
            Latency
          </Text>
          <Text size="sm" ff="monospace">
            {latency !== null && latency !== undefined ? `${latency}ms` : '--'}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">
            Status
          </Text>
          <Group gap={4}>
            <IconCircleFilled
              size={8}
              color={enabled ? (isReachable ? '#00e8c6' : '#ff6b6b') : '#556880'}
            />
            <Text size="sm">
              {enabled ? (isReachable ? 'Healthy' : 'Down') : 'Off'}
            </Text>
          </Group>
        </Box>
      </Group>
    </Paper>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<ProtocolHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, healthData] = await Promise.all([
        getDashboardStats(),
        getHealth(),
      ]);
      setStats(statsData);
      setHealth(healthData);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load dashboard data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartXray();
      notifications.show({
        title: 'Xray',
        message: 'Xray restart initiated',
        color: 'teal',
      });
      setTimeout(() => {
        fetchData();
      }, 2000);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to restart Xray',
        color: 'red',
      });
    } finally {
      setRestarting(false);
    }
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

  const findHealth = (name: string) =>
    health.find((h) => h.name.includes(name));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} style={{ color: '#d0d7e3' }}>
          Dashboard
        </Title>
        <Group gap="sm">
          <Badge
            color={stats?.xray.running ? 'teal' : 'red'}
            variant="light"
            size="lg"
          >
            Xray {stats?.xray.running ? 'Running' : 'Stopped'}
            {stats?.xray.version ? ` v${stats.xray.version}` : ''}
          </Badge>
          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            loading={restarting}
            onClick={handleRestart}
          >
            Restart
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard
          title="Total Users"
          value={String(stats?.users.total ?? 0)}
          icon={<IconUsers size={28} />}
          color="#00e8c6"
        />
        <StatCard
          title="Active Users"
          value={String(stats?.users.active ?? 0)}
          icon={<IconUserCheck size={28} />}
          color="#51cf66"
        />
        <StatCard
          title="Total Traffic"
          value={formatBytes(stats?.traffic.total ?? '0')}
          icon={<IconArrowsUpDown size={28} />}
          color="#339af0"
        />
        <StatCard
          title="Expiring Soon"
          value={String(stats?.users.expiring ?? 0)}
          icon={<IconClock size={28} />}
          color="#fcc419"
        />
      </SimpleGrid>

      <Title order={4} style={{ color: '#d0d7e3' }} mt="sm">
        Protocol Health
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <ProtocolCard
          name="VLESS+Reality"
          port={stats?.protocols.reality.port ?? 443}
          enabled={stats?.protocols.reality.enabled ?? false}
          health={findHealth('Reality')}
          icon={<IconShieldCheck size={20} color="#00e8c6" />}
        />
        <ProtocolCard
          name="VLESS+WebSocket"
          port={stats?.protocols.websocket.port ?? 2053}
          enabled={stats?.protocols.websocket.enabled ?? false}
          health={findHealth('WebSocket')}
          icon={<IconWorld size={20} color="#339af0" />}
        />
        <ProtocolCard
          name="Shadowsocks"
          port={stats?.protocols.shadowsocks.port ?? 8388}
          enabled={stats?.protocols.shadowsocks.enabled ?? false}
          health={findHealth('Shadowsocks')}
          icon={<IconLock size={20} color="#be4bdb" />}
        />
      </SimpleGrid>

      {stats?.recentAlerts && stats.recentAlerts.length > 0 && (
        <>
          <Title order={4} style={{ color: '#d0d7e3' }} mt="sm">
            Recent Censorship Alerts
          </Title>
          <Stack gap="xs">
            {stats.recentAlerts.slice(0, 5).map((alert) => (
              <Paper
                key={alert.id}
                p="sm"
                radius="md"
                style={{
                  backgroundColor: '#0b1121',
                  border: '1px solid #1a2940',
                }}
              >
                <Group gap="sm">
                  <IconAlertTriangle size={16} color="#fcc419" />
                  <Text size="sm">
                    <Text span fw={600}>
                      {alert.isp}
                    </Text>{' '}
                    ({alert.country}) -- {alert.protocol}:{' '}
                    <Text span c="red">
                      {alert.oldStatus}
                    </Text>{' '}
                    {'->'}{' '}
                    <Text span c={alert.newStatus === 'blocked' ? 'red' : 'yellow'}>
                      {alert.newStatus}
                    </Text>
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
