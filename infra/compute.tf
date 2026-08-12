# Small container host for the auth + escrow API. Azure Container Apps
# (Consumption plan, scale-to-zero) rather than an always-on App Service plan
# -- matches the under-10-operators sizing decision
# (aira-storage-plan-s8/decision-model-choice.md). Two possible LLM paths are
# wired, either or both usable: LLM_ENDPOINT_URL points at the self-hosted
# GPU VM (llm.tf) when var.llm_vm_enabled (off by default); AZURE_ENDPOINT /
# AZURE_KEY point at the captain's own Azure AI Foundry serverless
# deployment for the demo phase (placeholders until pasted in, see
# keyvault.tf) -- named to match the captain's own azure-ai-inference
# connection script exactly, see infra/app/server.py. Revisit compute plan
# if sustained traffic ever justifies fixed capacity.
#
# container_app_image defaults to the dummy hello-world app in infra/app/
# (built + pushed to GHCR by .github/workflows/infra.yml) so this module
# plans/applies to something an operator can open in a browser -- see
# infra/README.md.

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name_prefix}-uaen"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  infrastructure_subnet_id   = azurerm_subnet.app.id

  tags = local.tags
}

# Created up front (not as the container app's SystemAssigned identity) so
# the Key Vault role assignment below doesn't depend on the container app
# existing -- SystemAssigned would create a cycle: the app's secret block
# needs read access to resolve at create time, but a SystemAssigned
# principal_id only exists once the app itself is created.
resource "azurerm_user_assigned_identity" "api" {
  name                = "id-${local.name_prefix}-api"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_container_app" "api" {
  name                         = "ca-${local.name_prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api.id]
  }

  template {
    min_replicas = var.container_app_min_replicas
    max_replicas = var.container_app_max_replicas

    container {
      name   = "auth-escrow-api"
      image  = var.container_app_image
      cpu    = var.container_app_cpu
      memory = var.container_app_memory

      env {
        name  = "DATABASE_HOST"
        value = azurerm_postgresql_flexible_server.main.fqdn
      }
      env {
        name  = "DATABASE_NAME"
        value = azurerm_postgresql_flexible_server_database.app.name
      }
      env {
        name  = "DATABASE_ADMIN_USER"
        value = var.postgres_admin_login
      }
      env {
        name        = "DATABASE_ADMIN_PASSWORD"
        secret_name = "db-admin-password"
      }
      env {
        name  = "KEY_VAULT_URI"
        value = azurerm_key_vault.escrow.vault_uri
      }
      env {
        name  = "LLM_ENDPOINT_URL"
        value = local.llm_endpoint_url
      }
      env {
        name        = "AZURE_ENDPOINT"
        secret_name = "azure-endpoint"
      }
      env {
        name        = "AZURE_KEY"
        secret_name = "azure-key"
      }
      env {
        name  = "AZURE_REGION"
        value = var.location
      }
    }
  }

  # Pulled from the vault at deploy time via the container app's own managed
  # identity -- not passed as a plain apply-time value.
  secret {
    name                = "db-admin-password"
    key_vault_secret_id = azurerm_key_vault_secret.postgres_admin_password.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  # Placeholder values until the captain pastes the real Foundry portal
  # values into Key Vault and re-applies -- see keyvault.tf and
  # infra/README.md "Foundry serverless endpoint (demo phase)".
  secret {
    name                = "azure-endpoint"
    key_vault_secret_id = azurerm_key_vault_secret.azure_endpoint.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  secret {
    name                = "azure-key"
    key_vault_secret_id = azurerm_key_vault_secret.azure_key.versionless_id
    identity            = azurerm_user_assigned_identity.api.id
  }

  depends_on = [azurerm_role_assignment.api_kv_secrets_user]

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = local.tags
}
