import { Badge, Box, Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  icon?: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  iconColor?: string;
  count?: number;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  icon: Icon,
  iconColor = '#20C997',
  count,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <Group justify="space-between" wrap="wrap" mb="lg">
      <Group gap="sm" wrap="nowrap">
        {Icon && (
          <Box
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={iconColor} stroke={1.5} />
          </Box>
        )}
        <Box>
          <Group gap="sm" align="center">
            <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
              {title}
            </Text>
            {typeof count === 'number' && (
              <Badge
                variant="light"
                color="teal"
                size="lg"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {count}
              </Badge>
            )}
          </Group>
          {subtitle && (
            <Text size="xs" style={{ color: '#5c5f66' }}>
              {subtitle}
            </Text>
          )}
        </Box>
      </Group>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}
