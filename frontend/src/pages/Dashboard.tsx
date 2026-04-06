import { useEffect, useState, useRef } from 'react';
import {
  SimpleGrid,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Box,
  Timeline,
  SegmentedControl,
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
  IconWifi,
} from '@tabler/icons-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { getDashboardStats, getDashboardRecap } from '../api/dashboard';
import { getHealth } from '../api/health';
import { restartXray } from '../api/xray';
import { getTrafficHistoryDaily, type TrafficHistoryPointNumeric } from '../api/traffic';
import type { DashboardStats, DashboardRecap, ProtocolHealth } from '../types';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { RecapCard } from '../components/RecapCard';
import { extractErrorMessage } from '../api/client';

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

function formatBytesNum(bytes: number): string {
  if (bytes === 0) return '0 B';
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

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 1200): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = null;
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

interface StatCardProps {
  title: string;
  value: number;
  displayValue?: string;
  icon: typeof IconUsers;
  color: string;
}

function StatCard({ title, value, displayValue, icon, color }: StatCardProps) {
  const animatedValue = useAnimatedCounter(value);
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
            {displayValue ?? String(animatedValue)}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

function generateSparklineData(value: number): { v: number }[] {
  if (value === 0) {
    return Array.from({ length: 7 }, () => ({ v: 0.5 }));
  }
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
                  <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${title.replace(/\s/g, '')})`}
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
  const { t } = useTranslation();
  const isReachable = health?.reachable ?? false;
  const latency = health?.latency;

  let statusColor: string;
  let statusLabel: string;
  if (!enabled) {
    statusColor = '#6b7280';
    statusLabel = t('protocol.disabled');
  } else if (isReachable) {
    statusColor = '#10b981';
    statusLabel = t('protocol.online');
  } else {
    statusColor = 'rgba(248, 113, 113, 0.85)';
    statusLabel = t('protocol.offline');
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
            {t('protocol.port')}
          </Text>
          <Text size="sm" ff="monospace" fw={500} mt={2} style={{ color: '#C1C2C5' }}>
            {port}
          </Text>
        </Box>
        <Box>
          <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {t('protocol.latency')}
          </Text>
          <Text size="sm" ff="monospace" fw={500} mt={2} style={{ color: latency !== null && latency !== undefined ? color : '#5c5f66' }}>
            {latency !== null && latency !== undefined ? `${latency}ms` : '\u2014'}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

// Format a daily traffic history point's date for display on the chart x-axis
function formatTrafficDate(isoDate: string): string {
  // Backend returns YYYY-MM-DD for daily aggregation
  const parts = isoDate.split('-');
  if (parts.length >= 3) {
    return `${parseInt(parts[1]!, 10)}/${parseInt(parts[2]!, 10)}`;
  }
  const d = new Date(isoDate);
  if (!isNaN(d.getTime())) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return isoDate;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload) return null;
  return (
    <Box
      style={{
        backgroundColor: '#1E2128',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
      }}
    >
      <Text size="xs" fw={600} style={{ color: '#C1C2C5' }} mb={4}>
        {label}
      </Text>
      {payload.map((entry) => (
        <Text key={entry.name} size="xs" style={{ color: entry.color }}>
          {entry.name}: {formatBytesNum(entry.value)}
        </Text>
      ))}
    </Box>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recap, setRecap] = useState<DashboardRecap | null>(null);
  const [health, setHealth] = useState<ProtocolHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [trafficPeriod, setTrafficPeriod] = useState('7d');
  const [trafficHistoryData, setTrafficHistoryData] = useState<
    TrafficHistoryPointNumeric[]
  >([]);

  const fetchData = async () => {
    setLoadError(null);
    try {
      const [statsData, healthData, recapData] = await Promise.all([
        getDashboardStats(),
        getHealth(),
        getDashboardRecap().catch(() => null),
      ]);
      setStats(statsData);
      setHealth(healthData);
      setRecap(recapData);
    } catch (err) {
      const message = extractErrorMessage(err);
      setLoadError(message);
      notifications.show({
        title: t('common.error'),
        message: t('notification.dashboardError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const days =
      trafficPeriod === '24h' ? 1 : trafficPeriod === '7d' ? 7 : 30;
    let cancelled = false;
    getTrafficHistoryDaily(days)
      .then((points) => {
        if (!cancelled) {
          setTrafficHistoryData(points);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrafficHistoryData([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trafficPeriod]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartXray();
      notifications.show({
        title: 'Xray',
        message: t('notification.xrayRestart'),
        color: 'teal',
      });
      setTimeout(() => {
        fetchData();
      }, 2000);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.xrayRestartError'),
        color: 'red',
      });
    } finally {
      setRestarting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton variant="dashboard" />;
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

  const findHealth = (name: string) =>
    health.find((h) => h.name.includes(name));

  const totalTraffic = formatBytes(stats?.traffic.total ?? '0');
  const totalUp = formatBytes(stats?.traffic.totalUp ?? '0');
  const totalDown = formatBytes(stats?.traffic.totalDown ?? '0');

  const xrayRunning = stats?.xray.running ?? false;

  const trafficHistory = trafficHistoryData.map((p) => ({
    date: formatTrafficDate(p.date),
    upload: p.upload,
    download: p.download,
  }));

  // Simulated "online users" count
  const onlineUsers = Math.max(0, Math.floor((stats?.users.active ?? 0) * 0.6));

  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
          {t('dashboard.title')}
        </Text>
        <Group gap="sm">
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
            {xrayRunning ? t('dashboard.xrayRunning') : t('dashboard.xrayStopped')}
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
            {t('dashboard.restart')}
          </Button>
        </Group>
      </Group>

      {recap && (
        <Box mb="md">
          <RecapCard recap={recap} />
        </Box>
      )}

      <SectionTitle>{t('dashboard.hydraflowUsage')}</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
        <StatCard
          title={t('dashboard.totalUsers')}
          value={stats?.users.total ?? 0}
          icon={IconUsers}
          color="#20C997"
        />
        <StatCard
          title={t('dashboard.activeUsers')}
          value={stats?.users.active ?? 0}
          icon={IconUserCheck}
          color="#51cf66"
        />
        <StatCard
          title={t('dashboard.totalTraffic')}
          value={Number(stats?.traffic.total ?? '0')}
          displayValue={totalTraffic}
          icon={IconArrowsUpDown}
          color="#339AF0"
        />
        <StatCard
          title={t('dashboard.serverUptime')}
          value={0}
          displayValue={formatUptime(stats?.xray.uptime)}
          icon={IconClock}
          color="#845EF7"
        />
        <StatCard
          title={t('dashboard.onlineUsers')}
          value={onlineUsers}
          icon={IconWifi}
          color="#FCC419"
        />
      </SimpleGrid>

      <SectionTitle>{t('dashboard.bandwidth')}</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <BandwidthCard
          title={t('dashboard.upload')}
          value={totalUp}
          comparison={t('dashboard.vsYesterday')}
          positive={true}
          icon={IconCalendar}
          color="#20C997"
          rawBytes={Number(stats?.traffic.totalUp ?? '0')}
        />
        <BandwidthCard
          title={t('dashboard.download')}
          value={totalDown}
          comparison={t('dashboard.vsYesterday')}
          positive={true}
          icon={IconCalendarWeek}
          color="#339AF0"
          rawBytes={Number(stats?.traffic.totalDown ?? '0')}
        />
        <BandwidthCard
          title={t('dashboard.combined')}
          value={totalTraffic}
          comparison={t('dashboard.activeUsersCount', { count: stats?.users.active ?? 0 })}
          positive={(stats?.users.active ?? 0) > 0}
          icon={IconCalendarMonth}
          color="#845EF7"
          rawBytes={Number(stats?.traffic.total ?? '0')}
        />
      </SimpleGrid>

      {/* Traffic History Chart */}
      <Group justify="space-between" align="center" mt="lg" mb={8}>
        <Group gap={0}>
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
            {t('dashboard.trafficHistory')}
          </Text>
        </Group>
        <SegmentedControl
          value={trafficPeriod}
          onChange={setTrafficPeriod}
          data={[
            { label: t('dashboard.period.24h'), value: '24h' },
            { label: t('dashboard.period.7d'), value: '7d' },
            { label: t('dashboard.period.30d'), value: '30d' },
          ]}
          size="xs"
          color="teal"
          radius="md"
          styles={{
            root: {
              backgroundColor: '#1E2128',
              border: '1px solid rgba(255,255,255,0.06)',
            },
            label: { color: '#909296', fontSize: '11px', fontWeight: 500 },
          }}
        />
      </Group>
      <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
        <Box style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trafficHistory} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dashUpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20C997" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#20C997" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dashDownGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22B8CF" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22B8CF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                stroke="#5c5f66"
                tick={{ fontSize: 10, fill: '#5c5f66' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                stroke="#5c5f66"
                tick={{ fontSize: 10, fill: '#5c5f66' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                tickFormatter={(v: number) => formatBytesNum(v)}
                width={60}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="upload"
                name={t('dashboard.upload')}
                stroke="#20C997"
                strokeWidth={2}
                fill="url(#dashUpGrad)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="download"
                name={t('dashboard.download')}
                stroke="#22B8CF"
                strokeWidth={2}
                fill="url(#dashDownGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
        <Group gap="xl" mt="sm" justify="center">
          <Group gap={6}>
            <Box style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#20C997' }} />
            <Text size="xs" style={{ color: '#909296' }}>{t('dashboard.upload')}</Text>
          </Group>
          <Group gap={6}>
            <Box style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#22B8CF' }} />
            <Text size="xs" style={{ color: '#909296' }}>{t('dashboard.download')}</Text>
          </Group>
        </Group>
      </Paper>

      <SectionTitle>{t('dashboard.protocolStatus')}</SectionTitle>
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

      <SectionTitle>{t('dashboard.system')}</SectionTitle>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="lg" style={cardStyle} {...cardHoverHandlers}>
          <Group gap="md" wrap="nowrap">
            <CircleIcon icon={IconServer} color="#20C997" />
            <Box>
              <Text size="10px" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {t('dashboard.xrayVersion')}
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
                {t('dashboard.xrayStatus')}
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
                  {xrayRunning ? t('dashboard.running') : t('dashboard.stopped')}
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
                {t('dashboard.expiringSoon')}
              </Text>
              <Text size="lg" fw={700} ff="monospace" mt={2} style={{ color: (stats?.users.expiring ?? 0) > 0 ? '#FCC419' : '#C1C2C5' }}>
                {t('dashboard.expiringSoonCount', { count: stats?.users.expiring ?? 0 })}
              </Text>
            </Box>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Recent Events Feed */}
      <SectionTitle>{t('dashboard.recentEvents')}</SectionTitle>
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

              return (
                <Timeline.Item
                  key={alert.id}
                  bullet={<IconAlertTriangle size={12} />}
                  color={isBlocked ? 'red' : isRecovered ? 'green' : 'yellow'}
                  title={
                    <Group gap={8}>
                      <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                        {isBlocked
                          ? t('dashboard.wentOffline', { protocol: alert.protocol })
                          : isRecovered
                            ? t('dashboard.recovered', { protocol: alert.protocol })
                            : t('dashboard.statusChanged', { protocol: alert.protocol })}
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
                    <Text span style={{ color: isBlocked ? 'rgba(248,113,113,0.85)' : isRecovered ? '#10b981' : '#FCC419' }}>
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
            {t('dashboard.noRecentEvents')}
          </Text>
        )}
      </Paper>
    </Stack>
  );
}

export default DashboardPage;
