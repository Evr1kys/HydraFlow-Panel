import { useEffect, useState } from 'react';
import {
  SimpleGrid,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Box,
  Loader,
  Timeline,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUsers,
  IconUserCheck,
  IconArrowsUpDown,
  IconClock,
  IconAlertTriangle,
  IconRefresh,
  IconCircleFilled,
  IconCalendar,
  IconCalendarWeek,
  IconCalendarMonth,
  IconCpu,
  IconServer,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { getDashboardStats } from '../api/dashboard';
import { getHealth } from '../api/health';
import { restartXray } from '../api/xray';
import type { DashboardStats, ProtocolHealth } from '../types';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  transition: 'all 0.2s ease',
};

const cardHoverHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    el.style.transform = 'translateY(-2px)';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    el.style.transform = 'translateY(0)';
  },
};

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return '\u2014';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

function formatUptime(uptimeStr: string | null | undefined): string {
  if (!uptimeStr) return '\u2014';
  const seconds = Number(uptimeStr);
  if (isNaN(seconds)) return uptimeStr;
  if (seconds === 0) return '\u2014';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Group gap={0} mt="lg" mb={8}>
      <Box
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          backgroundColor: '#20C997',
          marginRight: 8,
          flexShrink: 0,
        }}
      />
      <Text
        size="11px"
        fw={700}
        style={{
          color: '#5c5f66',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </Group>
  );
}

function CircleIcon({
  icon: Icon,
  color,
  size = 48,
  iconSize = 24,
}: {
  icon: typeof IconUsers;
  color: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} color={color} stroke={1.5} />
    </Box>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: typeof IconUsers;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
      <Group gap="md" wrap="nowrap">
        <CircleIcon icon={icon} color={color} />
        <Box>
          <Text
            size="11px"
            fw={600}
            style={{
              color: '#5c5f66',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
          <Text
            size="28px"
            fw={700}
            mt={2}
            ff="monospace"
            style={{ color: '#C1C2C5', lineHeight: 1.2 }}
          >
            {value}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

// Generate sparkline data - 7 points, flat line if no data
function generateSparklineData(value: number): { v: number }[] {
  if (value === 0) {
    return Array.from({ length: 7 }, () => ({ v: 0.5 }));
  }
  // Simulate some variance around the value for visual interest
  const base = value;
  return Array.from({ length: 7 }, (_, i) => ({
    v: base * (0.6 + 0.4 * Math.sin(i * 0.9 + 1) * 0.5 + 0.5),
  }));
}

interface BandwidthCardProps {
  title: string;
  value: string;
  comparison: string;
  positive: boolean;
  icon: typeof IconCalendar;
  color: string;
  rawBytes: number;
}

function BandwidthCard({ title, value, comparison, positive, icon, color, rawBytes }: BandwidthCardProps) {
  const sparkData = generateSparklineData(rawBytes);

  return (
    <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ flex: 1 }}>
          <Text
            size="11px"
            fw={600}
            style={{
              color: '#5c5f66',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
          <Text
            size="24px"
            fw={700}
            mt={4}
            ff="monospace"
            style={{ color: '#C1C2C5', lineHeight: 1.2 }}
          >
            {value}
          </Text>
          <Group gap={4} mt={6}>
            {positive ? (
              <IconArrowUpRight size={14} color="#51cf66" stroke={2} />
            ) : (
              <IconArrowDownRight size={14} color="#ff6b6b" stroke={2} />
            )}
            <Text
              size="12px"
              fw={500}
              style={{ color: positive ? '#51cf66' : '#ff6b6b' }}
            >
              {comparison}
            </Text>
          </Group>
          {/* Sparkline chart */}
          <Box mt={8} style={{ width: '100%', height: 50 }}>
            <ResponsiveContainer width="100%" height={50}>
              <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${title})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>
        <CircleIcon icon={icon} color={color} />
      </Group>
    </Paper>
  );
}

interface ProtocolCardProps {
  name: string;
  port: number;
  enabled: boolean;
  health: ProtocolHealth | undefined;
  color: string;
}

function ProtocolCard({ name, port, enabled, health, color }: ProtocolCardProps) {
  const isReachable = health?.reachable ?? false;
  const latency = health?.latency;

  // Updated colors per spec
  let statusColor: string;
  let statusLabel: string;
  if (!enabled) {
    statusColor = '#6b7280';
    statusLabel = 'Disabled';
  } else if (isReachable) {
    statusColor = '#10b981';
    statusLabel = 'Online';
  } else {
    statusColor = 'rgba(248, 113, 113, 0.85)';
    statusLabel = 'Offline';
  }

  return (
    <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="sm" style={{ color: '#C1C2C5' }}>
          {name}
        </Text>
        <Group gap={6}>
          <IconCircleFilled size={10} color={statusColor} />
          <Text size="xs" style={{ color: statusColor }}>
            {statusLabel}
          </Text>
        </Group>
      </Group>
      <Group gap="xl">
        <Box>
          <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Port
          </Text>
          <Text size="sm" ff="monospace" fw={500} mt={2} style={{ color: '#C1C2C5' }}>
            {port}
          </Text>
        </Box>
        <Box>
          <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Latency
          </Text>
          <Text size="sm" ff="monospace" fw={500} mt={2} style={{ color: latency !== null && latency !== undefined ? color : '#5c5f66' }}>
            {latency !== null && latency !== undefined ? `${latency}ms` : '\u2014'}
          </Text>
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

  const totalTraffic = formatBytes(stats?.traffic.total ?? '0');
  const totalUp = formatBytes(stats?.traffic.totalUp ?? '0');
  const totalDown = formatBytes(stats?.traffic.totalDown ?? '0');

  const xrayRunning = stats?.xray.running ?? false;

  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
          Dashboard
        </Text>
        <Group gap="sm">
          {/* Xray status badge with pulsing dot */}
          <Badge
            size="lg"
            variant="light"
            color={xrayRunning ? 'teal' : 'red'}
            leftSection={
              <Box
                className="pulse-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: xrayRunning ? '#10b981' : '#ef4444',
                }}
              />
            }
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Xray {xrayRunning ? 'Running' : 'Stopped'}
            {stats?.xray.version ? ` v${stats.xray.version}` : ''}
          </Badge>
          <Button
            variant="light"
            color="teal"
            size="xs"
            radius="md"
            leftSection={<IconRefresh size={14} />}
            loading={restarting}
            onClick={handleRestart}
            styles={{
              root: {
                border: '1px solid rgba(32,201,151,0.2)',
                transition: 'all 0.2s ease',
              },
            }}
          >
            Restart
          </Button>
        </Group>
      </Group>

      <SectionTitle>HydraFlow Usage</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard
          title="Total Users"
          value={String(stats?.users.total ?? 0)}
          icon={IconUsers}
          color="#20C997"
        />
        <StatCard
          title="Active Users"
          value={String(stats?.users.active ?? 0)}
          icon={IconUserCheck}
          color="#51cf66"
        />
        <StatCard
          title="Total Traffic"
          value={totalTraffic}
          icon={IconArrowsUpDown}
          color="#339AF0"
        />
        <StatCard
          title="Server Uptime"
          value={formatUptime(stats?.xray.uptime)}
          icon={IconClock}
          color="#845EF7"
        />
      </SimpleGrid>

      <SectionTitle>Bandwidth</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <BandwidthCard
          title="Upload"
          value={totalUp}
          comparison="Total uploaded"
          positive={true}
          icon={IconCalendar}
          color="#20C997"
          rawBytes={Number(stats?.traffic.totalUp ?? '0')}
        />
        <BandwidthCard
          title="Download"
          value={totalDown}
          comparison="Total downloaded"
          positive={true}
          icon={IconCalendarWeek}
          color="#339AF0"
          rawBytes={Number(stats?.traffic.totalDown ?? '0')}
        />
        <BandwidthCard
          title="Combined"
          value={totalTraffic}
          comparison={`${stats?.users.active ?? 0} active users`}
          positive={(stats?.users.active ?? 0) > 0}
          icon={IconCalendarMonth}
          color="#845EF7"
          rawBytes={Number(stats?.traffic.total ?? '0')}
        />
      </SimpleGrid>

      <SectionTitle>Protocol Status</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <ProtocolCard
          name="VLESS+Reality"
          port={stats?.protocols.reality.port ?? 443}
          enabled={stats?.protocols.reality.enabled ?? false}
          health={findHealth('Reality')}
          color="#20C997"
        />
        <ProtocolCard
          name="VLESS+WebSocket"
          port={stats?.protocols.websocket.port ?? 2053}
          enabled={stats?.protocols.websocket.enabled ?? false}
          health={findHealth('WebSocket')}
          color="#339AF0"
        />
        <ProtocolCard
          name="Shadowsocks"
          port={stats?.protocols.shadowsocks.port ?? 8388}
          enabled={stats?.protocols.shadowsocks.enabled ?? false}
          health={findHealth('Shadowsocks')}
          color="#845EF7"
        />
      </SimpleGrid>

      <SectionTitle>System</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
          <Group gap="md" wrap="nowrap">
            <CircleIcon icon={IconServer} color="#20C997" />
            <Box>
              <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Xray Version
              </Text>
              <Text size="lg" fw={700} ff="monospace" mt={2} style={{ color: '#C1C2C5' }}>
                {stats?.xray.version ? `v${stats.xray.version}` : '\u2014'}
              </Text>
            </Box>
          </Group>
        </Paper>
        <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
          <Group gap="md" wrap="nowrap">
            <CircleIcon icon={IconCpu} color="#339AF0" />
            <Box>
              <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Xray Status
              </Text>
              <Group gap={6} mt={2}>
                <Box
                  className="pulse-dot"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: xrayRunning ? '#10b981' : '#ef4444',
                  }}
                />
                <Text size="lg" fw={700} style={{ color: '#C1C2C5' }}>
                  {xrayRunning ? 'Running' : 'Stopped'}
                </Text>
              </Group>
            </Box>
          </Group>
        </Paper>
        <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
          <Group gap="md" wrap="nowrap">
            <CircleIcon icon={IconClock} color="#845EF7" />
            <Box>
              <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Expiring Soon
              </Text>
              <Text size="lg" fw={700} ff="monospace" mt={2} style={{ color: (stats?.users.expiring ?? 0) > 0 ? '#FCC419' : '#C1C2C5' }}>
                {stats?.users.expiring ?? 0} users
              </Text>
            </Box>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Recent Alerts section - always shown */}
      <SectionTitle>Recent Alerts</SectionTitle>
      <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
        {stats?.recentAlerts && stats.recentAlerts.length > 0 ? (
          <Timeline
            active={stats.recentAlerts.length - 1}
            bulletSize={24}
            lineWidth={2}
            color="yellow"
            styles={{
              itemTitle: { color: '#C1C2C5' },
              itemBody: { paddingLeft: 4 },
            }}
          >
            {stats.recentAlerts.slice(0, 5).map((alert) => {
              const isBlocked = alert.newStatus === 'blocked';
              const isRecovered = alert.newStatus === 'working';
              const bulletColor = isBlocked ? '#ef4444' : isRecovered ? '#10b981' : '#FCC419';

              return (
                <Timeline.Item
                  key={alert.id}
                  bullet={<IconAlertTriangle size={12} />}
                  color={isBlocked ? 'red' : isRecovered ? 'green' : 'yellow'}
                  title={
                    <Group gap={8}>
                      <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                        {alert.protocol} {isBlocked ? 'went offline' : isRecovered ? 'recovered' : 'status changed'}
                      </Text>
                      <Badge size="xs" variant="light" color="gray">
                        {alert.isp} - {alert.country}
                      </Badge>
                    </Group>
                  }
                >
                  <Text size="xs" mt={4} style={{ color: '#909296' }}>
                    <Text span style={{ color: alert.oldStatus === 'working' ? '#10b981' : 'rgba(248,113,113,0.85)' }}>
                      {alert.oldStatus}
                    </Text>
                    {' -> '}
                    <Text span style={{ color: bulletColor }}>
                      {alert.newStatus}
                    </Text>
                  </Text>
                  <Text size="xs" mt={2} style={{ color: '#5c5f66' }}>
                    {new Date(alert.createdAt).toLocaleString()}
                  </Text>
                </Timeline.Item>
              );
            })}
          </Timeline>
        ) : (
          <Text size="sm" style={{ color: '#5c5f66' }}>
            No recent alerts
          </Text>
        )}
      </Paper>
    </Stack>
  );
}
