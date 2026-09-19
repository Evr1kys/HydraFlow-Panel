# HydraFlow Agent integration

HydraFlow Panel manages Xray only through the versioned HydraFlow Agent API. The backend container does not write an Xray configuration on the host and does not start local shell commands.

## Register an Agent

On the node, initialize credentials and a local TLS certificate:

```bash
sudo hydraflow-agent init --hosts node-01.example.com,203.0.113.10
```

The command writes the CA and server certificate under `/etc/hydraflow/agent` and prints a one-time JSON result containing `key_id` and `secret`. Transfer the following through a trusted administrative channel:

- Agent DNS name or public IP;
- port `8443` unless changed;
- `key_id`;
- one-time `secret`;
- CA certificate content when using the generated local CA;
- optional explicit TLS server name.

Panel validates the Agent API version and health before storing the node. The secret is encrypted with `CREDENTIALS_ENCRYPTION_KEY` using AES-256-GCM and is never returned by the API.

## TLS policy

Certificate verification cannot be disabled. A node-specific CA may be stored with the node, or a global CA may be mounted through `NODE_AGENT_CA_CERT_PATH`. Optional Panel client certificates are configured with `NODE_CLIENT_CERT_PATH` and `NODE_CLIENT_KEY_PATH`.

Agent addresses are resolved before each connection and the connection is pinned to the validated IP. Loopback, private, link-local, multicast, documentation and cloud-metadata networks are rejected. Exact private IPs may be allowed through `NODE_AGENT_PRIVATE_ALLOWLIST`; cloud metadata addresses remain blocked.

## Configuration deployment

Panel records each desired deployment in `NodeDeployment`, validates it through `/api/v1/config/validate`, and applies it through `/api/v1/config/apply` with a deterministic idempotency key. The Agent validates with the real Xray binary, atomically replaces the file, restarts the dedicated service, checks readiness, and restores the previous revision on failure.

Operators can inspect deployment history, restart a node, roll back to an Agent revision, and rotate the HMAC credential. Key rotation uses a five-minute overlap and Panel verifies the new credential before replacing the encrypted local copy.

## Required environment

```env
CREDENTIALS_ENCRYPTION_KEY=<at least 32 random characters>
NODE_AGENT_CA_CERT_PATH=/run/secrets/hydraflow/agent-ca.pem
NODE_CLIENT_CERT_PATH=
NODE_CLIENT_KEY_PATH=
NODE_AGENT_PRIVATE_ALLOWLIST=
```

Do not commit registration secrets, encryption keys, CA private keys, or populated `.env` files.
