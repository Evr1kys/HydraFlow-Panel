import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBroadcast, IconSend } from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import { sendBotBroadcast } from '../api/bot';
import { extractErrorMessage } from '../api/client';

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
  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
};

export function BotBroadcastPage() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const send = async () => {
    if (!text.trim()) {
      notifications.show({ color: 'red', message: 'Message is empty' });
      return;
    }
    if (!confirm('Send this message to ALL bot users?')) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendBotBroadcast(text);
      setResult(res);
      notifications.show({
        color: 'teal',
        message: `Sent: ${res.sent}, failed: ${res.failed}`,
      });
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Broadcast"
        subtitle="Send a message to all bot users"
        icon={IconBroadcast}
        iconColor="#FA5252"
      />

      <Stack>
        <Paper p="lg" style={cardStyle}>
          <Textarea
            label="Message text"
            placeholder="Type your broadcast message..."
            minRows={6}
            autosize
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={inputStyles}
          />

          <Group justify="space-between" mt="md">
            <Text size="xs" style={{ color: '#5c5f66' }}>
              {text.length} chars
            </Text>
            <Button
              leftSection={<IconSend size={16} />}
              color="teal"
              loading={sending}
              onClick={send}
              disabled={!text.trim()}
            >
              Send to all
            </Button>
          </Group>
        </Paper>

        <Paper p="lg" style={cardStyle}>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }} mb="sm">
            Preview
          </Text>
          <Box
            p="md"
            style={{
              backgroundColor: '#161B23',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              color: '#C1C2C5',
              minHeight: 60,
            }}
          >
            {text || <Text size="sm" style={{ color: '#5c5f66' }}>Your message will appear here</Text>}
          </Box>
        </Paper>

        {result && (
          <Paper p="lg" style={cardStyle}>
            <Text size="sm" fw={600} style={{ color: '#C1C2C5' }} mb="sm">
              Last result
            </Text>
            <Group>
              <Box>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Sent
                </Text>
                <Text size="lg" fw={600} style={{ color: '#20C997' }}>
                  {result.sent}
                </Text>
              </Box>
              <Box>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Failed
                </Text>
                <Text size="lg" fw={600} style={{ color: '#FA5252' }}>
                  {result.failed}
                </Text>
              </Box>
            </Group>
          </Paper>
        )}
      </Stack>
    </>
  );
}
