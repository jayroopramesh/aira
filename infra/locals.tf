locals {
  name_prefix = "${var.project_name}-${var.environment}"

  tags = merge(var.common_tags, {
    environment = var.environment
    region      = var.location
  })
}

# Short random suffix for globally-unique names (storage account, Key Vault,
# Postgres server, Cognitive account). Generated once and remembered in
# state, so it's stable across subsequent plans/applies.
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
  numeric = true
}
