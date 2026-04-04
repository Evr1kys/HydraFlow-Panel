import { useEffect, useState } from 'react';
import { Badge, Button, Card, Grid, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconActivity, IconArrowsUpDown, IconClock, IconRefresh, IconUsers } from '@tabler/icons-react';
import { getStats, DashboardStats } from '../api/dashboard';
import { restartXray } from '../api/xray';

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const glass = { backgroundColor: 'rgba(11, 17, 33, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(85, 104, 128, 0.2)' };

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  const fetchStats = async () => {
    try { setStats(await getStats()); } catch { notifications.show({ title: 'Error', message: 'Failed to load stats', color: 'red' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); const i = setInterval(fetchStats, 15000); return () => clearInterval(i); }, []);

  const handleRestart = async () => {
    setRestarting(true);
    try { await restartXray(); notifications.show({ title: 'Success', message: 'Xray restarted', color: 'teal' }); await fetchStats(); }
    catch { notifications.show({ title: 'Error', message: 'Failed to restart Xray', color: 'red' }); }
    finally { setRestarting(false); }
  };

  if (loading) return <Stack align="center" justify="center" h="60vh"><Loader color="teal" size="lg" /></Stack>;

  const cards = [
    { title: 'Total Users', value: stats?.totalUsers?.toString() || '0', icon: IconUsers, color: 'teal' },
    { title: 'Active Users', value: stats?.activeUsers?.toString() || '0', icon: IconActivity, color: 'cyan' },
    { title: 'Total Traffic', value: formatBytes(String(Number(stats?.totalTrafficUp || '0') + Number(stats?.totalTrafficDown || '0'))), icon: IconArrowsUpDown, color: 'violet' },
    { title: 'Uptime', value: formatUptime(stats?.xray?.uptime || null), icon: IconClock, color: 'orange' },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} c="white">Dashboard</Title>
        <Group gap="sm">
          <Badge size="lg" variant="dot" color={stats?.xray?.running ? 'teal' : 'red'}>Xray {stats?.xray?.running ? 'Running' : 'Stopped'}</Badge>
          <Button variant="light" color="teal" size="sm" leftSection={<IconRefresh size={16} stroke={1.5} />} loading={restarting} onClick={handleRestart}>Restart</Button>
        </Group>
      </Group>
      <Grid>
        {cards.map((c) => (
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={c.title}>
            <Card radius="md" p="lg" style={glass}>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>{c.title}</Text>
                <c.icon size={22} stroke={1.5} color={`var(--mantine-color-${c.color}-5)`} />
              </Group>
              <Text size="xl" fw={700} c="white">{c.value}</Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
      <Card radius="md" p="lg" style={glass}>
        <Text size="sm" c="dimmed" tt="uppercase" fw={600} mb="md">System Information</Text>
        <Grid>
          <Grid.Col span={4}><Text size="sm" c="dimmed">Xray Version</Text><Text size="sm" c="white" ff="monospace">{stats?.xray?.version || 'Not installed'}</Text></Grid.Col>
          <Grid.Col span={4}><Text size="sm" c="dimmed">Traffic Up</Text><Text size="sm" c="white" ff="monospace">{formatBytes(stats?.totalTrafficUp || '0')}</Text></Grid.Col>
          <Grid.Col span={4}><Text size="sm" c="dimmed">Traffic Down</Text><Text size="sm" c="white" ff="monospace">{formatBytes(stats?.totalTrafficDown || '0')}</Text></Grid.Col>
        </Grid>
      </Card>
    </Stack>
  );
}
