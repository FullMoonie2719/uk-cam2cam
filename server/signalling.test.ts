import { createServer } from "http";
import { describe, expect, it, afterEach } from "vitest";
import { WebSocket } from "ws";
import { attachSignallingServer, canPairCountries, resetSignallingStateForTests } from "./signalling";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(() => {
  resetSignallingStateForTests();
  for (const server of servers.splice(0)) server.close();
});

function waitFor(socket: WebSocket, type: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2000);
    socket.on("message", raw => {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (message.type === type) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

async function makePair() {
  const server = createServer();
  servers.push(server);
  attachSignallingServer(server);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const first = new WebSocket(url, { headers: { "cf-ipcountry": "GB" } });
  const second = new WebSocket(url, { headers: { "cf-ipcountry": "UK" } });
  await Promise.all([waitFor(first, "ready"), waitFor(second, "ready")]);
  first.send(JSON.stringify({ type: "find" }));
  second.send(JSON.stringify({ type: "find" }));
  await Promise.all([waitFor(first, "matched"), waitFor(second, "matched")]);
  return { first, second };
}

describe("signalling", () => {
  it("normalizes GB and UK as pairable countries", () => {
    expect(canPairCountries("GB", "UK")).toBe(true);
    expect(canPairCountries("GB", "FR")).toBe(false);
  });

  it("pairs clients and relays chat messages", async () => {
    const { first, second } = await makePair();
    const incoming = waitFor(second, "chat");
    first.send(JSON.stringify({ type: "chat", text: "hello" }));
    await expect(incoming).resolves.toMatchObject({ text: "hello" });
    first.close();
    second.close();
  });

  it("ends a session on skip and stop", async () => {
    const { first, second } = await makePair();
    const left = waitFor(second, "peer-left");
    first.send(JSON.stringify({ type: "skip" }));
    await expect(left).resolves.toMatchObject({ reason: "skipped" });
    const stopped = waitFor(first, "stopped");
    first.send(JSON.stringify({ type: "stop" }));
    await expect(stopped).resolves.toMatchObject({ type: "stopped" });
    first.close();
    second.close();
  });

  it("notifies the peer and cleans up when a client disconnects", async () => {
    const { first, second } = await makePair();
    const left = waitFor(second, "peer-left");
    first.close();
    await expect(left).resolves.toMatchObject({ reason: "disconnected" });
    const queueing = waitFor(second, "queueing");
    second.send(JSON.stringify({ type: "find" }));
    await expect(queueing).resolves.toMatchObject({ type: "queueing" });
    second.close();
  });

  it("relays a report and disconnects the reported session", async () => {
    const { first, second } = await makePair();
    const peerNotice = waitFor(second, "reported");
    const reporterNotice = waitFor(first, "reported");
    first.send(JSON.stringify({ type: "report" }));
    await Promise.all([peerNotice, reporterNotice]);
    first.close();
    second.close();
  });
});
