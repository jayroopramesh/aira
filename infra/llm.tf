# Self-hosted LLM summarization endpoint -- back in scope as a server-hosted
# module per captain amendment (2026-08-13, superseding the earlier
# no-server-LLM decision in aira-storage-plan-s8/decision-model-choice.md):
# the captain has Azure credits and wants a GPU VM serving a quantized 14B
# model, not a cloud/serverless inference API. Model choice itself is still
# open (storage plan §7 item 3, shortlist: quantized Qwen3-14B, Falcon-H1,
# Jais) -- this file provisions the GPU the model runs on, not the model.
#
# NVadsA10v5 family (NVIDIA A10 GPU), parameterized so NV12/NV36/etc are a
# one-line var change (variables.tf: llm_vm_size). Dev/Test posture: single
# instance, no availability set/zone, no Azure Backup -- same posture as the
# rest of this module for the dummy phase (infra/README.md).
#
# No public IP. Reachable only from the Container Apps environment over the
# VNet (network.tf: snet-llm, allowed from snet-app by the NSG below).
# Admin access (e.g. to run the model-serving commands in
# cloud-init/llm-vm-init.yaml's README) is intentionally out of scope here --
# use `az vm run-command invoke` or attach a temporary public IP + a scoped
# NSG rule by hand; documented in infra/README.md, not automated.

resource "azurerm_network_security_group" "llm" {
  count               = var.llm_vm_enabled ? 1 : 0
  name                = "nsg-${local.name_prefix}-llm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "allow-api-from-app-subnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = var.llm_serving_port
    source_address_prefix      = "10.20.1.0/23" # snet-app -- see network.tf
    destination_address_prefix = "*"
  }

  tags = local.tags
}

resource "azurerm_subnet_network_security_group_association" "llm" {
  count                     = var.llm_vm_enabled ? 1 : 0
  subnet_id                 = azurerm_subnet.llm.id
  network_security_group_id = azurerm_network_security_group.llm[0].id
}

resource "azurerm_network_interface" "llm" {
  count               = var.llm_vm_enabled ? 1 : 0
  name                = "nic-${local.name_prefix}-llm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.llm.id
    private_ip_address_allocation = "Dynamic"
  }

  tags = local.tags
}

resource "azurerm_linux_virtual_machine" "llm" {
  count               = var.llm_vm_enabled ? 1 : 0
  name                = "vm-${local.name_prefix}-llm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  size                = var.llm_vm_size
  admin_username      = var.llm_vm_admin_username

  network_interface_ids = [azurerm_network_interface.llm[0].id]

  admin_ssh_key {
    username   = var.llm_vm_admin_username
    public_key = var.llm_vm_admin_ssh_public_key
  }

  # Dev/Test posture: no zone pinned, no availability set, no Azure Backup.
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS" # model-weight I/O wants premium; smallest sane disk_size below
    disk_size_gb         = var.llm_os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(file("${path.module}/cloud-init/llm-vm-init.yaml"))

  tags = local.tags
}

# NVIDIA driver install -- the standard Azure-managed path for N-series VMs,
# not baked into cloud-init (which only installs the container toolkit that
# depends on this being present first).
resource "azurerm_virtual_machine_extension" "llm_gpu_driver" {
  count                      = var.llm_vm_enabled ? 1 : 0
  name                       = "NvidiaGpuDriverLinux"
  virtual_machine_id         = azurerm_linux_virtual_machine.llm[0].id
  publisher                  = "Microsoft.HpcCompute"
  type                       = "NvidiaGpuDriverLinux"
  type_handler_version       = "1.9"
  auto_upgrade_minor_version = true

  tags = local.tags
}

locals {
  llm_endpoint_url = var.llm_vm_enabled ? "http://${azurerm_network_interface.llm[0].private_ip_address}:${var.llm_serving_port}" : ""
}
