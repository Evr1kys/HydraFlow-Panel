import { Paper, Text, Group, Box, SimpleGrid, Badge } from '@mantine/core';
import {
  IconUsers,
  IconServer,
  IconGlobe,
  IconWifi,
  IconArrowsUpDown,
  IconClock,
  IconVersions,
  IconBolt,
} from '@tabler/icons-react';
import type { DashboardRecap } from '../types';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface RecapStatProps {
  icon: typeof IconUsers;
  label: string;
  value: string;
  hint?: string;
  color: string;
}

function RecapStat({ icon: Icon, label, value, hint, color }: RecapStatProps) {
  return (
    <Group gap="md" wrap="nowrap" align="flex-start">
      <Box
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} stroke={1.8} />
      </Box>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Text
          size="10px"
          fw={600}
          style={{
            color: '#5c5f66',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <Text
          size="20px"
          fw={700}
          ff="monospace"
          mt={2}
          style={{
            color: '#C1C2C5',
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Text>
        {hint && (
          <Text size="11px" mt={2} style={{ color: '#5c5f66' }}>
            {hint}
          </Text>
        )}
      </Box>
    </Group>
  );
}

interface RecapCardProps {
  recap: DashboardRecap | null;
}

export function RecapCard({ recap }: RecapCardProps) {
  if (!recap) {
    return null;
  }

  const startedLabel = (() => {
    try {
      return new Date(recap.startedAt).toLocaleString();
    } catch {
      return '-';
    }
  })();

  return (
    <Paper p="lg" style={cardStyle}>
      <Group justify="space-between" align="center" mb="md">
        <Group gap={10}>
          <Box
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              backgroundColor: '#20C997',
            }}
          />
          <Text
            size="12px"
            fw={700}
            style={{
              color: '#C1C2C5',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
            }}
          >
            System Recap
          </Text>
        </Group>
        <Badge
          size="sm"
          variant="light"
          color="teal"
          style={{
            backgroundColor: 'rgba(32,201,151,0.08)',
            border: '1px solid rgba(32,201,151,0.2)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          v{recap.version}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
        <RecapStat
          icon={IconUsers}
          label="Users"
          value={String(recap.users.total)}
          hint={`${recap.users.active} active, ${recap.users.expired} expired`}
          color="#20C997"
        />
        <RecapStat
          icon={IconArrowsUpDown}
          label="Total Traffic"
          value={formatBytes(recap.traffic.total)}
          hint={`${formatBytes(recap.traffic.totalUp)} up / ${formatBytes(recap.traffic.totalDown)} down`}
          color="#339AF0"
        />
        <RecapStat
          icon={IconServer}
          label="Nodes"
          value={String(recap.nodes.total)}
          hint={`${recap.nodes.enabled} enabled, ${recap.nodes.healthy} healthy`}
          color="#845EF7"
        />
        <RecapStat
          icon={IconGlobe}
          label="Countries"
          value={String(recap.countries)}
          hint="distinct in reports"
          color="#FCC419"
        />
        <RecapStat
          icon={IconWifi}
          label="Active Sessions"
          value={String(recap.activeSessions)}
          hint="current connections"
          color="#FF6B6B"
        />
        <RecapStat
          icon={IconBolt}
          label="Disabled Users"
          value={String(recap.users.disabled)}
          color="#868E96"
        />
        <RecapStat
          icon={IconClock}
          label="Uptime"
          value={formatUptime(recap.uptimeSeconds)}
          hint={`since ${startedLabel}`}
          color="#22B8CF"
        />
        <RecapStat
          icon={IconVersions}
          label="Panel Version"
          value={`v${recap.version}`}
          color="#51cf66"
        />
      </SimpleGrid>
    </Paper>
  );
}
