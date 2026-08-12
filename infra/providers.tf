provider "azurerm" {
  features {
    key_vault {
      # Escrow vault is a one-way door by design (see keyvault.tf) -- don't
      # let `tofu destroy` silently purge it.
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}
