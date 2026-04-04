import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Box,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDroplet, IconMail, IconLock } from '@tabler/icons-react';
import { login } from '../api/auth';
import { useAuth } from '../components/AuthProvider';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      notifications.show({
        title: 'Validation',
        message: 'Please fill in all fields',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await login(email, password);
      setToken(token);
      navigate('/');
    } catch {
      notifications.show({
        title: 'Login failed',
        message: 'Invalid email or password',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #060a12 0%, #0b1121 50%, #111b30 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        shadow="xl"
        padding="xl"
        radius="lg"
        w={420}
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
        }}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Center>
              <Group gap="xs">
                <IconDroplet size={40} color="#00e8c6" stroke={2} />
                <Text
                  size="28px"
                  fw={700}
                  style={{ color: '#00e8c6', letterSpacing: '-0.5px' }}
                >
                  HydraFlow
                </Text>
              </Group>
            </Center>

            <Text ta="center" c="dimmed" size="sm">
              Sign in to your admin panel
            </Text>

            <TextInput
              label="Email"
              placeholder="admin@hydraflow.dev"
              leftSection={<IconMail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              styles={{
                input: {
                  backgroundColor: '#060a12',
                  borderColor: '#1a2940',
                  color: '#d0d7e3',
                },
                label: { color: '#97a8c2' },
              }}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              leftSection={<IconLock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              styles={{
                input: {
                  backgroundColor: '#060a12',
                  borderColor: '#1a2940',
                  color: '#d0d7e3',
                },
                label: { color: '#97a8c2' },
              }}
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              size="md"
              mt="sm"
            >
              Sign in
            </Button>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}
