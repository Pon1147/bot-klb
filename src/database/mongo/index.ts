export {
  MONGO_COLLECTIONS,
  type GuildSettingsDocument,
  type AccountBindingDocument,
  type ClaimSessionDocument,
  type CaptureEventDocument,
  type DfTokenDocument,
} from './collections.js';

export {
  connectMongo,
  disconnectMongo,
  getMongoDb,
  isMongoConnected,
  initMongoIndexes,
  _setTestDb,
} from './mongo.client.js';

export {
  getGuildSettingsFromMongo,
  saveGuildSettingsToMongo,
  loadAllGuildSettingsFromMongo,
  getAccountBindingFromMongo,
  getAccountBindingByOpenidFromMongo,
  upsertAccountBindingToMongo,
  expireAccountBindingInMongo,
  revokeAccountBindingInMongo,
  touchLastOkInMongo,
  loadAllActiveBindingsFromMongo,
  type MongoNotMatchedReason,
  type MongoBindingUpdateResult,
  createClaimSessionInMongo,
  consumeClaimSessionAtomicInMongo,
  saveAutoPostConfigToMongo,
  saveAutoPostMessageToMongo,
  deleteAutoPostMessageFromMongo,
  syncAutoPostFromMongoToSqlite,
} from './repositories/index.js';
