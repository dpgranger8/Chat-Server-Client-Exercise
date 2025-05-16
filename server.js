import * as net from 'net'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url';

let clients = new Map();
let clientUsernames = new Map();
let clientId = 0;
let adminPassword = "supersecretpassword"

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
        let flag = parts[0];
        const clientIdentifier = parts[1];
        const message = parts.slice(2).join(" ");
        const password = parts[2]
        flag = flag.toLowerCase()

        if (flag === "/w") {
            if (clientIdentifier == undefined || parts.length < 3) {
                socket.write("Invalid whisper command format. Use /w <client_ID or user_name> <message>\n")
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
                let selectedClient = findClient(clientIdentifier)
                if (selectedClient === undefined) {
                    socket.write("This client does not exist. Please try again")
                    return
                }
                whisper(selectedClient, id, message)
                socket.write("Message sent!")
            }
        } else if (flag === "/username") {
            if (clientIdentifier == undefined || parts.length !== 2) {
                socket.write("Invalid username command format. Use /username <new name>\n")
                return
            }
            let name = clientIdentifier.toString()
            if (findClient(name) !== undefined) {
                socket.write("This username has already been taken. Please try again")
                return
            }
            clientUsernames.set(id, name)
            console.log(clientUsernames)
            sendMessage(id, `Your username was successfully set to: ` + name, (searchID, otherID) => {
                return otherID === id
            })
            sendMessage(id, `Client ${id} has changed their username to: ` + name, (searchID, otherID) => {
                return otherID !== id
            })
        } else if (flag === "/kick") {
            if (clientIdentifier === undefined || parts.length < 3 || parts.length > 3) {
                socket.write("Invalid kick command format. Use /kick <user_name> <admin_password>")
                return
            }
            let selectedClient
            if (!isNaN(Number(clientIdentifier))) {
                if (clients.get(parseInt(clientIdentifier)) === undefined) {
                    socket.write("This client does not exist. Please try again")
                    return
                }
                selectedClient = clientIdentifier
            } else { // they inputted the username
                selectedClient = findClient(clientIdentifier)
                if (selectedClient === undefined) {
                    socket.write("This client does not exist. Please try again")
                    return
                }
            }
            if (password === undefined || password !== adminPassword) {
                socket.write("The password is incorrect. Please try again")
                return
            }
            if (id === selectedClient) {
                socket.write("Cannot kick yourself. Please try again")
                return
            }
            clients.get(parseInt(selectedClient)).write('You have been kicked from the server.')
            clients.get(parseInt(selectedClient)).end()
            sendMessage(id, `Client ${id} was kicked from the server`, (searchID, otherID) => {
                return otherID !== id && otherID !== parseInt(selectedClient)
            })
        } else if (flag === "/clientlist") {
            let list = ""
            for (let [key, value] of clients) {
                let username = clientUsernames.get(key) === "" ? "<unset>" : clientUsernames.get(key)
                list = list + "[Client: " + key + "  Username: " + username + "]\n"
            }
            socket.write(list)
        } else {
            //when a client sends a message, rebroadcast it to all clients
            sendMessage(id, `Client ${id} says: ` + String(data), (searchID, otherID) => {
                return otherID !== id
            })
            socket.write("Message sent successfully!")
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

function findClient(clientIdentifier) {
    for (let [key, value] of clientUsernames) {
        if (value === clientIdentifier.toString()) {
            return key
        }
    }
    return undefined
}

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