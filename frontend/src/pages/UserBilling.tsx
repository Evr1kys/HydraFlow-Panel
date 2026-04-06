import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Loader,
  Paper,
  Badge,
  Select,
  SimpleGrid,
  Switch,
  PasswordInput,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCreditCard,
  IconCoin,
  IconReceipt,
  IconPlus,
  IconSettings,
  IconCheck,
  IconX,
  IconExternalLink,
} from '@tabler/icons-react';
import {
  createCheckout,
  listAllSubscriptions,
  manualConfirmSubscription,
  cancelSubscription,
  type PaymentProviderName,
  type UserSubscription,
} from '../api/userBilling';
import { getUsers } from '../api/users';
import type { User } from '../types';

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

interface PaymentPlan {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  daysDuration: number;
  trafficGb?: number;
}

const DEFAULT_PLANS: PaymentPlan[] = [
  { id: 'monthly', name: 'Monthly', priceAmount: 5, priceCurrency: 'USD', daysDuration: 30, trafficGb: 100 },
  { id: 'yearly', name: 'Yearly', priceAmount: 50, priceCurrency: 'USD', daysDuration: 365, trafficGb: 1200 },
  { id: 'custom', name: 'Custom', priceAmount: 0, priceCurrency: 'USD', daysDuration: 30 },
];

interface ProviderSettings {
  yookassaEnabled: boolean;
  stripeEnabled: boolean;
  cryptoEnabled: boolean;
  yookassaShopId: string;
  yookassaSecretKey: string;
  stripeSecretKey: string;
}

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  yookassaEnabled: false,
  stripeEnabled: false,
  cryptoEnabled: false,
  yookassaShopId: '',
  yookassaSecretKey: '',
  stripeSecretKey: '',
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof IconCreditCard;
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
          <Text
            size="xs"
            fw={600}
            style={{ color: '#5c5f66', letterSpacing: '0.5px', textTransform: 'uppercase' }}
          >
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

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'teal';
    case 'pending':
      return 'yellow';
    case 'cancelled':
      return 'red';
    case 'expired':
      return 'gray';
    default:
      return 'gray';
  }
}

export function UserBillingPage() {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [plans] = useState<PaymentPlan[]>(DEFAULT_PLANS);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(() => {
    try {
      const raw = localStorage.getItem('hydraflow_billing_settings');
      if (raw) return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_PROVIDER_SETTINGS;
  });

  // Checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly');
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProviderName>('yookassa');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [customDays, setCustomDays] = useState<number>(30);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] =
    useState<ProviderSettings>(providerSettings);

  const fetchAll = useCallback(async () => {
    try {
      const [subs, userList] = await Promise.all([
        listAllSubscriptions(),
        getUsers(),
      ]);
      setSubscriptions(subs);
      setUsers(userList);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load subscriptions',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0],
    [plans, selectedPlanId],
  );

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active').length;
    const pending = subscriptions.filter((s) => s.status === 'pending').length;
    const totalRevenue = subscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + s.priceAmount, 0);
    return { active, pending, totalRevenue };
  }, [subscriptions]);

  const handleCreateCheckout = async () => {
    if (!selectedUserId || !selectedPlan) return;
    const amount =
      selectedPlan.id === 'custom' ? customAmount : selectedPlan.priceAmount;
    const days =
      selectedPlan.id === 'custom' ? customDays : selectedPlan.daysDuration;
    if (amount <= 0 || days <= 0) {
      notifications.show({
        title: 'Error',
        message: 'Amount and duration must be greater than zero',
        color: 'red',
      });
      return;
    }
    try {
      const result = await createCheckout({
        userId: selectedUserId,
        plan: selectedPlan.id,
        priceAmount: amount,
        priceCurrency: selectedPlan.priceCurrency,
        provider: selectedProvider,
        daysDuration: days,
        trafficGb: selectedPlan.trafficGb,
        returnUrl: `${window.location.origin}/user-billing`,
        description: `${selectedPlan.name} plan`,
      });
      setCheckoutOpen(false);
      notifications.show({
        title: 'Payment link created',
        message: result.confirmationUrl
          ? 'Open link to complete payment'
          : 'Awaiting manual confirmation',
        color: 'teal',
      });
      if (result.confirmationUrl) {
        window.open(result.confirmationUrl, '_blank', 'noopener');
      }
      await fetchAll();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to create payment link',
        color: 'red',
      });
    }
  };

  const handleManualConfirm = async (id: string) => {
    try {
      await manualConfirmSubscription(id);
      notifications.show({
        title: 'Activated',
        message: 'Subscription marked as paid',
        color: 'teal',
      });
      await fetchAll();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to confirm payment',
        color: 'red',
      });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelSubscription(id);
      notifications.show({
        title: 'Cancelled',
        message: 'Subscription cancelled',
        color: 'teal',
      });
      await fetchAll();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to cancel',
        color: 'red',
      });
    }
  };

  const saveSettings = () => {
    setProviderSettings(settingsDraft);
    localStorage.setItem(
      'hydraflow_billing_settings',
      JSON.stringify(settingsDraft),
    );
    setSettingsOpen(false);
    notifications.show({
      title: 'Saved',
      message: 'Provider settings updated',
      color: 'teal',
    });
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
            <IconCreditCard size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            User Billing
          </Text>
        </Group>
        <Group gap="xs">
          <Button
            leftSection={<IconSettings size={16} />}
            variant="light"
            color="gray"
            radius="md"
            onClick={() => {
              setSettingsDraft(providerSettings);
              setSettingsOpen(true);
            }}
          >
            Providers
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={() => setCheckoutOpen(true)}
          >
            Create Payment Link
          </Button>
        </Group>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        <StatCard
          label="Active Subscriptions"
          value={String(stats.active)}
          icon={IconCheck}
          color="#20C997"
        />
        <StatCard
          label="Pending Payments"
          value={String(stats.pending)}
          icon={IconReceipt}
          color="#FCC419"
        />
        <StatCard
          label="Active Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          icon={IconCoin}
          color="#339AF0"
        />
      </SimpleGrid>

      {/* Plans list */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
            Available Plans
          </Text>
        </Box>
        <SimpleGrid cols={{ base: 1, md: 3 }} p="md" spacing="md">
          {plans.map((p) => (
            <Paper
              key={p.id}
              p="md"
              style={{
                backgroundColor: '#161B23',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}
            >
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                {p.name}
              </Text>
              <Text size="xl" fw={700} style={{ color: '#20C997' }} mt={4}>
                {p.id === 'custom' ? 'Custom' : `$${p.priceAmount.toFixed(0)}`}
              </Text>
              <Text size="xs" style={{ color: '#909296' }}>
                {p.daysDuration} days{p.trafficGb ? ` · ${p.trafficGb} GB` : ''}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>

      {/* Subscription history */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
            Recent Subscriptions
          </Text>
        </Box>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Table.Th style={thStyle}>User</Table.Th>
                <Table.Th style={thStyle}>Plan</Table.Th>
                <Table.Th style={thStyle}>Provider</Table.Th>
                <Table.Th style={thStyle}>Amount</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Created</Table.Th>
                <Table.Th style={{ ...thStyle, width: 140 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {subscriptions.map((s, idx) => {
                const user = userById.get(s.userId);
                return (
                  <Table.Tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      backgroundColor:
                        idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    }}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                        {user?.email ?? s.userId.slice(0, 8)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ color: '#909296' }}>
                        {s.plan} · {s.daysDuration}d
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="gray" size="sm">
                        {s.provider}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                        {s.priceAmount.toFixed(2)} {s.priceCurrency}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={statusColor(s.status)} size="sm">
                        {s.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ color: '#909296' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {s.status === 'pending' && (
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            radius="md"
                            onClick={() => handleManualConfirm(s.id)}
                            style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                            title="Mark paid"
                          >
                            <IconCheck size={14} />
                          </ActionIcon>
                        )}
                        {s.status !== 'cancelled' && s.status !== 'expired' && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            radius="md"
                            onClick={() => handleCancel(s.id)}
                            style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                            title="Cancel"
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {subscriptions.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Box
                      py={48}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <IconReceipt size={40} color="#373A40" stroke={1} />
                      <Text ta="center" size="sm" style={{ color: '#5c5f66' }}>
                        No subscriptions yet
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Create Checkout Modal */}
      <Modal
        opened={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Create Payment Link"
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
          <Select
            label="User"
            placeholder="Select user"
            searchable
            data={users.map((u) => ({ value: u.id, label: u.email }))}
            value={selectedUserId}
            onChange={setSelectedUserId}
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
            label="Plan"
            data={plans.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.id === 'custom' ? '—' : `$${p.priceAmount}/${p.daysDuration}d`})`,
            }))}
            value={selectedPlanId}
            onChange={(v) => setSelectedPlanId(v ?? 'monthly')}
            styles={{
              ...inputStyles,
              dropdown: {
                backgroundColor: '#1E2128',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
              },
            }}
          />
          {selectedPlan.id === 'custom' && (
            <>
              <NumberInput
                label="Amount (USD)"
                value={customAmount}
                onChange={(v) => setCustomAmount(Number(v))}
                decimalScale={2}
                styles={inputStyles}
              />
              <NumberInput
                label="Duration (days)"
                value={customDays}
                onChange={(v) => setCustomDays(Number(v))}
                styles={inputStyles}
              />
            </>
          )}
          <Select
            label="Provider"
            data={[
              { value: 'yookassa', label: 'YooKassa' },
              { value: 'stripe', label: 'Stripe' },
              { value: 'crypto', label: 'Crypto' },
            ]}
            value={selectedProvider}
            onChange={(v) =>
              setSelectedProvider((v as PaymentProviderName) ?? 'yookassa')
            }
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
            onClick={handleCreateCheckout}
            radius="md"
            fullWidth
            leftSection={<IconExternalLink size={16} />}
          >
            Create Payment Link
          </Button>
        </Stack>
      </Modal>

      {/* Provider Settings Modal */}
      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Payment Provider Settings"
        radius="lg"
        size="lg"
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
        <Stack gap="lg" mt="md">
          <Paper p="md" style={{ backgroundColor: '#161B23', borderRadius: 8 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                YooKassa
              </Text>
              <Switch
                checked={settingsDraft.yookassaEnabled}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    yookassaEnabled: e.currentTarget.checked,
                  }))
                }
                color="teal"
              />
            </Group>
            <Stack gap="xs">
              <TextInput
                label="Shop ID"
                value={settingsDraft.yookassaShopId}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    yookassaShopId: e.currentTarget.value,
                  }))
                }
                styles={inputStyles}
              />
              <PasswordInput
                label="Secret Key"
                value={settingsDraft.yookassaSecretKey}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    yookassaSecretKey: e.currentTarget.value,
                  }))
                }
                styles={inputStyles}
              />
            </Stack>
            <Text size="xs" mt="xs" style={{ color: '#5c5f66' }}>
              Server reads YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY env vars.
            </Text>
          </Paper>

          <Paper p="md" style={{ backgroundColor: '#161B23', borderRadius: 8 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                Stripe
              </Text>
              <Switch
                checked={settingsDraft.stripeEnabled}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    stripeEnabled: e.currentTarget.checked,
                  }))
                }
                color="teal"
              />
            </Group>
            <PasswordInput
              label="Secret Key"
              value={settingsDraft.stripeSecretKey}
              onChange={(e) =>
                setSettingsDraft((s) => ({
                  ...s,
                  stripeSecretKey: e.currentTarget.value,
                }))
              }
              styles={inputStyles}
            />
            <Text size="xs" mt="xs" style={{ color: '#5c5f66' }}>
              Server reads STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET env vars.
            </Text>
          </Paper>

          <Paper p="md" style={{ backgroundColor: '#161B23', borderRadius: 8 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                Crypto (NOWPayments)
              </Text>
              <Switch
                checked={settingsDraft.cryptoEnabled}
                onChange={(e) =>
                  setSettingsDraft((s) => ({
                    ...s,
                    cryptoEnabled: e.currentTarget.checked,
                  }))
                }
                color="teal"
              />
            </Group>
            <Text size="xs" style={{ color: '#5c5f66' }}>
              Manual confirmation mode unless NOWPAYMENTS_API_KEY is configured
              server-side.{' '}
              <Anchor
                href="https://documenter.getpostman.com/view/7907941/2s93JusNJt"
                target="_blank"
                size="xs"
              >
                NOWPayments docs
              </Anchor>
            </Text>
          </Paper>

          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            onClick={saveSettings}
            radius="md"
            fullWidth
          >
            Save Settings
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default UserBillingPage;
