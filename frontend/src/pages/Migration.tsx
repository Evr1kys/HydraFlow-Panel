import { useState, useRef } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Box,
  Progress,
  Badge,
  SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconDatabaseImport,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { migrateFrom3xui, migrateFromMarzban } from '../api/migration';
import type { MigrationProgress } from '../api/migration';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

interface MigrationSource {
  id: string;
  name: string;
  description: string;
  color: string;
  fileHint: string;
  handler: (file: File) => Promise<MigrationProgress>;
}

const sources: MigrationSource[] = [
  {
    id: '3xui',
    name: '3X-UI',
    description: 'Import users from 3x-ui panel. Upload the x-ui.db SQLite database file or a JSON export.',
    color: '#339AF0',
    fileHint: 'x-ui.db or JSON export',
    handler: migrateFrom3xui,
  },
  {
    id: 'marzban',
    name: 'Marzban',
    description: 'Import users from Marzban panel. Upload the SQLite database file or a JSON export.',
    color: '#845EF7',
    fileHint: 'marzban.db or JSON export',
    handler: migrateFromMarzban,
  },
];

function MigrationCard({ source }: { source: MigrationSource }) {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleMigrate = async () => {
    if (!selectedFile) return;
    setMigrating(true);
    setResult(null);
    try {
      const progress = await source.handler(selectedFile);
      setResult(progress);
      if (progress.errors.length === 0) {
        notifications.show({
          title: 'Migration Complete',
          message: `Imported ${progress.imported} users from ${source.name}`,
          color: 'teal',
        });
      } else {
        notifications.show({
          title: 'Migration Complete with Errors',
          message: `Imported ${progress.imported}, skipped ${progress.skipped}, ${progress.errors.length} error(s)`,
          color: 'yellow',
        });
      }
    } catch {
      notifications.show({
        title: 'Migration Failed',
        message: `Failed to import from ${source.name}`,
        color: 'red',
      });
    } finally {
      setMigrating(false);
    }
  };

  const totalProcessed = result ? result.imported + result.skipped + result.errors.length : 0;
  const progressPercent = result && result.total > 0
    ? Math.round((totalProcessed / result.total) * 100)
    : 0;

  return (
    <Paper
      style={{
        ...cardStyle,
        overflow: 'hidden',
        borderColor: `${source.color}22`,
      }}
    >
      <Box
        px="lg"
        py="sm"
        style={{
          background: `linear-gradient(135deg, ${source.color}15, ${source.color}08)`,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Group gap={8}>
          <IconDatabaseImport size={18} color={source.color} />
          <Text fw={600} size="sm" style={{ color: '#C1C2C5' }}>
            {source.name}
          </Text>
        </Group>
      </Box>
      <Stack gap="md" p="lg">
        <Text size="xs" style={{ color: '#909296' }}>
          {source.description}
        </Text>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".db,.sqlite,.sqlite3,.json"
        />

        <Button
          variant="light"
          color="gray"
          radius="md"
          fullWidth
          leftSection={<IconUpload size={14} />}
          onClick={() => fileInputRef.current?.click()}
          styles={{
            root: {
              border: '1px solid rgba(255,255,255,0.1)',
              height: 48,
            },
          }}
        >
          {selectedFile ? selectedFile.name : `Choose file (${source.fileHint})`}
        </Button>

        {selectedFile && (
          <Button
            variant="gradient"
            gradient={{ from: source.color, to: `${source.color}CC` }}
            radius="md"
            fullWidth
            loading={migrating}
            onClick={handleMigrate}
            leftSection={<IconDatabaseImport size={14} />}
          >
            Import from {source.name}
          </Button>
        )}

        {result && (
          <Box>
            <Progress
              value={progressPercent}
              color={result.errors.length > 0 ? 'yellow' : 'teal'}
              size="sm"
              radius="xl"
              mb="sm"
            />

            <Group gap="xs" mb="sm">
              <Badge variant="light" color="teal" size="sm" leftSection={<IconCheck size={10} />}>
                {result.imported} imported
              </Badge>
              <Badge variant="light" color="gray" size="sm">
                {result.skipped} skipped
              </Badge>
              {result.errors.length > 0 && (
                <Badge variant="light" color="red" size="sm" leftSection={<IconX size={10} />}>
                  {result.errors.length} error(s)
                </Badge>
              )}
              <Badge variant="light" color="blue" size="sm">
                {result.total} total
              </Badge>
            </Group>

            {result.errors.length > 0 && (
              <Stack gap={4}>
                {result.errors.slice(0, 10).map((err, i) => (
                  <Group key={i} gap={6}>
                    <IconAlertTriangle size={12} color="#FCC419" />
                    <Text size="xs" style={{ color: '#FCC419', fontFamily: "'JetBrains Mono', monospace" }}>
                      {err}
                    </Text>
                  </Group>
                ))}
                {result.errors.length > 10 && (
                  <Text size="xs" style={{ color: '#5c5f66' }}>
                    ... and {result.errors.length - 10} more errors
                  </Text>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function MigrationPage() {
  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
          Migration Tools
        </Text>
      </Group>

      <Text size="sm" style={{ color: '#909296' }} mb="lg">
        Import users from other proxy management panels. Upload your database file
        and HydraFlow will parse and import the users automatically.
      </Text>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {sources.map((source) => (
          <MigrationCard key={source.id} source={source} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export default MigrationPage;
