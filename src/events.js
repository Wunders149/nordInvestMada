const clients = new Set();

function addClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

function broadcast(event, data = {}) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function broadcastToAll(data = {}) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function heartbeat() {
  for (const client of clients) {
    try {
      client.write(': heartbeat\n\n');
    } catch {
      clients.delete(client);
    }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { addClient, broadcast, broadcastToAll, heartbeat, getClientCount };
