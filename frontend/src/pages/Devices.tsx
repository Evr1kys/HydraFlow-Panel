import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Group,
  Text,
  TextInput,
  ActionIcon,
  Box,
  Loader,
  Paper,
  Badge,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDevices,
  IconTrash,
  IconSearch,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconBrandApple,
  IconBrandAndroid,
  IconBrandWindows,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { getDevices, removeDevice } from '../api/devices';
import type { Device } from '../types';

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

function PlatformIcon({ platform }: { platform: string }) {
  const lower = platform.toLowerCase();
  if (lower.includes('ios') || lower.includes('macos') || lower.includes('mac')) {
    return <IconBrandApple size={16} color="#909296" stroke={1.5} />;
  }
  if (lower.includes('android')) {
    return <IconBrandAndroid size={16} color="#51cf66" stroke={1.5} />;
  }
  if (lower.includes('windows')) {
    return <IconBrandWindows size={16} color="#339AF0" stroke={1.5} />;
  }
  if (lower.includes('tablet') || lower.includes('ipad')) {
    return <IconDeviceTablet size={16} color="#845EF7" stroke={1.5} />;
  }
  if (lower.includes('mobile') || lower.includes('phone')) {
    return <IconDeviceMobile size={16} color="#FCC419" stroke={1.5} />;
  }
  return <IconDeviceDesktop size={16} color="#909296" stroke={1.5} />;
}

export function DevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      const data = await getDevices();
      setDevices(data);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.deviceRemoveError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRemove = async (id: string) => {
    try {
      await removeDevice(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.deviceRemoved'),
        color: 'teal',
      });
      await fetchDevices();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.deviceRemoveError'),
        color: 'red',
      });
    }
  };

  const filteredDevices = devices.filter(
    (d) => d.userEmail.toLowerCase().includes(filter.toLowerCase()),
  );

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
            <IconDevices size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('devices.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {devices.length}
          </Badge>
        </Group>
      </Group>

      <TextInput
        placeholder={t('devices.filterByUser')}
        leftSection={<IconSearch size={16} color="#5c5f66" />}
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        radius="md"
        styles={{
          input: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#C1C2C5',
            height: 42,
          },
        }}
      />

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
                <Table.Th style={thStyle}>{t('devices.userEmail')}</Table.Th>
                <Table.Th style={thStyle}>{t('devices.hwid')}</Table.Th>
                <Table.Th style={thStyle}>{t('devices.platform')}</Table.Th>
                <Table.Th style={thStyle}>{t('devices.lastSeen')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 80 }}>{t('devices.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredDevices.map((device, idx) => (
                <Table.Tr
                  key={device.id}
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
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                      {device.userEmail}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" fw={500} style={{ color: '#909296' }}>
                      {device.hwid.length > 20
                        ? `${device.hwid.substring(0, 20)}...`
                        : device.hwid}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <PlatformIcon platform={device.platform} />
                      <Text size="sm" style={{ color: '#C1C2C5' }}>
                        {device.platform}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {new Date(device.lastSeen).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      radius="md"
                      onClick={() => handleRemove(device.id)}
                      style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                      title={t('devices.remove')}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {filteredDevices.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Box
                      py={48}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <IconDevices size={40} color="#373A40" stroke={1} />
                      <Text ta="center" size="sm" style={{ color: '#5c5f66' }}>
                        {t('devices.noDevices')}
                      </Text>
                    </Box>
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
