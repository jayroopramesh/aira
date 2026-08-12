terraform {
  required_version = ">= 1.8.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state in Azure Storage. Values are intentionally NOT hardcoded
  # here -- they're supplied via `-backend-config` flags (or a gitignored
  # backend.hcl) at `tofu init` time, pointing at the storage account created
  # by ../bootstrap. See report.md "Runbook: state bootstrap".
  backend "azurerm" {}
}
