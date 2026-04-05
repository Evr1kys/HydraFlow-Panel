import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconFilter,
  IconHistory,
} from '@tabler/icons-react';
import {
  exportAuditLogs,
  listAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters,
} from '../api/auditLog';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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

const RESOURCE_OPTIONS = [
  { value: '', label: 'All resources' },
  { value: 'users', label: 'users' },
  { value: 'nodes', label: 'nodes' },
  { value: 'settings', label: 'settings' },
  { value: 'squads', label: 'squads' },
  { value: 'admins', label: 'admins' },
  { value: 'api-keys', label: 'api-keys' },
  { value: 'auth', label: 'auth' },
  { value: 'billing', label: 'billing' },
  { value: 'migrate', label: 'migrate' },
];

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [adminId, setAdminId] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  const buildFilters = useCallback((): AuditLogFilters => {
    return {
      adminId: adminId || undefined,
      resource: resource || undefined,
      action: action || undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      limit: 200,
    };
  }, [adminId, resource, action, from, to]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAuditLogs(buildFilters());
      setItems(data.items);
      setTotal(data.total);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load audit logs',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const blob = await exportAuditLogs(buildFilters());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to export CSV',
        color: 'red',
      });
    }
  };

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
            <IconHistory size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Audit Log
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {total}
          </Badge>
        </Group>
        <Button
          leftSection={<IconDownload size={16} />}
          variant="default"
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </Group>

      <Paper style={cardStyle} p="md">
        <Group gap="sm" align="end">
          <IconFilter size={18} color="#909296" stroke={1.5} />
          <TextInput
            label="Admin ID"
            placeholder="uuid"
            value={adminId}
            onChange={(e) => setAdminId(e.currentTarget.value)}
            styles={inputStyles}
            style={{ flex: 1, minWidth: 160 }}
          />
          <Select
            label="Resource"
            value={resource}
            onChange={(v) => setResource(v ?? '')}
            data={RESOURCE_OPTIONS}
            styles={inputStyles}
            style={{ flex: 1, minWidth: 140 }}
          />
          <TextInput
            label="Action"
            placeholder="user.create"
            value={action}
            onChange={(e) => setAction(e.currentTarget.value)}
            styles={inputStyles}
            style={{ flex: 1, minWidth: 140 }}
          />
          <DateInput
            label="From"
            value={from}
            onChange={setFrom}
            clearable
            styles={inputStyles}
            style={{ minWidth: 140 }}
          />
          <DateInput
            label="To"
            value={to}
            onChange={setTo}
            clearable
            styles={inputStyles}
            style={{ minWidth: 140 }}
          />
          <Button onClick={fetchLogs} variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
            Apply
          </Button>
        </Group>
      </Paper>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        {loading ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader color="teal" />
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Table.Th style={thStyle}>Timestamp</Table.Th>
                  <Table.Th style={thStyle}>Admin</Table.Th>
                  <Table.Th style={thStyle}>Action</Table.Th>
                  <Table.Th style={thStyle}>Resource</Table.Th>
                  <Table.Th style={thStyle}>Resource ID</Table.Th>
                  <Table.Th style={thStyle}>IP</Table.Th>
                  <Table.Th style={thStyle}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((it, idx) => {
                  const expanded = expandedId === it.id;
                  return (
                    <Fragment key={it.id}>
                      <Table.Tr
                        onClick={() => setExpandedId(expanded ? null : it.id)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          backgroundColor:
                            idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <Table.Td>
                          <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                            {new Date(it.createdAt).toLocaleString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" style={{ color: '#C1C2C5' }}>
                            {it.admin?.email ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                            {it.action}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue" size="sm">
                            {it.resource}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                            {it.resourceId ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                            {it.ip ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={it.success ? 'teal' : 'red'}
                            size="sm"
                          >
                            {it.success ? 'success' : 'failed'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                      {expanded && (
                        <Table.Tr>
                          <Table.Td colSpan={7} style={{ backgroundColor: '#161B23' }}>
                            <Collapse in={expanded}>
                              <Box p="sm">
                                {it.errorMsg && (
                                  <Text size="xs" c="red" mb="xs">
                                    Error: {it.errorMsg}
                                  </Text>
                                )}
                                <Text
                                  component="pre"
                                  size="xs"
                                  ff="monospace"
                                  style={{
                                    color: '#C1C2C5',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    margin: 0,
                                  }}
                                >
                                  {it.payload
                                    ? JSON.stringify(it.payload, null, 2)
                                    : '(no payload)'}
                                </Text>
                                {it.userAgent && (
                                  <Text size="xs" c="dimmed" mt="xs">
                                    UA: {it.userAgent}
                                  </Text>
                                )}
                              </Box>
                            </Collapse>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Fragment>
                  );
                })}
                {items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" py="xl" size="sm">
                        No audit log entries
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
