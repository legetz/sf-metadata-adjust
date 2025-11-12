public without sharing class AccountBatchController {
  public PageReference start() {
    AccountBatch accountBatch = new AccountBatch();
    Database.executeBatch(accountBatch, 200);
    return null;
  }
}