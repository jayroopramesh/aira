variable "project_name" {
  type        = string
  default     = "aira"
  description = "Short project slug used in resource names."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Deployment environment slug (dev, staging, prod)."

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  type        = string
  default     = "uaenorth"
  description = "Azure region. Locked to UAE North per the captain's data-residency decision (aira-storage-plan-s8/decision-region-provider.md)."
}

variable "common_tags" {
  type = map(string)
  default = {
    project    = "aira"
    managed-by = "opentofu"
  }
  description = "Base tags merged onto every resource (see locals.tf for environment/region additions)."
}

# --- Database (parameterized SKU: database-hosting is still an open captain decision) ---

variable "postgres_sku_name" {
  type        = string
  default     = "B_Standard_B1ms"
  description = <<-EOT
    Azure Database for PostgreSQL Flexible Server compute SKU. Defaults to the
    cheapest Burstable tier, sized for v1's low call volume (auth + escrow
    only -- aira-storage-plan-s8/report.md §1). The storage plan's own
    cost sketch (§6) illustrates a 2 vCore General Purpose tier
    (~$158/mo compute); bump to e.g. GP_Standard_D2ds_v4 if that headroom
    is wanted from day one, or once phase 2 sync workloads land.
  EOT
}

variable "postgres_storage_mb" {
  type        = number
  default     = 32768
  description = "Postgres Flexible Server allocated storage, in MB (32 GiB minimum tier)."
}

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "postgres_admin_login" {
  type    = string
  default = "airaadmin"
}

variable "postgres_admin_password" {
  type        = string
  sensitive   = true
  description = "NOT defaulted. Supply via TF_VAR_postgres_admin_password (or -var) at plan/apply time, sourced from a secrets manager -- never commit a value or put one in a .tfvars file that gets checked in."
}

variable "postgres_ha_enabled" {
  type        = bool
  default     = false
  description = "Zone-redundant HA roughly doubles Postgres compute cost. Off by default -- Dev/Test posture for the dummy phase (captain decision, Azure VM workload-environment screenshot): no HA, no zone redundancy until this stops being a dummy deployment."
}

variable "postgres_backup_retention_days" {
  type        = number
  default     = 7
  description = "Postgres Flexible Server's minimum retention (7-35 days allowed). Minimal by design -- Dev/Test posture for the dummy phase, same decision as postgres_ha_enabled."
}

# --- Compute (auth + escrow API) ---

variable "container_app_image" {
  type        = string
  default     = "ghcr.io/jayroopramesh/aira-dummy:latest"
  description = <<-EOT
    The dummy hello-world app the infra runs so "is it working" is answerable
    in a browser (infra/app/ -- a 20-line Node server echoing health + region).
    .github/workflows/infra.yml builds and pushes it to this GHCR path on
    every push to main touching infra/app/**; the GHCR package must be set to
    public visibility (Package settings -> Change visibility) before first
    apply, or Container Apps can't pull it anonymously -- see infra/README.md.
    Replace with the real built API image (e.g. ghcr.io/jayroopramesh/aira-api:<sha>)
    once the auth+escrow API exists.
  EOT
}

variable "container_app_cpu" {
  type    = number
  default = 0.5
}

variable "container_app_memory" {
  type    = string
  default = "1Gi"
}

variable "container_app_min_replicas" {
  type        = number
  default     = 0
  description = "Scale-to-zero by default -- matches the storage plan's low-volume, pay-for-use framing (aira-storage-plan-s8/report.md §1)."
}

variable "container_app_max_replicas" {
  type        = number
  default     = 2
  description = "Sized for the captain's under-10-operators v1 scale (aira-storage-plan-s8/decision-model-choice.md) -- a couple of scaled-out replicas is headroom, not a real ceiling."
}

# --- Key Vault (escrow store) ---

variable "keyvault_purge_protection_enabled" {
  type        = bool
  default     = false
  description = <<-EOT
    !!! DUMMY-PHASE DEFAULT -- DO NOT LEAVE FALSE ONCE REAL ESCROW KEYS LAND !!!
    False for the dummy-application phase only, so the vault can be created
    and destroyed freely while there's nothing real in it. Purge protection
    is a one-way door (Azure never lets it be turned back off once true), so
    it's an explicit variable rather than a hardcoded value -- flip this to
    true, per captain decision aira-tofu-plan-s10-decision-keyvault-purge-protection,
    BEFORE any real escrow key is ever stored in this vault. Once true,
    `tofu destroy` will only soft-delete the vault (90-day recoverable state).
  EOT
}

# --- Observability ---

variable "log_retention_days" {
  type    = number
  default = 30
}
