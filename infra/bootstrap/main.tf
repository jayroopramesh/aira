# Bootstrap: creates the Azure Storage backend that the main module's remote
# state points at. Deliberately a separate root module with LOCAL state --
# it can't use the backend it's creating (the classic chicken-and-egg of
# remote state bootstrapping). Run this once, by hand, before the main
# module's first `tofu init`. See report.md "Runbook: state bootstrap".

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
}

provider "azurerm" {
  features {}
}

variable "project_name" {
  type    = string
  default = "aira"
}

variable "location" {
  type    = string
  default = "uaenorth"
}

resource "azurerm_resource_group" "state" {
  name     = "rg-${var.project_name}-tfstate-uaen"
  location = var.location
  tags = {
    project    = var.project_name
    managed-by = "opentofu-bootstrap"
  }
}

resource "random_string" "state_suffix" {
  length  = 6
  special = false
  upper   = false
  numeric = true
}

resource "azurerm_storage_account" "state" {
  name                     = "st${var.project_name}tfstate${random_string.state_suffix.result}"
  resource_group_name      = azurerm_resource_group.state.name
  location                 = azurerm_resource_group.state.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }
  }

  tags = {
    project    = var.project_name
    managed-by = "opentofu-bootstrap"
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_name  = azurerm_storage_account.state.name
  container_access_type = "private"
}

output "resource_group_name" {
  value = azurerm_resource_group.state.name
}

output "storage_account_name" {
  value = azurerm_storage_account.state.name
}

output "container_name" {
  value = azurerm_storage_container.tfstate.name
}
