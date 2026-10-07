// Shared Cosmos DB client — reused across all functions
const { CosmosClient } = require('@azure/cosmos');

let _client = null;
let _db = null;

function getClient() {
  if (!_client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set.');
    _client = new CosmosClient({ endpoint, key });
  }
  return _client;
}

async function getContainer(containerName) {
  if (!_db) {
    const dbName = process.env.COSMOS_DB || 'vncrochet';
    const { database } = await getClient().databases.createIfNotExists({ id: dbName });
    _db = database;
  }
  const { container } = await _db.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ['/id'] }
  });
  return container;
}

module.exports = { getContainer };
