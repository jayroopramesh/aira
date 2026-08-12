# Key Vault for the escrowed decrypt key -- chosen over a Postgres-encrypted
# column. Rationale (see report.md "Key Vault vs Postgres column"):
#   - separate RBAC surface from the app database, so escrow access isn't a
#     side effect of ordinary DB access;
#   - built-in per-operation audit log (AuditEvent, wired to Log Analytics
#     below), satisfying the storage plan's "every escrow read/release must
#     be logged" requirement (aira-storage-plan-s8/report.md §4);
#   - soft-delete + purge protection give a recovery window and block
#     unilateral deletion, which a DB column has no equivalent of;
#   - HSM-backed at the Premium SKU if that's ever warranted.
# This is a recommendation, not a locked decision -- the escrow-release
# *process* (who approves, what enforces dual control) is still open
# (aira-storage-plan-s8/report.md §7 item 5) and isn't decided here.

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "escrow" {
  name                = "kv-${var.project_name}-esc-${random_string.unique.result}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  rbac_authorization_enabled = true
  # !!! DUMMY-PHASE DEFAULT: var.keyvault_purge_protection_enabled is `false`
  # for this phase. It is a genuine one-way door once flipped (Azure never
  # allows purge protection back off) -- MUST be set to `true` before any
  # real escrow key is ever stored here. See variables.tf and captain
  # decision aira-tofu-plan-s10-decision-keyvault-purge-protection.
  purge_protection_enabled      = var.keyvault_purge_protection_enabled
  soft_delete_retention_days    = 90
  public_network_access_enabled = false

  tags = local.tags
}

resource "azurerm_private_endpoint" "keyvault" {
  name                = "pe-kv-escrow"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "psc-kv-escrow"
    private_connection_resource_id = azurerm_key_vault.escrow.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.keyvault.id]
  }

  tags = local.tags
}

# Deployer identity (whoever/whatever runs `tofu apply`, e.g. the GitHub
# Actions OIDC principal) needs to write the Postgres admin password into
# the vault below.
resource "azurerm_role_assignment" "deployer_kv_secrets_officer" {
  scope                = azurerm_key_vault.escrow.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# The API's managed identity only gets read access -- it should never need
# to write or delete secrets, escrowed keys included. Scoped to the
# user-assigned identity (compute.tf), not the container app itself, so this
# can be created before the app that consumes it -- see compute.tf comment.
resource "azurerm_role_assignment" "api_kv_secrets_user" {
  scope                = azurerm_key_vault.escrow.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
}

resource "azurerm_key_vault_secret" "postgres_admin_password" {
  name         = "postgres-admin-password"
  value        = var.postgres_admin_password
  key_vault_id = azurerm_key_vault.escrow.id

  depends_on = [azurerm_role_assignment.deployer_kv_secrets_officer]
}
