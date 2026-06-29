import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import * as Y from "yjs";
import * as sync from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../../../lib/prisma";

// Custom helper to load .env variables without external packages
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        // Ignore comments and empty lines
        if (line.trim().startsWith("#") || !line.includes("=")) return;
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value.trim();
        }
      });
    }
  } catch (err) {
    console.error("Failed to load .env file:", err);
  }
}

loadEnv();

const secret = process.env.AUTH_SECRET || "fallback-secret-for-signing-token";
const port = parseInt(process.env.COLLAB_PORT || "3001", 10);

interface ClientSession {
  socket: WebSocket;
  userId: string;
  userName: string;
  userImage: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
  awarenessClientIds: Set<number>; // Track awareness client IDs owned by this socket
}

interface DocumentRoom {
  yDoc: Y.Doc;
  awareness: any;
  clients: Set<ClientSession>;
  debouncedSaveTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, DocumentRoom>();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("House of Edtech Collaboration Server running.\n");
});

const wss = new WebSocketServer({ noServer: true });

function verifyToken(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");
    
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch (err) {
    console.error("Token verification error:", err);
    return null;
  }
}

// Handshake verification
server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url || "", `http://${request.headers.host}`);
  const match = requestUrl.pathname.match(/^\/ws\/documents\/([^/]+)/);

  if (!match) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const documentId = match[1];
  const token = requestUrl.searchParams.get("token");

  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.documentId !== documentId) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, decoded);
  });
});

wss.on("connection", async (ws: WebSocket, request: http.IncomingMessage, session: any) => {
  const documentId = session.documentId;
  const client: ClientSession = {
    socket: ws,
    userId: session.userId,
    userName: session.userName,
    userImage: session.userImage,
    role: session.role,
    awarenessClientIds: new Set(),
  };

  console.log(`User ${client.userName} (${client.role}) connected to document ${documentId}`);

  let room = rooms.get(documentId);
  if (!room) {
    // Lazy-load document from DB on first connection
    const yDoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(yDoc);
    
    try {
      const docRecord = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (docRecord && docRecord.latestSnapshot) {
        Y.applyUpdate(yDoc, new Uint8Array(docRecord.latestSnapshot));
      }
    } catch (err) {
      console.error(`Failed to load document snapshot from DB:`, err);
    }

    room = {
      yDoc,
      awareness,
      clients: new Set(),
      debouncedSaveTimer: null,
    };
    rooms.set(documentId, room);

    // Document update listener to broadcast to other sockets and schedule saves
    yDoc.on("update", (update, origin) => {
      // origin represents the socket session that generated the update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // MessageType.SYNC
      sync.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      // Broadcast to all other room clients
      const currentRoom = rooms.get(documentId);
      if (currentRoom) {
        currentRoom.clients.forEach((c) => {
          if (c.socket !== origin && c.socket.readyState === WebSocket.OPEN) {
            c.socket.send(message);
          }
        });

        // Schedule debounced checkpoint to PostgreSQL
        scheduleCheckpoint(documentId);
      }
    });

    // Awareness update listener to broadcast presence details
    awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: any) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 1); // MessageType.AWARENESS
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      encoding.writeVarUint8Array(encoder, update);
      const message = encoding.toUint8Array(encoder);

      const currentRoom = rooms.get(documentId);
      if (currentRoom) {
        currentRoom.clients.forEach((c) => {
          if (c.socket.readyState === WebSocket.OPEN) {
            c.socket.send(message);
          }
        });
      }
    });
  }

  room.clients.add(client);

  // Send Sync Step 1 from Server to Client
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // MessageType.SYNC
    sync.writeSyncStep1(encoder, room.yDoc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send initial awareness state
  const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
    room.awareness,
    Array.from(room.awareness.getStates().keys())
  );
  const awarenessEncoder = encoding.createEncoder();
  encoding.writeVarUint(awarenessEncoder, 1); // MessageType.AWARENESS
  encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
  ws.send(encoding.toUint8Array(awarenessEncoder));

  ws.on("message", (message: any) => {
    if (!(message instanceof Buffer)) {
      if (typeof message === "string" && message === "ping") {
        ws.send("pong");
      }
      return;
    }

    const payload = new Uint8Array(message);

    // Heartbeat check (255 represents client Ping)
    if (payload.length === 1 && payload[0] === 255) {
      ws.send(new Uint8Array([254])); // Pong
      return;
    }

    try {
      const decoder = decoding.createDecoder(payload);
      const messageType = decoding.readVarUint(decoder);

      const activeRoom = rooms.get(documentId);
      if (!activeRoom) return;

      if (messageType === 0) { // MessageType.SYNC
        // Check sync message sub-type (syncStep1 = 0, syncStep2 = 1, update = 2)
        const syncSubtype = decoding.readVarUint(decoder);
        
        // Security check: restrict VIEWER users from sending updates/mutations (subtype 2)
        if (syncSubtype === 2 && client.role === "VIEWER") {
          console.warn(`Blocked unauthorized update attempt from VIEWER user: ${client.userName}`);
          return;
        }

        // Reset decoder and handle message using transaction tagged to the originating client socket
        const resetDecoder = decoding.createDecoder(payload);
        decoding.readVarUint(resetDecoder); // Skip type
        
        const replyEncoder = encoding.createEncoder();
        encoding.writeVarUint(replyEncoder, 0); // MessageType.SYNC
        
        sync.readSyncMessage(resetDecoder, replyEncoder, activeRoom.yDoc, ws);
        
        if (encoding.length(replyEncoder) > 1) {
          ws.send(encoding.toUint8Array(replyEncoder));
        }
      } else if (messageType === 1) { // MessageType.AWARENESS
        const awarenessUpdate = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(activeRoom.awareness, awarenessUpdate, ws);
        
        // Track awareness client IDs owned by this socket for cleanup on disconnect
        try {
          const updateDecoder = decoding.createDecoder(awarenessUpdate);
          const len = decoding.readVarUint(updateDecoder);
          for (let i = 0; i < len; i++) {
            const clientID = decoding.readVarUint(updateDecoder);
            decoding.readVarUint(updateDecoder); // Skip clock
            decoding.readVarString(updateDecoder); // Skip state string
            client.awarenessClientIds.add(clientID);
          }
        } catch {
          // Best-effort tracking — ignore decode errors
        }
      }
    } catch (err) {
      console.error(`Error processing message from ${client.userName}:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`User ${client.userName} disconnected`);
    const activeRoom = rooms.get(documentId);
    if (activeRoom) {
      activeRoom.clients.delete(client);
      
      // Clean up client awareness states on socket close
      // Remove only the awareness client IDs that were sent by this particular socket
      const idsToRemove = Array.from(client.awarenessClientIds);
      if (idsToRemove.length > 0) {
        awarenessProtocol.removeAwarenessStates(activeRoom.awareness, idsToRemove, ws);
      }

      if (activeRoom.clients.size === 0) {
        console.log(`No active clients left. Saving document ${documentId} and cleaning room memory.`);
        
        // Perform final checkpoint immediately before purging room
        if (activeRoom.debouncedSaveTimer) {
          clearTimeout(activeRoom.debouncedSaveTimer);
        }
        
        saveDocumentToDB(documentId, activeRoom.yDoc)
          .then(() => {
            rooms.delete(documentId);
            activeRoom.yDoc.destroy();
          })
          .catch((err) => {
            console.error(`Failed final save for document ${documentId}:`, err);
            rooms.delete(documentId);
          });
      }
    }
  });

  ws.on("error", (err) => {
    console.error(`Socket error for ${client.userName}:`, err);
  });
});

/**
 * Saves Y.Doc state snapshot to PostgreSQL database.
 */
async function saveDocumentToDB(documentId: string, yDoc: Y.Doc): Promise<void> {
  const snapshot = Y.encodeStateAsUpdate(yDoc);
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        latestSnapshot: Buffer.from(snapshot),
        updatedAt: new Date(),
      },
    });
    console.log(`Successfully checkpointed document ${documentId} to database.`);
  } catch (err) {
    console.error(`Error saving document ${documentId} checkpoint:`, err);
    throw err;
  }
}

/**
 * Schedules a debounced DB save (checkpoint) 5 seconds after a change.
 */
function scheduleCheckpoint(documentId: string) {
  const room = rooms.get(documentId);
  if (!room) return;

  if (room.debouncedSaveTimer) {
    clearTimeout(room.debouncedSaveTimer);
  }

  room.debouncedSaveTimer = setTimeout(async () => {
    const activeRoom = rooms.get(documentId);
    if (activeRoom) {
      try {
        await saveDocumentToDB(documentId, activeRoom.yDoc);
      } catch (err) {
        console.error(`Debounced save failed for ${documentId}:`, err);
      } finally {
        if (activeRoom) {
          activeRoom.debouncedSaveTimer = null;
        }
      }
    }
  }, 5000); // 5 seconds debounce
}

// Start HTTP server on port 3001
server.listen(port, () => {
  console.log(`WebSocket Collaboration Server listening on port ${port}`);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down collaboration server. Saving all active documents...");
  const savePromises: Promise<void>[] = [];
  rooms.forEach((room, docId) => {
    savePromises.push(saveDocumentToDB(docId, room.yDoc));
  });
  await Promise.all(savePromises).catch((err) => console.error("Error during final shutdown save:", err));
  await prisma.$disconnect();
  process.exit(0);
});
