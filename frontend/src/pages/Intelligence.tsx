import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Title,
  Paper,
  Text,
  Group,
  SegmentedControl,
  Table,
  Badge,
  Button,
  Modal,
  Select,
  TextInput,
  Box,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRadar,
  IconAlertTriangle,
  IconPlus,
} from '@tabler/icons-react';
import {
  getIntelligence,
  getAlerts,
  submitReport,
} from '../api/intelligence';
import type { IntelligenceEntry, Alert } from '../types';

const COUNTRIES = ['Russia', 'China', 'Iran'];
const PROTOCOLS = ['VLESS+Reality', 'VLESS+WebSocket', 'Shadowsocks'];
const STATUSES = ['working', 'slow', 'blocked'];

function statusColor(status: string): string {
  switch (status) {
    case 'working':
      return '#00e8c6';
    case 'slow':
      return '#fcc419';
    case 'blocked':
      return '#ff6b6b';
    default:
      return '#556880';
  }
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case 'working':
      return 'teal';
    case 'slow':
      return 'yellow';
    case 'blocked':
      return 'red';
    default:
      return 'gray';
  }
}

export function IntelligencePage() {
  const [country, setCountry] = useState('Russia');
  const [data, setData] = useState<IntelligenceEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportISP, setReportISP] = useState('');
  const [reportProtocol, setReportProtocol] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [intel, alertsData] = await Promise.all([
        getIntelligence(country),
        getAlerts(),
      ]);
      setData(intel);
      setAlerts(alertsData);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load intelligence data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleSubmitReport = async () => {
    if (!reportISP || !reportProtocol || !reportStatus) return;
    setSubmitting(true);
    try {
      await submitReport({
        country,
        isp: reportISP,
        protocol: reportProtocol,
        status: reportStatus,
      });
      setReportOpen(false);
      setReportISP('');
      setReportProtocol(null);
      setReportStatus(null);
      notifications.show({
        title: 'Submitted',
        message: 'ISP report submitted',
        color: 'teal',
      });
      await fetchData();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to submit report',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
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

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <IconRadar size={28} color="#00e8c6" />
          <Title order={2} style={{ color: '#d0d7e3' }}>
            ISP Intelligence
          </Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          onClick={() => setReportOpen(true)}
        >
          Report
        </Button>
      </Group>

      <SegmentedControl
        value={country}
        onChange={setCountry}
        data={COUNTRIES}
        color="teal"
        styles={{
          root: { backgroundColor: '#0b1121' },
          label: { color: '#97a8c2' },
        }}
      />

      <Paper
        radius="md"
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
          overflow: 'auto',
        }}
      >
        <Table horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr style={{ borderBottom: '1px solid #1a2940' }}>
              <Table.Th style={{ color: '#97a8c2' }}>ISP</Table.Th>
              {PROTOCOLS.map((p) => (
                <Table.Th key={p} style={{ color: '#97a8c2', textAlign: 'center' }}>
                  {p}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((entry) => (
              <Table.Tr
                key={`${entry.country}-${entry.isp}`}
                style={{ borderBottom: '1px solid #111b30' }}
              >
                <Table.Td>
                  <Text fw={500} size="sm" style={{ color: '#d0d7e3' }}>
                    {entry.isp}
                  </Text>
                </Table.Td>
                {PROTOCOLS.map((protocol) => {
                  const status = entry.protocols[protocol] ?? 'unknown';
                  return (
                    <Table.Td key={protocol} style={{ textAlign: 'center' }}>
                      <Badge
                        color={statusBadgeColor(status)}
                        variant="light"
                        size="sm"
                        styles={{
                          root: {
                            borderColor: statusColor(status),
                            borderWidth: 1,
                            borderStyle: 'solid',
                          },
                        }}
                      >
                        {status}
                      </Badge>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
            {data.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="xl">
                    No intelligence data for {country}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {alerts.length > 0 && (
        <>
          <Title order={4} style={{ color: '#d0d7e3' }} mt="sm">
            Recent Alerts
          </Title>
          <Stack gap="xs">
            {alerts.slice(0, 10).map((alert) => (
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
                  <Text size="sm" style={{ color: '#d0d7e3' }}>
                    <Text span fw={600}>
                      {alert.isp}
                    </Text>{' '}
                    ({alert.country}) -- {alert.protocol}:{' '}
                    <Badge
                      color={statusBadgeColor(alert.oldStatus)}
                      variant="light"
                      size="xs"
                    >
                      {alert.oldStatus}
                    </Badge>{' '}
                    {'->'}{' '}
                    <Badge
                      color={statusBadgeColor(alert.newStatus)}
                      variant="light"
                      size="xs"
                    >
                      {alert.newStatus}
                    </Badge>
                  </Text>
                  <Text size="xs" c="dimmed" ml="auto">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      <Modal
        opened={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Submit ISP Report"
        styles={{
          content: { backgroundColor: '#0b1121', borderColor: '#1a2940' },
          header: { backgroundColor: '#0b1121' },
          title: { color: '#d0d7e3' },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="ISP Name"
            placeholder="Rostelecom"
            value={reportISP}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setReportISP(e.currentTarget.value)
            }
            styles={{
              input: {
                backgroundColor: '#060a12',
                borderColor: '#1a2940',
                color: '#d0d7e3',
              },
              label: { color: '#97a8c2' },
            }}
          />
          <Select
            label="Protocol"
            placeholder="Select protocol"
            data={PROTOCOLS}
            value={reportProtocol}
            onChange={setReportProtocol}
            styles={{
              input: {
                backgroundColor: '#060a12',
                borderColor: '#1a2940',
                color: '#d0d7e3',
              },
              label: { color: '#97a8c2' },
              dropdown: { backgroundColor: '#111b30', borderColor: '#1a2940' },
            }}
          />
          <Select
            label="Status"
            placeholder="Select status"
            data={STATUSES}
            value={reportStatus}
            onChange={setReportStatus}
            styles={{
              input: {
                backgroundColor: '#060a12',
                borderColor: '#1a2940',
                color: '#d0d7e3',
              },
              label: { color: '#97a8c2' },
              dropdown: { backgroundColor: '#111b30', borderColor: '#1a2940' },
            }}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={submitting}
            onClick={handleSubmitReport}
          >
            Submit Report
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
