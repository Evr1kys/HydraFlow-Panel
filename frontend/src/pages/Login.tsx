import { useState } from 'react';
import { Box, Button, Card, Center, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDroplet, IconLock, IconMail } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await login(email, password); navigate('/dashboard'); }
    catch { notifications.show({ title: 'Authentication failed', message: 'Invalid email or password', color: 'red' }); }
    finally { setLoading(false); }
  };

  return (
    <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #060a12 0%, #0b1121 50%, #111b30 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card w={420} p="xl" radius="lg" style={{ backgroundColor: 'rgba(11, 17, 33, 0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(85, 104, 128, 0.2)' }}>
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Center>
              <Stack align="center" gap={4}>
                <IconDroplet size={48} stroke={1.5} color="var(--mantine-color-teal-5)" />
                <Title order={2} c="white">HydraFlow</Title>
                <Text size="sm" c="dimmed">Sign in to your panel</Text>
              </Stack>
            </Center>
            <TextInput label="Email" placeholder="admin@hydraflow.dev" value={email} onChange={(e) => setEmail(e.currentTarget.value)}
              leftSection={<IconMail size={16} stroke={1.5} />} required styles={{ input: { backgroundColor: 'rgba(26, 41, 64, 0.5)', borderColor: 'rgba(85, 104, 128, 0.3)' } }} />
            <PasswordInput label="Password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.currentTarget.value)}
              leftSection={<IconLock size={16} stroke={1.5} />} required styles={{ input: { backgroundColor: 'rgba(26, 41, 64, 0.5)', borderColor: 'rgba(85, 104, 128, 0.3)' } }} />
            <Button type="submit" fullWidth loading={loading} size="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }}>Sign In</Button>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}
