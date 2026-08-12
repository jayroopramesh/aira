# Aira infra (dummy-application phase)

OpenTofu module for Aira's v1 server on **Azure, UAE North**. This is the
**dummy-application phase**: the infra is real (or will be, once applied),
but the app it runs is a placeholder hello-world container, not the real
auth+escrow API (which doesn't exist yet).

**Nothing here has been applied.** `tofu validate` passes; `tofu plan`/`apply`
need real Azure credentials this repo does not have and must not be run
until the captain logs in and explicitly approves. See "Waiting on" below.

## Decisions this module implements

| Decision | Source | Effect here |
|---|---|---|
| Azure, UAE North, OpenTofu | `aira-storage-plan-s8/decision-region-provider.md` | `var.location = "uaenorth"`, `azurerm` provider throughout |
| Local summarization model, no server LLM endpoint | `aira-storage-plan-s8/decision-model-choice.md` | No `llm.tf` -- v1 server is auth + escrow API host + Postgres + Key Vault + logging only. There is nothing to switch on later here; if a server-side model endpoint is ever wanted, it's a new module addition, not a flag flip. |
| Under 10 operators, next few months | same as above | Smallest sane SKUs everywhere (below); `container_app_min_replicas = 0` (scale-to-zero), `container_app_max_replicas = 2` |
| Dev/Test posture for the dummy phase | captain-provided Azure VM workload-environment screenshot | No HA (`postgres_ha_enabled = false`), no zone redundancy, minimal backup retention (`postgres_backup_retention_days = 7`, Postgres Flexible Server's floor), no geo-redundant backup. Revisit once this stops being a dummy deployment. |
| GitHub Actions, OIDC only -- no Azure DevOps | captain, explicit | `.github/workflows/infra.yml`; no service-principal secret anywhere |
| `purge_protection_enabled` explicit + false for now | this task | `var.keyvault_purge_protection_enabled`, defaults `false`. **Must flip to `true`** (captain decision `aira-tofu-plan-s10-decision-keyvault-purge-protection`) before any real escrow key is stored -- see keyvault.tf and variables.tf, both carry the same warning. |

### A note on "D-series" VM sizing

The captain's Azure screenshot shows the VM-creation blade's workload-type
picker (General Purpose D-series / Memory-optimized E-series / Compute
F-series) with a Dev/Test-vs-Production environment toggle. **This module
provisions no raw VM** -- Postgres is a Flexible Server (PaaS) and the API
host is Container Apps on the Consumption plan (serverless), neither exposes
a VM-family knob. The Dev/Test *posture* (no HA, no zone redundancy, minimal
backup) is applied above wherever the equivalent setting exists. If a future
need genuinely requires a raw VM (e.g. a jump box, a self-hosted CI runner),
pick the smallest General Purpose D-series size (e.g. `Standard_D2s_v5`)
under the Dev/Test preset (no HA, no Azure Backup) and document the cost
addition here at that time -- don't add one speculatively.

Postgres's own "General Purpose" compute tier is *also* named after D-series
VMs under the hood (e.g. `GP_Standard_D2s_v3`) -- that's a different, PaaS
sizing knob (`var.postgres_sku_name`), not the VM blade above. This module
defaults to the cheaper **Burstable** tier (`B_Standard_B1ms`), the smallest
sane choice for under-10-operators, low-volume auth+escrow traffic; General
Purpose is available as a variable bump, not the default.

## What's deployed

```
infra/
├── versions.tf         # required_version, azurerm ~>4.0 + random ~>3.6, backend "azurerm" {}
├── providers.tf         # azurerm provider block
├── variables.tf          # all parameterized inputs -- SKUs, image, purge protection, tags
├── locals.tf              # naming prefix, merged tags, random suffix
├── resource_group.tf       # rg-aira-<env>-uaen
├── network.tf                # VNet + 3 subnets + 2 private DNS zones (postgres, keyvault)
├── database.tf                # Postgres Flexible Server (VNet-integrated, no public endpoint) + app DB
├── keyvault.tf                  # escrow Key Vault (RBAC, private endpoint, audit-ready) + role assignments
├── compute.tf                    # Container Apps environment + the API container app (scale-to-zero)
├── monitoring.tf                   # Log Analytics workspace + diagnostic settings (KV, Postgres, API)
├── outputs.tf                        # resource_group_name, postgres_fqdn, key_vault_uri, container_app_url, ...
├── terraform.tfvars.example            # copy to terraform.tfvars; admin password NOT included, ever
├── .gitignore                            # .terraform/, *.tfstate*, backend.hcl, terraform.tfvars
├── app/
│   ├── server.js                           # dummy hello-world app -- 20-line Node server, echoes health + region
│   └── Dockerfile
└── bootstrap/
    └── main.tf                               # separate root module, LOCAL state: creates the tfstate storage account
```

No LLM endpoint file exists -- removed entirely per the local-model decision,
not left as a disabled stub.

Resource group, VNet (3 subnets), Postgres Flexible Server, Key Vault
(escrow secrets, RBAC, private endpoint), Container Apps environment + the
API container app (currently running the dummy hello-world image), Log
Analytics + diagnostic settings on Key Vault/Postgres/the container app.
Everything is VNet-integrated with no public endpoints except the container
app's own public ingress (so the dummy app is reachable in a browser) and,
deliberately, Postgres and Key Vault stay private.

## Prerequisites

- **Azure CLI**: installed on this machine via `pip3 install --user azure-cli`
  (Homebrew is broken here -- `/opt/homebrew` ownership + an "unknown or
  unsupported macOS version" Ruby error -- so the usual `brew install
  azure-cli` path doesn't work). It's on `PATH` for new shells via
  `~/.zshrc` (`$HOME/Library/Python/3.9/bin`). Verify with `az version`.
- **OpenTofu**: not installed system-wide. Use the standalone-binary method
  (same as the design task that produced this module):
  ```
  curl -L --fail -o tofu.zip \
    https://github.com/opentofu/opentofu/releases/download/v1.9.1/tofu_1.9.1_darwin_arm64.zip
  unzip -o tofu.zip -d ./tofu-bin
  ./tofu-bin/tofu -version
  ```
  Or fix Homebrew (`sudo chown -R $(whoami) /opt/homebrew`) and
  `brew install opentofu` once that's done.
- An Azure subscription under the captain's account, with permission to
  create resource groups, storage accounts, Postgres Flexible Servers, Key
  Vaults, Container Apps, and role assignments.

## Runbook -- first deploy (captain-run; not run by this task)

### Step 1 -- `az login` and subscription select
```
az login
az account list --output table
az account set --subscription "<subscription-id-or-name>"
```

### Step 2 -- bootstrap remote state (once, ever, per environment)
```
cd infra/bootstrap
tofu init
tofu plan
tofu apply          # creates: 1 resource group, 1 storage account, 1 blob container
```
Note the `storage_account_name` output -- needed for step 3. Keep this
directory's own `terraform.tfstate` (local, small) somewhere durable -- it's
the only record of what backs the backend.

### Step 3 -- `tofu init` (main module)
```
cd infra
tofu init \
  -backend-config="resource_group_name=rg-aira-tfstate-uaen" \
  -backend-config="storage_account_name=<from step 2 output>" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=aira.tfstate"
```

### Step 4 -- `tofu plan`
```
cp terraform.tfvars.example terraform.tfvars   # edit SKUs/env as needed
export TF_VAR_postgres_admin_password="<from a secrets manager, not typed into a file>"
tofu plan -out=tfplan
```
Review carefully -- this is the point at which the captain confirms scope
before anything real is created. Before this step, make sure the dummy
app's GHCR package (`ghcr.io/jayroopramesh/aira-dummy`) is public -- see
"Dummy app" below -- or the container app will fail to pull it after apply.

### Step 5 -- `tofu apply` (captain-only, explicit approval)
```
tofu apply tfplan
```
Then open `container_app_url` from the outputs in a browser -- it should
return JSON: `{"status":"ok","service":"aira-dummy","region":"uaenorth",...}`.

### Teardown
```
tofu destroy   # (main module, first)
cd ../bootstrap
tofu destroy   # only once the main module's state is fully torn down and no longer needed
```
With `keyvault_purge_protection_enabled = false` (the dummy-phase default),
`destroy` removes the Key Vault outright (soft-delete only, no purge-protect
lock). Once that variable is flipped `true` for real escrow data, `destroy`
will only soft-delete it -- 90-day recoverable, billed at $0, not fully
gone.

## Dummy app

`infra/app/server.js` -- a 20-line Node server with no dependencies, no
auth, no escrow logic. Responds to any path with:
```json
{"status":"ok","service":"aira-dummy","region":"uaenorth","path":"/","timestamp":"..."}
```
`.github/workflows/infra.yml`'s `build-dummy-app` job builds and pushes it
to `ghcr.io/jayroopramesh/aira-dummy` on every push to `main` touching
`infra/app/**`, tagged `latest` and `<sha>`. **The GHCR package defaults to
private** -- before first apply, either make it public (repo's Packages tab
-> aira-dummy -> Package settings -> Change visibility) or wire registry
credentials into the container app (`registry` block in `compute.tf`, not
currently configured). Replace `container_app_image` with the real built API
image once the auth+escrow API exists (§ below).

## CI (`.github/workflows/infra.yml`)

GitHub Actions only -- the captain explicitly dropped Azure DevOps. OIDC
federated login (`azure/login` with `client-id`/`tenant-id`/`subscription-id`
secrets, no stored service-principal secret).

- **`plan`** -- runs on every PR touching `infra/**`: `fmt -check`, `init`,
  `validate`, `plan`, uploads the plan as an artifact. Read-only.
- **`apply`** -- `workflow_dispatch` only, gated on the `production-infra`
  GitHub Environment (configure required reviewers there). Never runs
  automatically on push or PR.
- **`build-dummy-app`** -- builds/pushes `infra/app/` to GHCR on push to
  `main` (path-filtered to `infra/app/**`) or by hand via
  `workflow_dispatch`. No Azure credentials involved.

Required repo secrets (not created by this task): `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC federated app registration,
scoped to this repo), `TFSTATE_RG`, `TFSTATE_STORAGE_ACCOUNT` (from
bootstrap's outputs), `POSTGRES_ADMIN_PASSWORD`.

## Cost estimate (monthly, list price, order-of-magnitude -- re-verify with Azure's calculator before budgeting)

| Resource | Default SKU | Estimate | Notes |
|---|---|---|---|
| Postgres Flexible Server | `B_Standard_B1ms` (Burstable, 1 vCore, 2 GiB) | **~$12-25/mo** compute + ~$3-6/mo storage (32 GiB) | Smallest Postgres compute tier; General Purpose available via `postgres_sku_name` if headroom is wanted later. |
| Container Apps (Consumption, scale-to-zero) | 0.5 vCPU / 1 GiB, `min_replicas=0`, `max_replicas=2` | **~$0-15/mo** | Free monthly grant (180k vCPU-seconds, 360k GiB-seconds) likely covers all of the dummy phase's traffic. |
| Key Vault | Standard | **~$1-5/mo** | Per-operation pricing; negligible at escrow's rare-release volume. |
| Log Analytics workspace | PerGB2018, 30-day retention | **~$5-15/mo** | Free 5 GB/mo ingestion tier typically covers this scale. |
| VNet + subnets + private DNS zones | -- | **$0** | No charge for the VNet itself or private DNS zones; no VNet peering configured. |
| Private endpoint (Key Vault) | -- | **~$0.01/hr ≈ $7/mo** | Plus negligible data-processing charges. |
| tfstate storage account | Standard GRS | **<$1/mo** | Trivial blob volume. |
| Dummy app image (GHCR) | public package | **$0** | GitHub Container Registry storage/bandwidth for a public package is free. |
| **Subtotal** | | **~$25-70/mo**, call it **~$45-100/mo** with headroom | No LLM endpoint -- summarization is a captain-operated local model, not billed here. |

## Open items

**Blocking a real (non-dummy) deployment** -- pre-existing captain holds,
not new ones:
1. `database-hosting` (`aira-storage-plan-s8-decision-database-hosting`) --
   plain Postgres (as built) vs self-hosted Supabase. Still open; this
   module only implements plain Postgres.
2. `escrow-release-process`
   (`aira-storage-plan-s8-decision-escrow-release-process`) -- who approves,
   what enforces dual control. Key Vault gives whatever process is chosen an
   auditable place to enforce it, but doesn't build the process itself.
3. The auth+escrow API doesn't exist yet -- `container_app_image` runs the
   dummy app above until it's built.

**Genuine one-way door, needs conscious confirmation before real escrow
data:**
4. `keyvault_purge_protection_enabled` -- `false` for the dummy phase.
   Flip to `true` (captain decision
   `aira-tofu-plan-s10-decision-keyvault-purge-protection`) before storing
   any real escrow key -- see the loud comments in `keyvault.tf` and
   `variables.tf`.

## Waiting on

**Captain `az login` + explicit apply approval.** Nothing in this PR creates,
modifies, or destroys any Azure resource. `tofu validate` passes against a
local, credential-free provider install; `tofu plan`/`apply` need real Azure
credentials this task was not given and must not seek.
