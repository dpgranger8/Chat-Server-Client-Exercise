import * as net from 'net'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url';

let clients = new Map();
let clientUsernames = new Map();
let clientId = 0;

const server = net.createServer((socket) => {
    const id = clientId++;
    console.log("Client connected");
    socket.setEncoding("utf-8");
    clients.set(id, socket)
    clientUsernames.set(id, "")
    let message = `Welcome, client ${id}`
    socket.write(message)
    logMessage(message)

    //when a client has connected, rebroadcast it to all clients
    sendMessage(id, `Client ${id} has connected to the server`, (searchID, otherID) => {
        return otherID !== id
    })

    socket.on('data', (data) => {
        console.log(`Data received: ${data}`)
        logMessage(data);

        const parts = data.toString().trim().split(" ");
        const flag = parts[0];
        const clientIdentifier = parts[1];
        const message = parts.slice(2).join(" ");

        if (flag.toLowerCase() === "/w") {
            if (clientIdentifier == undefined || parts.length < 3) {
                socket.write("Invalid whisper command format. Use /w <clientID or username> <message>\n")
                return
            }
            if (!isNaN(Number(clientIdentifier))) {
                if (clients.get(parseInt(clientIdentifier)) === undefined) {
                    socket.write("This client does not exist. Please try again")
                    return
                }
                whisper(clientIdentifier, id, message)
                socket.write("Message sent!")
            } else { // they inputted the username
                if (clientUsernames.get(clientIdentifier.toString) === undefined) {
                    socket.write("This client does not exist. Please try again")
                    return
                }
                let selectedClient
                for (let [key, value] of clientUsernames) {
                    if (value === clientIdentifier.toString()) {
                        selectedClient = key
                    }
                }
                whisper(selectedClient, id, message)
                socket.write("Message sent!")
            }
        } else if (flag.toLowerCase() === "/username") {
            if (clientIdentifier == undefined || parts.length !== 2) {
                socket.write("Invalid username command format. Use /username <new name>\n")
                return
            }
            let name = clientIdentifier.toString()
            clientUsernames.set(id, name)
            sendMessage(id, `Your username was set to: ` + name, (searchID, otherID) => {
                return otherID === id
            })
            sendMessage(id, `Client ${id} has changed their username to: ` + name, (searchID, otherID) => {
                return otherID !== id
            })
        } else {
            //when a client sends a message, rebroadcast it to all clients
            sendMessage(id, `Client ${id} says: ` + String(data), (searchID, otherID) => {
                return otherID !== id
            })
            socket.write("Message sent!")
        }
    })

    socket.on('close', (data) => {
        let disconnectMessage = `Client ${id} has disconnected from the server`
        console.log(disconnectMessage)
        logMessage(disconnectMessage)

        //when a client disconnects, rebroadcast it to all clients
        sendMessage(id, disconnectMessage, (searchID, otherID) => {
            return otherID !== id
        })
        clients.delete(id);
    })
}).listen(8080, () => {
    console.log("Server listening on port 8080")
})

function whisper(selectedClient, id, message) {
    let messageParts
    if (parseInt(selectedClient) === parseInt(id)) {
        messageParts = `Invalid whisper format. Cannot whisper to yourself`
    } else {
        let name = clientUsernames.get(id)
        if (name === "") {
            messageParts = `Client ${id} whispers to you: ` + message
        } else {
            messageParts = `Client ${name} whispers to you: ` + message
        }
    }
    sendMessage(selectedClient, messageParts, (searchID, otherID) => {
        return parseInt(searchID) === parseInt(otherID)
    })
}

function sendMessage(searchID, message, condition) {
    for (let [otherID, otherSocket] of clients) {
        if (condition(searchID, otherID)) {
            otherSocket.write(message)
        }
    }
}

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