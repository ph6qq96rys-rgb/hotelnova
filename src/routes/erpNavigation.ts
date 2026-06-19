// src/routes/erpNavigation.ts

export class ErpNavigation {
  constructor(private readonly companyId: string) {}

  dashboard() {
    return `/companies/${this.companyId}/dashboard`;
  }

  users() {
    return `/companies/${this.companyId}/users`;
  }

  roles() {
    return `/companies/${this.companyId}/roles-permissions`;
  }

  inventory() {
    return `/companies/${this.companyId}/inventory-master`;
  }

  items() {
    return `/companies/${this.companyId}/inventory-master/items`;
  }

  newItem() {
    return `/companies/${this.companyId}/inventory-master/items/new`;
  }

  editItem(id: string) {
    return `/companies/${this.companyId}/inventory-master/items/${id}/edit`;
  }

  ledger() {
    return `/companies/${this.companyId}/inventory-master/ledger`;
  }

  stockTransfers() {
    return `/companies/${this.companyId}/inventory/stock-transfers`;
  }

  newTransfer() {
    return `/companies/${this.companyId}/inventory/stock-transfers/new`;
  }

  transfer(id: string) {
    return `/companies/${this.companyId}/inventory/stock-transfers/${id}`;
  }

  production() {
    return `/companies/${this.companyId}/production/batches`;
  }

  newBatch() {
    return `/companies/${this.companyId}/production/batches/new`;
  }

  recipes() {
    return `/companies/${this.companyId}/production/recipes`;
  }

  sales() {
    return `/companies/${this.companyId}/sales`;
  }

  salesRegister() {
    return `/companies/${this.companyId}/sales/list`;
  }

  sale(id: string) {
    return `/companies/${this.companyId}/sales/details/${id}`;
  }

  reports() {
    return `/companies/${this.companyId}/reports/fnb`;
  }

  pos() {
    return `/companies/${this.companyId}/sales/pos`;
  }

  posSession() {
    return `/companies/${this.companyId}/sales/pos/session`;
  }

  posOperations() {
    return `/companies/${this.companyId}/sales/pos/operations`;
  }

  settings() {
    return `/companies/${this.companyId}/settings`;
  }

  org() {
    return `/companies/${this.companyId}/org`;
  }
}