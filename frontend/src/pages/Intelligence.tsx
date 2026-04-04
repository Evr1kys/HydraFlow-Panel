import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
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
  Timeline,
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

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
};

const inputStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#C1C2C5',
    borderRadius: 8,
  },
  label: {
    color: '#909296',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: 4,
  },
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

function statusColor(status: string): string {
  switch (status) {
    case 'working':
      return '#51cf66';
    case 'slow':
      return '#FCC419';
    case 'blocked':
      return '#ff6b6b';
    default:
      return '#5c5f66';
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

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      size="11px"
      fw={700}
      mt="lg"
      mb={8}
      style={{
        color: '#5c5f66',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
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
    <Stack gap={0}>
      {/* Header */}
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
            <IconRadar size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            ISP Intelligence
          </Text>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          onClick={() => setReportOpen(true)}
        >
          Report
        </Button>
      </Group>

      {/* Country selector */}
      <SegmentedControl
        value={country}
        onChange={setCountry}
        data={COUNTRIES}
        color="teal"
        radius="md"
        mb="md"
        styles={{
          root: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          label: { color: '#909296', fontSize: '13px', fontWeight: 500 },
        }}
      />

      {/* ISP Table */}
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
                <Table.Th style={thStyle}>ISP</Table.Th>
                {PROTOCOLS.map((p) => (
                  <Table.Th key={p} style={{ ...thStyle, textAlign: 'center' }}>
                    {p}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((entry, idx) => (
                <Table.Tr
                  key={`${entry.country}-${entry.isp}`}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text fw={500} size="sm" style={{ color: '#C1C2C5' }}>
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
                          radius="md"
                          styles={{
                            root: {
                              borderColor: `${statusColor(status)}33`,
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
                    <Box py={48} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <IconRadar size={40} color="#373A40" stroke={1} />
                      <Text ta="center" size="sm" style={{ color: '#5c5f66' }}>
                        No intelligence data for {country}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <>
          <SectionTitle>Recent Alerts</SectionTitle>
          <Paper p="lg" style={cardStyle}>
            <Timeline
              active={alerts.length - 1}
              bulletSize={24}
              lineWidth={2}
              color="yellow"
              styles={{
                itemTitle: { color: '#C1C2C5' },
                itemBody: { paddingLeft: 4 },
              }}
            >
              {alerts.slice(0, 10).map((alert) => (
                <Timeline.Item
                  key={alert.id}
                  bullet={<IconAlertTriangle size={12} />}
                  title={
                    <Group gap={8}>
                      <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                        {alert.isp}
                      </Text>
                      <Badge size="xs" variant="light" color="gray">
                        {alert.country}
                      </Badge>
                    </Group>
                  }
                >
                  <Text size="xs" mt={4} style={{ color: '#909296' }}>
                    {alert.protocol}:{' '}
                    <Badge color={statusBadgeColor(alert.oldStatus)} variant="light" size="xs">
                      {alert.oldStatus}
                    </Badge>
                    {' -> '}
                    <Badge color={statusBadgeColor(alert.newStatus)} variant="light" size="xs">
                      {alert.newStatus}
                    </Badge>
                  </Text>
                  <Text size="xs" mt={2} style={{ color: '#5c5f66' }}>
                    {new Date(alert.createdAt).toLocaleString()}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </Paper>
        </>
      )}

      {/* Submit Report Modal */}
      <Modal
        opened={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Submit ISP Report"
        radius="lg"
        styles={{
          content: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          header: {
            backgroundColor: '#1E2128',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <TextInput
            label="ISP Name"
            placeholder="Rostelecom"
            value={reportISP}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setReportISP(e.currentTarget.value)
            }
            styles={inputStyles}
          />
          <Select
            label="Protocol"
            placeholder="Select protocol"
            data={PROTOCOLS}
            value={reportProtocol}
            onChange={setReportProtocol}
            styles={{
              ...inputStyles,
              dropdown: {
                backgroundColor: '#1E2128',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
              },
            }}
          />
          <Select
            label="Status"
            placeholder="Select status"
            data={STATUSES}
            value={reportStatus}
            onChange={setReportStatus}
            styles={{
              ...inputStyles,
              dropdown: {
                backgroundColor: '#1E2128',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
              },
            }}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={submitting}
            onClick={handleSubmitReport}
            radius="md"
            fullWidth
          >
            Submit Report
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
