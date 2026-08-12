# Managed Postgres Flexible Server -- per the storage plan's lean towards
# plain managed Postgres over self-hosted Supabase (aira-storage-plan-s8/
# report.md §3; database-hosting is still filed as an open captain decision,
# so the SKU/HA knobs below are variables, not hardcoded choices).
#
# Dev/Test posture for the dummy phase (captain decision, Azure VM
# workload-environment screenshot): no HA, no zone redundancy, minimal
# backup retention -- postgres_ha_enabled defaults false and
# geo_redundant_backup_enabled is hardcoded false below;
# postgres_backup_retention_days defaults to 7, Postgres Flexible Server's
# minimum. Revisit both once this stops being a dummy deployment.

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${local.name_prefix}-${random_string.unique.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  version             = var.postgres_version
  delegated_subnet_id = azurerm_subnet.data.id
  private_dns_zone_id = azurerm_private_dns_zone.postgres.id

  administrator_login    = var.postgres_admin_login
  administrator_password = var.postgres_admin_password

  storage_mb = var.postgres_storage_mb
  sku_name   = var.postgres_sku_name

  backup_retention_days        = var.postgres_backup_retention_days
  geo_redundant_backup_enabled = false

  dynamic "high_availability" {
    for_each = var.postgres_ha_enabled ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }

  tags = local.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "aira"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}
