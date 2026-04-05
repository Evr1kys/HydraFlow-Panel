import { Box, Stack, Text } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  title?: string;
  message: string;
  action?: ReactNode;
  minHeight?: number;
}

export function EmptyState({
  icon: Icon = IconInbox,
  title,
  message,
  action,
  minHeight = 320,
}: EmptyStateProps) {
  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <Stack gap="sm" align="center">
        <Box
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={30} color="#5c5f66" stroke={1.5} />
        </Box>
        {title && (
          <Text size="md" fw={600} style={{ color: '#C1C2C5' }}>
            {title}
          </Text>
        )}
        <Text
          size="sm"
          style={{
            color: '#5c5f66',
            maxWidth: 420,
          }}
        >
          {message}
        </Text>
        {action && <Box mt="sm">{action}</Box>}
      </Stack>
    </Box>
  );
}
