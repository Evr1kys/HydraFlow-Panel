import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  SegmentedControl,
  Table,
  Box,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { notifications } from '@mantine/notifications';
import {
  IconChartBar,
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
import { getTrafficHistory } from '../api/traffic';
import type { TrafficHistoryData, TrafficHistoryPoint } from '../types';

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

function generateMockHistory(days: number): TrafficHistoryPoint[] {
  const points: TrafficHistoryPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    points.push({
      date: date.toISOString().slice(0, 10),
      upload: Math.floor(Math.random() * 5e9 + 1e9),
      download: Math.floor(Math.random() * 15e9 + 3e9),
    });
  }
  return points;
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
          {entry.name}: {formatBytes(entry.value)}
        </Text>
      ))}
    </Box>
  );
}

export function TrafficHistoryPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<TrafficHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTrafficHistory(period);
      setData(result);
    } catch {
      // Fallback to generated data for demo
      const days = period === '24h' ? 24 : period === '7d' ? 7 : 30;
      setData({
        history: generateMockHistory(days),
        perUser: [],
      });
      notifications.show({
        title: t('common.error'),
        message: t('notification.trafficError'),
        color: 'yellow',
      });
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <LoadingSkeleton variant="dashboard" />;
  }

  const history = data?.history ?? [];
  const perUser = data?.perUser ?? [];

  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
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
            <IconChartBar size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('trafficHistory.title')}
          </Text>
        </Group>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          data={[
            { label: t('trafficHistory.period.24h'), value: '24h' },
            { label: t('trafficHistory.period.7d'), value: '7d' },
            { label: t('trafficHistory.period.30d'), value: '30d' },
          ]}
          color="teal"
          radius="md"
          styles={{
            root: {
              backgroundColor: '#1E2128',
              border: '1px solid rgba(255,255,255,0.06)',
            },
            label: { color: '#909296', fontSize: '13px', fontWeight: 500 },
          }}
        />
      </Group>

      <SectionTitle>{t('trafficHistory.trafficOverview')}</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Box style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20C997" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#20C997" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22B8CF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22B8CF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                stroke="#5c5f66"
                tick={{ fontSize: 11, fill: '#5c5f66' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                stroke="#5c5f66"
                tick={{ fontSize: 11, fill: '#5c5f66' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                tickFormatter={(value: number) => formatBytes(value)}
                width={70}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="upload"
                name={t('trafficHistory.uploadLabel')}
                stroke="#20C997"
                strokeWidth={2}
                fill="url(#colorUpload)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="download"
                name={t('trafficHistory.downloadLabel')}
                stroke="#22B8CF"
                strokeWidth={2}
                fill="url(#colorDownload)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
        <Group gap="xl" mt="md" justify="center">
          <Group gap={6}>
            <Box style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#20C997' }} />
            <Text size="xs" style={{ color: '#909296' }}>{t('trafficHistory.uploadLabel')}</Text>
          </Group>
          <Group gap={6}>
            <Box style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#22B8CF' }} />
            <Text size="xs" style={{ color: '#909296' }}>{t('trafficHistory.downloadLabel')}</Text>
          </Group>
        </Group>
      </Paper>

      {perUser.length > 0 && (
        <>
          <SectionTitle>{t('trafficHistory.perUserTraffic')}</SectionTitle>
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
                    <Table.Th style={thStyle}>{t('trafficHistory.user')}</Table.Th>
                    <Table.Th style={thStyle}>{t('trafficHistory.upload')}</Table.Th>
                    <Table.Th style={thStyle}>{t('trafficHistory.download')}</Table.Th>
                    <Table.Th style={thStyle}>{t('trafficHistory.total')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {perUser.map((user, idx) => (
                    <Table.Tr
                      key={user.userId}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      }}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                          {user.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace" style={{ color: '#20C997' }}>
                          {formatBytes(user.upload)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace" style={{ color: '#22B8CF' }}>
                          {formatBytes(user.download)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace" fw={500} style={{ color: '#C1C2C5' }}>
                          {formatBytes(user.total)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </>
      )}

      {history.length === 0 && (
        <Paper p="xl" mt="md" style={cardStyle}>
          <EmptyState
            icon={IconChartBar}
            message={t('trafficHistory.noData')}
            minHeight={200}
          />
        </Paper>
      )}
    </Stack>
  );
}

export default TrafficHistoryPage;
