import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  NumberInput,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Select,
  SimpleGrid,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import {
  IconReceipt,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconServer,
  IconCalendar,
} from '@tabler/icons-react';
import {
  getBillingSummary,
  getBillingNodes,
  getBillingProviders,
  createBillingProvider,
  deleteBillingProvider,
  createBillingNode,
  deleteBillingNode,
  getBillingHistory,
  createBillingHistory,
  markHistoryPaid,
} from '../api/billing';
import { getNodes } from '../api/nodes';
import type {
  BillingSummary,
  BillingNode,
  BillingProvider,
  BillingHistoryEntry,
  Node,
} from '../types';

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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof IconCurrencyDollar;
  color: string;
}) {
  return (
    <Paper p="lg" style={cardStyle}>
      <Group gap="md">
        <Box
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} color={color} stroke={1.5} />
        </Box>
        <Box>
          <Text size="xs" fw={600} style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {label}
          </Text>
          <Text size="xl" fw={700} style={{ color: '#C1C2C5' }}>
            {value}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

export function BillingPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [billingNodes, setBillingNodes] = useState<BillingNode[]>([]);
  const [providers, setProviders] = useState<BillingProvider[]>([]);
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Provider modal
  const [providerOpen, setProviderOpen] = useState(false);
  const [provName, setProvName] = useState('');
  const [provUrl, setProvUrl] = useState('');

  // Billing node modal
  const [bnOpen, setBnOpen] = useState(false);
  const [bnNodeId, setBnNodeId] = useState<string | null>(null);
  const [bnProviderId, setBnProviderId] = useState<string | null>(null);
  const [bnRate, setBnRate] = useState<number>(0);
  const [bnCurrency, setBnCurrency] = useState('USD');
  const [bnRenewal, setBnRenewal] = useState('');

  // Payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payBnId, setPayBnId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);

  const fetchAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, bn, p, h, n] = await Promise.all([
        getBillingSummary(),
        getBillingNodes(),
        getBillingProviders(),
        getBillingHistory(),
        getNodes(),
      ]);
      setSummary(s);
      setBillingNodes(bn);
      setProviders(p);
      setHistory(h);
      setNodes(n);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
      notifications.show({ title: 'Error', message: 'Failed to load billing data', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateProvider = async () => {
    if (!provName) return;
    try {
      await createBillingProvider({ name: provName, apiUrl: provUrl || undefined });
      setProviderOpen(false);
      setProvName('');
      setProvUrl('');
      notifications.show({ title: 'Success', message: 'Provider added', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to add provider', color: 'red' });
    }
  };

  const handleCreateBillingNode = async () => {
    if (!bnNodeId || !bnProviderId) return;
    try {
      await createBillingNode({
        nodeId: bnNodeId,
        providerId: bnProviderId,
        monthlyRate: bnRate,
        currency: bnCurrency,
        renewalDate: bnRenewal || undefined,
      });
      setBnOpen(false);
      setBnNodeId(null);
      setBnProviderId(null);
      setBnRate(0);
      setBnRenewal('');
      notifications.show({ title: 'Success', message: 'Billing node added', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to add billing node', color: 'red' });
    }
  };

  const handleCreatePayment = async () => {
    if (!payBnId) return;
    try {
      await createBillingHistory({ billingNodeId: payBnId, amount: payAmount, paid: true });
      setPayOpen(false);
      setPayBnId(null);
      setPayAmount(0);
      notifications.show({ title: 'Success', message: 'Payment recorded', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to record payment', color: 'red' });
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await markHistoryPaid(id);
      notifications.show({ title: 'Success', message: 'Marked as paid', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update', color: 'red' });
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

  if (!permissions.canViewBilling) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t('access.denied')}
        message={t('access.insufficientPermissions')}
      />
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
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
            <IconReceipt size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Billing
          </Text>
        </Group>
        {permissions.canEdit && (
          <Group gap="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              color="gray"
              radius="md"
              onClick={() => setProviderOpen(true)}
            >
              Add Provider
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              radius="md"
              onClick={() => setBnOpen(true)}
            >
              Add Billing Node
            </Button>
          </Group>
        )}
      </Group>

      {/* Summary Cards */}
      {summary && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            label="Monthly Cost"
            value={`$${summary.totalMonthly.toFixed(2)}`}
            icon={IconCurrencyDollar}
            color="#20C997"
          />
          <StatCard
            label="Unpaid"
            value={`$${summary.totalUnpaid.toFixed(2)}`}
            icon={IconAlertTriangle}
            color={summary.totalUnpaid > 0 ? '#FCC419' : '#20C997'}
          />
          <StatCard
            label="Tracked Nodes"
            value={String(summary.nodeCount)}
            icon={IconServer}
            color="#339AF0"
          />
          <StatCard
            label="Renewals (7d)"
            value={String(summary.upcomingRenewals.length)}
            icon={IconCalendar}
            color={summary.upcomingRenewals.length > 0 ? '#FCC419' : '#845EF7'}
          />
        </SimpleGrid>
      )}

      {/* Upcoming Renewals */}
      {summary && summary.upcomingRenewals.length > 0 && (
        <Paper p="md" style={{ ...cardStyle, borderColor: 'rgba(252,196,25,0.2)' }}>
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={16} color="#FCC419" />
            <Text size="sm" fw={600} style={{ color: '#FCC419' }}>
              Upcoming Renewals
            </Text>
          </Group>
          {summary.upcomingRenewals.map((r) => (
            <Group key={r.id} justify="space-between" py={4}>
              <Text size="sm" style={{ color: '#C1C2C5' }}>
                {r.nodeName} ({r.providerName})
              </Text>
              <Group gap="xs">
                <Badge variant="light" color="yellow" size="sm">
                  ${r.monthlyRate.toFixed(2)}/{r.currency}
                </Badge>
                <Text size="xs" style={{ color: '#909296' }}>
                  {new Date(r.renewalDate).toLocaleDateString()}
                </Text>
              </Group>
            </Group>
          ))}
        </Paper>
      )}

      {/* Billing Nodes Table */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
            Node Costs
          </Text>
        </Box>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Node</Table.Th>
                <Table.Th style={thStyle}>Provider</Table.Th>
                <Table.Th style={thStyle}>Monthly Rate</Table.Th>
                <Table.Th style={thStyle}>Renewal</Table.Th>
                <Table.Th style={{ ...thStyle, width: 120 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {billingNodes.map((bn, idx) => (
                <Table.Tr
                  key={bn.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                      {bn.node.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {bn.provider.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="teal" size="sm">
                      ${bn.monthlyRate.toFixed(2)} {bn.currency}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {bn.renewalDate ? new Date(bn.renewalDate).toLocaleDateString() : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        radius="md"
                        onClick={() => {
                          setPayBnId(bn.id);
                          setPayAmount(bn.monthlyRate);
                          setPayOpen(true);
                        }}
                        style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                      >
                        <IconCurrencyDollar size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        radius="md"
                        onClick={async () => {
                          try {
                            await deleteBillingNode(bn.id);
                            notifications.show({ title: 'Deleted', message: 'Billing node removed', color: 'teal' });
                            await fetchAll();
                          } catch {
                            notifications.show({ title: 'Error', message: 'Failed to delete', color: 'red' });
                          }
                        }}
                        style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {billingNodes.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconReceipt}
                      message="No billing nodes configured"
                      minHeight={160}
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Payment History */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
            Payment History
          </Text>
        </Box>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Date</Table.Th>
                <Table.Th style={thStyle}>Amount</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={{ ...thStyle, width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((h, idx) => (
                <Table.Tr
                  key={h.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="sm" style={{ color: '#C1C2C5' }}>
                      {new Date(h.date).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} ff="monospace" style={{ color: '#C1C2C5' }}>
                      ${h.amount.toFixed(2)} {h.currency}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={h.paid ? 'teal' : 'yellow'} size="sm">
                      {h.paid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {!h.paid && (
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        radius="md"
                        onClick={() => handleMarkPaid(h.id)}
                        style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {history.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Box py={32} style={{ display: 'flex', justifyContent: 'center' }}>
                      <Text size="sm" style={{ color: '#5c5f66' }}>No payment history</Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Providers List */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
            Providers
          </Text>
        </Box>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>API URL</Table.Th>
                <Table.Th style={thStyle}>Created</Table.Th>
                <Table.Th style={{ ...thStyle, width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {providers.map((p, idx) => (
                <Table.Tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>{p.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ color: '#909296' }}>
                      {p.apiUrl || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      radius="md"
                      onClick={async () => {
                        try {
                          await deleteBillingProvider(p.id);
                          notifications.show({ title: 'Deleted', message: 'Provider removed', color: 'teal' });
                          await fetchAll();
                        } catch {
                          notifications.show({ title: 'Error', message: 'Failed to delete', color: 'red' });
                        }
                      }}
                      style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {providers.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Box py={32} style={{ display: 'flex', justifyContent: 'center' }}>
                      <Text size="sm" style={{ color: '#5c5f66' }}>No providers configured</Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Create Provider Modal */}
      <Modal
        opened={providerOpen}
        onClose={() => setProviderOpen(false)}
        title="Add Provider"
        radius="lg"
        styles={{
          content: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.06)' },
          header: { backgroundColor: '#1E2128', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <TextInput
            label="Name"
            placeholder="Hetzner"
            value={provName}
            onChange={(e) => setProvName(e.currentTarget.value)}
            error={provName.trim() === '' ? t('validation.required') : null}
            styles={inputStyles}
          />
          <TextInput
            label="API URL"
            placeholder="https://api.hetzner.cloud (optional)"
            value={provUrl}
            onChange={(e) => setProvUrl(e.currentTarget.value)}
            error={
              provUrl.trim() &&
              !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(provUrl.trim())
                ? t('validation.url')
                : null
            }
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            onClick={handleCreateProvider}
            radius="md"
            fullWidth
            disabled={!provName.trim()}
          >
            Add Provider
          </Button>
        </Stack>
      </Modal>

      {/* Create Billing Node Modal */}
      <Modal
        opened={bnOpen}
        onClose={() => setBnOpen(false)}
        title="Add Billing Node"
        radius="lg"
        styles={{
          content: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.06)' },
          header: { backgroundColor: '#1E2128', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <Select
            label="Node"
            placeholder="Select node"
            data={nodes.map((n) => ({ value: n.id, label: n.name }))}
            value={bnNodeId}
            onChange={setBnNodeId}
            styles={{
              ...inputStyles,
              dropdown: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 },
            }}
          />
          <Select
            label="Provider"
            placeholder="Select provider"
            data={providers.map((p) => ({ value: p.id, label: p.name }))}
            value={bnProviderId}
            onChange={setBnProviderId}
            styles={{
              ...inputStyles,
              dropdown: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 },
            }}
          />
          <NumberInput
            label="Monthly Rate ($)"
            value={bnRate}
            onChange={(v) => setBnRate(Number(v))}
            error={bnRate < 0 ? t('validation.positive') : null}
            min={0}
            decimalScale={2}
            styles={inputStyles}
          />
          <TextInput
            label="Currency"
            value={bnCurrency}
            onChange={(e) => setBnCurrency(e.currentTarget.value)}
            error={bnCurrency.trim() === '' ? t('validation.required') : null}
            styles={inputStyles}
          />
          <TextInput
            label="Renewal Date"
            type="date"
            value={bnRenewal}
            onChange={(e) => setBnRenewal(e.currentTarget.value)}
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            onClick={handleCreateBillingNode}
            radius="md"
            fullWidth
            disabled={!bnNodeId || !bnProviderId || bnRate < 0 || !bnCurrency.trim()}
          >
            Add Billing Node
          </Button>
        </Stack>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        opened={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Payment"
        radius="lg"
        styles={{
          content: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.06)' },
          header: { backgroundColor: '#1E2128', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <NumberInput
            label="Amount ($)"
            value={payAmount}
            onChange={(v) => setPayAmount(Number(v))}
            error={payAmount < 0 ? t('validation.positive') : null}
            min={0}
            decimalScale={2}
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            onClick={handleCreatePayment}
            radius="md"
            fullWidth
            disabled={payAmount < 0}
          >
            Record Payment
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default BillingPage;
