resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}-uaen"
  location = var.location
  tags     = local.tags
}
