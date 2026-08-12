# Log/audit basics. The Key Vault diagnostic setting is the audit trail the
# storage plan calls a hard requirement for escrow releases
# (aira-storage-plan-s8/report.md §4) -- who requested/approved/when is
# reconstructable from AuditEvent logs here, independent of the app DB.

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name_prefix}-uaen"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.tags
}

resource "azurerm_monitor_diagnostic_setting" "keyvault" {
  name                       = "diag-kv-escrow"
  target_resource_id         = azurerm_key_vault.escrow.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "AuditEvent"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

resource "azurerm_monitor_diagnostic_setting" "postgres" {
  name                       = "diag-psql"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

resource "azurerm_monitor_diagnostic_setting" "container_app" {
  name                       = "diag-api"
  target_resource_id         = azurerm_container_app.api.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "ContainerAppConsoleLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
