import * as net from 'net'

const client = net.createConnection({port: 8080}, () => {
    console.log("Connected to the server!");
    process.stdin.pipe(client);
})

client.on('data', (data) => {
    console.log(String(data));
})