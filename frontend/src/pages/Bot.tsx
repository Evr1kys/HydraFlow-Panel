import { useEffect, useState } from 'react';
import { Box, Grid, Group, Paper, Stack, Text, Loader } from '@mantine/core';
import {
  IconRobot,
  IconUsers,
  IconCurrencyDollar,
  IconReceipt2,
  IconMessage,
} from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import { getBotStats, type BotStats } from '../api/bot';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof IconRobot;
  color: string;
}

function Kpi({ label, value, sub, icon: Icon, color }: KpiProps) {
  return (
    <Paper p="lg" style={cardStyle}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="xs" fw={600} style={{ color: '#5c5f66', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {label}
          </Text>
          <Text size="28px" fw={700} mt={4} style={{ color: '#C1C2C5', fontFamily: "'JetBrains Mono', monospace" }}>
            {value}
          </Text>
          {sub && (
            <Text size="xs" mt={4} style={{ color: '#909296' }}>
              {sub}
            </Text>
          )}
        </Box>
        <Box
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={color} stroke={1.5} />
        </Box>
      </Group>
    </Paper>
  );
}

export function BotPage() {
  const [stats, setStats] = useState<BotStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getBotStats()
      .then((s) => {
        if (mounted) setStats(s);
      })
      .catch(() => {
        if (mounted) setStats(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Shop Bot"
        subtitle="User-facing Telegram shop overview"
        icon={IconRobot}
        iconColor="#845EF7"
      />

      {loading ? (
        <Group justify="center" mt="xl">
          <Loader size="sm" />
        </Group>
      ) : !stats ? (
        <Paper p="lg" style={cardStyle}>
          <Text size="sm" style={{ color: '#909296' }}>
            Stats unavailable
          </Text>
        </Paper>
      ) : (
        <Stack>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Kpi
                label="Total users"
                value={stats.users.total}
                sub={`${stats.users.newWeek} new this week`}
                icon={IconUsers}
                color="#20C997"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Kpi
                label="Revenue (30d)"
                value={stats.revenue.month.toFixed(2)}
                sub={`today: ${stats.revenue.day.toFixed(2)}`}
                icon={IconCurrencyDollar}
                color="#339AF0"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Kpi
                label="Transactions (30d)"
                value={stats.transactions.month}
                sub={`today: ${stats.transactions.day}`}
                icon={IconReceipt2}
                color="#FCC419"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Kpi
                label="Open tickets"
                value={stats.support.openTickets}
                sub={`${stats.users.banned} banned`}
                icon={IconMessage}
                color="#FA5252"
              />
            </Grid.Col>
          </Grid>

          <Paper p="lg" style={cardStyle}>
            <Text size="sm" fw={600} style={{ color: '#C1C2C5' }} mb="md">
              Activity summary
            </Text>
            <Grid>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Revenue today
                </Text>
                <Text size="lg" fw={600} style={{ color: '#20C997' }}>
                  {stats.revenue.day.toFixed(2)}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Revenue week
                </Text>
                <Text size="lg" fw={600} style={{ color: '#339AF0' }}>
                  {stats.revenue.week.toFixed(2)}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Revenue month
                </Text>
                <Text size="lg" fw={600} style={{ color: '#845EF7' }}>
                  {stats.revenue.month.toFixed(2)}
                </Text>
              </Grid.Col>
            </Grid>
          </Paper>
        </Stack>
      )}
    </>
  );
}

export default BotPage;
