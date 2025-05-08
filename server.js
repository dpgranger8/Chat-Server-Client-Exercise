import * as net from 'net'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url';

const clients = new Map();
let clientId = 0;

const server = net.createServer((socket) => {
    const id = clientId++;
    console.log("Client connected");
    socket.setEncoding("utf-8");
    clients.set(id, socket)
    let message = `Welcome, client ${id}`
    socket.write(message)
    logMessage(message)

    //when a client has connected, rebroadcast it to all clients
    for (let [otherId, otherSocket] of clients) {
        if (otherId !== id) {
            otherSocket.write(`Client ${id} has connected to the server`)
        }
    }

    socket.on('data', (data) => {
        console.log(`Data received: ${data}`)
        logMessage(data);
        
        //when a client sends a message, rebroadcast it to all clients
        for (let [otherId, otherSocket] of clients) {
            if (otherId !== id) {
                otherSocket.write(`Client ${id} says: ` + String(data))
            }
        }
    })

    socket.on('close', (data) => {
        let disconnectMessage = `Client ${id} has disconnected from the server`
        console.log(disconnectMessage)
        logMessage(disconnectMessage)

        //when a client disconnects, rebroadcast it to all clients
        for (let [otherId, otherSocket] of clients) {
            if (otherId !== id) {
                otherSocket.write(disconnectMessage)
            }
        }
        clients.delete(id);
    })
}).listen(8080, () => {
    console.log("Server listening on port 8080")
})



function logMessage(data) {
    const fileName = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(fileName)
    const logPath = path.join(__dirname, "server-log.txt")
    fs.appendFileSync(logPath, formatMessage(data), (err) => {
        if (err) {
            return console.log(err)
        }
    })
}

function formatMessage(message) {
    const now = new Date();
    return `${now.toISOString()}   ` + message + "\n"
}