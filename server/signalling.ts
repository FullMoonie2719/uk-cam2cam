import type { IncomingMessage } from "http";
import type { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { canonicalCountryCode, isUkCountry, resolveUpgradeCountry } from "./geo";

type Client = {
  id: string;
  socket: WebSocket;
  country: string;
  partnerId?: string;
};

type SignalMessage = {
  type: string;
  [key: string]: unknown;
};

const clients = new Map<string, Client>();
const waiting: string[] = [];

export function canPairCountries(first: string, second: string) {
  return isUkCountry(first) && isUkCountry(second) && canonicalCountryCode(first) === canonicalCountryCode(second);
}

function send(client: Client | undefined, message: SignalMessage) {
  if (client?.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message));
}

function removeFromQueue(id: string) {
  const index = waiting.indexOf(id);
  if (index >= 0) waiting.splice(index, 1);
}

function endSession(client: Client, reason = "ended") {
  const partner = client.partnerId ? clients.get(client.partnerId) : undefined;
  client.partnerId = undefined;
  if (partner) {
    partner.partnerId = undefined;
    send(partner, { type: "peer-left", reason });
  }
}

function pair(client: Client) {
  removeFromQueue(client.id);
  const candidateId = waiting.find(id => {
    const candidate = clients.get(id);
    return candidate && candidate.id !== client.id && !candidate.partnerId && canPairCountries(candidate.country, client.country);
  });

  if (!candidateId) {
    waiting.push(client.id);
    send(client, { type: "queueing" });
    return;
  }

  removeFromQueue(candidateId);
  const partner = clients.get(candidateId);
  if (!partner) return pair(client);
  client.partnerId = partner.id;
  partner.partnerId = client.id;
  send(client, { type: "matched", role: "caller", peerId: partner.id });
  send(partner, { type: "matched", role: "callee", peerId: client.id });
}

function relay(client: Client, message: SignalMessage) {
  const partner = client.partnerId ? clients.get(client.partnerId) : undefined;
  if (!partner) return;
  send(partner, { ...message, senderId: client.id });
}

function handleMessage(client: Client, raw: string) {
  let message: SignalMessage;
  try {
    message = JSON.parse(raw) as SignalMessage;
  } catch {
    send(client, { type: "error", message: "Message could not be understood." });
    return;
  }

  switch (message.type) {
    case "find":
      if (!client.partnerId) pair(client);
      break;
    case "signal":
    case "chat":
      relay(client, message);
      break;
    case "skip":
      endSession(client, "skipped");
      pair(client);
      break;
    case "stop":
      endSession(client, "stopped");
      removeFromQueue(client.id);
      send(client, { type: "stopped" });
      break;
    case "report":
      relay(client, { type: "reported" });
      endSession(client, "reported");
      send(client, { type: "reported", success: true });
      break;
    default:
      send(client, { type: "error", message: "Unsupported message type." });
  }
}

export function attachSignallingServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return;
    const country = await resolveUpgradeCountry(request.headers);
    if (!country || !isUkCountry(country)) {
      socket.write("HTTP/1.1 403 Forbidden\\r\\n\\r\\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request, canonicalCountryCode(country) ?? "GB"));
  });

  wss.on("connection", (socket: WebSocket, _request: IncomingMessage, country: string) => {
    const client: Client = { id: randomUUID(), socket, country };
    clients.set(client.id, client);
    send(client, { type: "ready", clientId: client.id, country: client.country });

    socket.on("message", data => handleMessage(client, data.toString()));
    socket.on("close", () => {
      removeFromQueue(client.id);
      endSession(client, "disconnected");
      clients.delete(client.id);
    });
    socket.on("error", () => socket.close());
  });

  return wss;
}

export function resetSignallingStateForTests() {
  waiting.splice(0, waiting.length);
  clients.clear();
}
