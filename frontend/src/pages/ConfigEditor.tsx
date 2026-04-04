import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Box,
  Loader,
  Badge,
  SegmentedControl,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconPlayerPlay,
  IconArrowBackUp,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconColumns,
  IconCode,
} from '@tabler/icons-react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  getXrayConfig,
  saveXrayConfig,
  getDefaultXrayConfig,
  validateXrayConfig,
} from '../api/xray';
import type { ValidationResult } from '../api/xray';

const DRAFT_KEY = 'hydraflow_config_draft';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

export function ConfigEditorPage() {
  const [originalConfig, setOriginalConfig] = useState('');
  const [draftConfig, setDraftConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [viewMode, setViewMode] = useState<string>('editor');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const config = await getXrayConfig();
      setOriginalConfig(config);
      // Restore draft from localStorage if available
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && draft !== config) {
        setDraftConfig(draft);
        notifications.show({
          title: 'Draft Restored',
          message: 'Unsaved draft loaded from local storage',
          color: 'yellow',
        });
      } else {
        setDraftConfig(config);
      }
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load Xray config',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (draftConfig && draftConfig !== originalConfig) {
      localStorage.setItem(DRAFT_KEY, draftConfig);
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [draftConfig, originalConfig]);

  const handleValidate = useCallback(async (configToValidate?: string) => {
    const config = configToValidate ?? draftConfig;
    setValidating(true);
    try {
      const result = await validateXrayConfig(config);
      setValidation(result);

      // Set markers in Monaco editor
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          const markers: editor.IMarkerData[] = [];

          for (const err of result.errors) {
            markers.push({
              severity: monacoRef.current.MarkerSeverity.Error,
              message: err.message,
              startLineNumber: err.line,
              startColumn: err.column,
              endLineNumber: err.line,
              endColumn: err.column + 1,
            });
          }

          for (const warn of result.warnings) {
            markers.push({
              severity: monacoRef.current.MarkerSeverity.Warning,
              message: warn.message,
              startLineNumber: warn.line,
              startColumn: warn.column,
              endLineNumber: warn.line,
              endColumn: warn.column + 1,
            });
          }

          monacoRef.current.editor.setModelMarkers(model, 'xray-validator', markers);
        }
      }

      if (result.valid && result.warnings.length === 0) {
        notifications.show({
          title: 'Valid',
          message: 'Config is valid',
          color: 'teal',
        });
      } else if (result.valid) {
        notifications.show({
          title: 'Valid with warnings',
          message: `${result.warnings.length} warning(s)`,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Invalid',
          message: `${result.errors.length} error(s)`,
          color: 'red',
        });
      }

      return result;
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to validate config',
        color: 'red',
      });
      return null;
    } finally {
      setValidating(false);
    }
  }, [draftConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Validate first
      const result = await handleValidate();
      if (result && !result.valid) {
        setSaving(false);
        return;
      }

      const response = await saveXrayConfig(draftConfig);
      setOriginalConfig(draftConfig);
      localStorage.removeItem(DRAFT_KEY);
      notifications.show({
        title: 'Applied',
        message: response.message,
        color: 'teal',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to save config',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [draftConfig, handleValidate]);

  const handleReset = useCallback(async () => {
    try {
      const defaultConfig = await getDefaultXrayConfig();
      setDraftConfig(defaultConfig);
      localStorage.removeItem(DRAFT_KEY);
      setValidation(null);
      notifications.show({
        title: 'Reset',
        message: 'Config reset to auto-generated default',
        color: 'blue',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to get default config',
        color: 'red',
      });
    }
  }, []);

  const handleEditorMount = useCallback((
    mountedEditor: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) => {
    editorRef.current = mountedEditor;
    monacoRef.current = monaco;

    // Configure JSON diagnostics for xray schema hints
    const jsonDefaults = (monaco.languages.json as Record<string, unknown>)['jsonDefaults'] as
      | { setDiagnosticsOptions: (opts: Record<string, unknown>) => void }
      | undefined;
    if (jsonDefaults && typeof jsonDefaults.setDiagnosticsOptions === 'function') {
      jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        trailingCommas: 'error',
      });
    }
  }, []);

  const hasChanges = draftConfig !== originalConfig;

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
        <Group gap="md">
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Config Editor
          </Text>
          {hasChanges && (
            <Badge variant="light" color="yellow" size="sm">
              Unsaved Changes
            </Badge>
          )}
          {validation && (
            <Badge
              variant="light"
              color={validation.valid ? (validation.warnings.length > 0 ? 'yellow' : 'teal') : 'red'}
              size="sm"
              leftSection={
                validation.valid ? (
                  validation.warnings.length > 0 ? <IconAlertTriangle size={12} /> : <IconCheck size={12} />
                ) : (
                  <IconX size={12} />
                )
              }
            >
              {validation.valid
                ? validation.warnings.length > 0
                  ? `${validation.warnings.length} warning(s)`
                  : 'Valid'
                : `${validation.errors.length} error(s)`}
            </Badge>
          )}
        </Group>

        <Group gap="sm">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            size="xs"
            data={[
              {
                label: (
                  <Group gap={4}>
                    <IconCode size={14} />
                    <span>Editor</span>
                  </Group>
                ),
                value: 'editor',
              },
              {
                label: (
                  <Group gap={4}>
                    <IconColumns size={14} />
                    <span>Diff</span>
                  </Group>
                ),
                value: 'diff',
              },
            ]}
            styles={{
              root: {
                backgroundColor: '#161B23',
                border: '1px solid rgba(255,255,255,0.06)',
              },
              indicator: {
                backgroundColor: 'rgba(32,201,151,0.2)',
              },
            }}
          />

          <Tooltip label="Validate without applying" withArrow>
            <Button
              variant="light"
              color="blue"
              radius="md"
              size="sm"
              loading={validating}
              onClick={() => handleValidate()}
              leftSection={<IconCheck size={14} />}
              styles={{
                root: {
                  border: '1px solid rgba(51,154,240,0.2)',
                },
              }}
            >
              Validate
            </Button>
          </Tooltip>

          <Tooltip label="Reset to auto-generated default" withArrow>
            <Button
              variant="light"
              color="gray"
              radius="md"
              size="sm"
              onClick={handleReset}
              leftSection={<IconArrowBackUp size={14} />}
              styles={{
                root: {
                  border: '1px solid rgba(255,255,255,0.1)',
                },
              }}
            >
              Reset to Default
            </Button>
          </Tooltip>

          <Button
            leftSection={<IconPlayerPlay size={14} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            size="sm"
            loading={saving}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Group gap={4}>
              <IconDeviceFloppy size={14} />
              Apply & Restart
            </Group>
          </Button>
        </Group>
      </Group>

      {/* Editor area */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
          {viewMode === 'editor' ? (
            <Editor
              height="100%"
              language="json"
              theme="vs-dark"
              value={draftConfig}
              onChange={(value) => setDraftConfig(value ?? '')}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                padding: { top: 16, bottom: 16 },
                renderLineHighlight: 'all',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }}
            />
          ) : (
            <DiffEditor
              height="100%"
              language="json"
              theme="vs-dark"
              original={originalConfig}
              modified={draftConfig}
              options={{
                readOnly: false,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                renderSideBySide: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                originalEditable: false,
              }}
              onMount={(diffEditorInstance) => {
                const modifiedEditor = diffEditorInstance.getModifiedEditor();
                modifiedEditor.onDidChangeModelContent(() => {
                  const value = modifiedEditor.getValue();
                  setDraftConfig(value);
                });
              }}
            />
          )}
        </Box>
      </Paper>

      {/* Validation details */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <Paper style={cardStyle} p="md" mt="md">
          <Text size="xs" fw={700} mb="sm" style={{ color: '#5c5f66', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Validation Results
          </Text>
          <Stack gap={4}>
            {validation.errors.map((err, i) => (
              <Group key={`err-${i}`} gap={8}>
                <IconX size={14} color="#ff6b6b" />
                <Text size="xs" style={{ color: '#ff6b6b', fontFamily: "'JetBrains Mono', monospace" }}>
                  Line {err.line}: {err.message}
                </Text>
              </Group>
            ))}
            {validation.warnings.map((warn, i) => (
              <Group key={`warn-${i}`} gap={8}>
                <IconAlertTriangle size={14} color="#FCC419" />
                <Text size="xs" style={{ color: '#FCC419', fontFamily: "'JetBrains Mono', monospace" }}>
                  Line {warn.line}: {warn.message}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
